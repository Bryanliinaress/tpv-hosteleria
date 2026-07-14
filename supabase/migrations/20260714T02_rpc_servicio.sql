-- ============================================================================
-- TPV Hostelería · Migración 02: RPC de servicio (Fase 0 de PRODUCCION.md)
--
-- Operaciones ATÓMICAS por entidad que sustituyen al last-write-wins del blob:
-- cada acción muta su fila (línea, comanda, mesa) dentro de una transacción.
--
-- Modelo de acceso (ver BACKEND.md):
--  · Cliente anónimo (QR): NO toca tablas; solo estas RPC `security definer`,
--    que validan cada entrada. GRANT a `anon` únicamente en las suyas.
--  · Personal autenticado: opera por RLS (tenant_all); las transiciones
--    sensibles (cobrar, agrupar, marchar) van por RPC transaccionales que
--    revalidan el local del JWT.
--
-- Requiere: migración 01 aplicada; extensión pgcrypto (crypt/gen_salt).
-- Aplicar con: supabase db push  (o pegar en el SQL editor del proyecto)
-- ============================================================================

create extension if not exists pgcrypto;

-- ────────────────────────────────────────────────────────────────────────────
-- Helpers internos
-- ────────────────────────────────────────────────────────────────────────────

-- Local del empleado autenticado, o excepción si no hay sesión válida.
create or replace function _local_o_error() returns uuid
language plpgsql stable as $$
declare v uuid;
begin
  v := local_actual();
  if v is null then raise exception 'sin_sesion' using errcode = '28000'; end if;
  return v;
end $$;

-- Ids del grupo de una mesa (la cabeza y sus unidas). Si la mesa es
-- secundaria, resuelve primero la cabeza.
create or replace function _grupo_de(p_mesa uuid) returns uuid[]
language plpgsql stable as $$
declare cabeza uuid;
begin
  select coalesce(unida_a, id) into cabeza from mesas where id = p_mesa;
  if cabeza is null then raise exception 'mesa_no_existe'; end if;
  return array(select id from mesas where id = cabeza or unida_a = cabeza);
end $$;

-- Snapshot JSON de comensales+líneas de un grupo (detalle del ticket).
create or replace function _detalle_grupo(p_grupo uuid[]) returns jsonb
language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'nombre', c.nombre, 'pagado', c.pagado,
    'propina', c.propina, 'metodoPago', c.metodo_pago, 'cobradoPor', c.cobrado_por,
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'nombre', l.nombre, 'precio', l.precio, 'cantidad', l.cantidad,
        'tipo', l.tipo, 'personalizacion', l.personalizacion
      ) order by l.creado_en), '[]'::jsonb)
      from lineas_pedido l where l.comensal_id = c.id
    )
  ) order by c.creado_en), '[]'::jsonb)
  from comensales c where c.mesa_id = any(p_grupo)
$$;

-- Cierra un grupo de mesas: ticket + limpieza de servicio. USO INTERNO.
create or replace function _cerrar_grupo(
  p_grupo uuid[], p_propina numeric, p_pagos jsonb,
  p_camarero text, p_cobrado_por text, p_descuento numeric default 0
) returns bigint
language plpgsql as $$
declare
  v_local uuid;
  v_mesa_num int;
  v_total numeric;
  v_num bigint;
begin
  select local_id, numero into v_local, v_mesa_num
  from mesas where id = p_grupo[1];

  select coalesce(sum(l.precio * l.cantidad), 0) into v_total
  from lineas_pedido l join comensales c on c.id = l.comensal_id
  where c.mesa_id = any(p_grupo);

  v_total := greatest(v_total - coalesce(p_descuento, 0), 0);

  insert into tickets (local_id, mesa_numero, total, propina, pagos, detalle, camarero, cobrado_por)
  values (
    v_local, v_mesa_num, v_total, coalesce(p_propina, 0),
    coalesce(p_pagos, '{}'::jsonb)
      || case when coalesce(p_descuento, 0) > 0
              then jsonb_build_object('descuento', p_descuento) else '{}'::jsonb end,
    _detalle_grupo(p_grupo), p_camarero, p_cobrado_por
  )
  returning numero into v_num;

  -- Limpieza del servicio (cascada borra líneas al borrar comensales)
  delete from comensales where mesa_id = any(p_grupo);
  delete from comandas   where mesa_id = any(p_grupo);
  delete from avisos     where mesa_id = any(p_grupo);
  update mesas set estado = 'libre', unida_a = null,
                   abierta_desde = null, camarero_id = null, reserva = null
  where id = any(p_grupo);

  return v_num;
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- PIN: cambio rápido de usuario en dispositivos ya autenticados
-- ────────────────────────────────────────────────────────────────────────────

-- Verifica el PIN contra el hash (bcrypt). Devuelve el empleado o null.
-- Se llama autenticado (el dispositivo ya tiene sesión del local).
create or replace function verificar_pin(p_pin text, p_solo_admin boolean default false)
returns table (id uuid, nombre text, rol text)
language plpgsql security definer set search_path = public as $$
begin
  return query
    select e.id, e.nombre, e.rol from empleados e
    where e.local_id = _local_o_error()
      and e.activo
      and e.pin_hash is not null
      and e.pin_hash = crypt(p_pin, e.pin_hash)
      and (not p_solo_admin or e.rol = 'admin')
    limit 1;
end $$;

-- Fija (o cambia) el PIN de un empleado. Solo un admin del local.
create or replace function fijar_pin(p_empleado uuid, p_pin text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if length(coalesce(p_pin, '')) < 4 then raise exception 'pin_corto'; end if;
  if not exists (select 1 from empleados e
                 where e.local_id = _local_o_error() and e.user_id = auth.uid() and e.rol = 'admin') then
    raise exception 'solo_admin' using errcode = '42501';
  end if;
  update empleados set pin_hash = crypt(p_pin, gen_salt('bf'))
  where id = p_empleado and local_id = _local_o_error();
  if not found then raise exception 'empleado_no_existe'; end if;
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- Cliente anónimo (QR): unirse, pedir, cuenta, llamar
-- ────────────────────────────────────────────────────────────────────────────

-- Un cliente escanea el QR y se une a la mesa (la abre si estaba libre o
-- reservada). Devuelve su id de comensal.
create or replace function qr_unirse_mesa(p_mesa uuid, p_nombre text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_mesa mesas%rowtype;
  v_id uuid;
  v_nombre text := nullif(trim(coalesce(p_nombre, '')), '');
begin
  select * into v_mesa from mesas where id = p_mesa for update;
  if not found then raise exception 'mesa_no_existe'; end if;
  if v_mesa.unida_a is not null then raise exception 'mesa_unida'; end if;

  if v_nombre is null then
    v_nombre := 'Comensal ' || (1 + (select count(*) from comensales where mesa_id = p_mesa));
  end if;
  if length(v_nombre) > 40 then v_nombre := left(v_nombre, 40); end if;

  if v_mesa.estado in ('libre', 'reservada') then
    update mesas set estado = 'ocupada', abierta_desde = now(), reserva = null
    where id = p_mesa;
  end if;

  insert into comensales (local_id, mesa_id, nombre)
  values (v_mesa.local_id, p_mesa, v_nombre)
  returning id into v_id;
  return v_id;
end $$;

-- Añade una línea al pedido del comensal. El PRECIO se resuelve en servidor
-- desde la carta (nunca se confía en el del cliente). Fusiona con una línea
-- pendiente idéntica (mismo producto+personalización) subiendo cantidad.
create or replace function qr_agregar_linea(
  p_comensal uuid, p_producto uuid,
  p_variante text default null,           -- clave en productos.precios
  p_personalizacion jsonb default '{}'::jsonb,
  p_tiempo int default 1,
  p_cantidad int default 1
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_com comensales%rowtype;
  v_prod productos%rowtype;
  v_precio numeric;
  v_nombre text;
  v_id uuid;
begin
  if p_cantidad < 1 or p_cantidad > 50 then raise exception 'cantidad_invalida'; end if;
  if p_tiempo not between 1 and 3 then raise exception 'tiempo_invalido'; end if;

  select * into v_com from comensales where id = p_comensal;
  if not found then raise exception 'comensal_no_existe'; end if;
  if exists (select 1 from mesas m where m.id = v_com.mesa_id and m.estado = 'libre') then
    raise exception 'mesa_cerrada';
  end if;

  select * into v_prod from productos
  where id = p_producto and local_id = v_com.local_id and disponible;
  if not found then raise exception 'producto_no_disponible'; end if;

  -- precio de la variante pedida, o 'base', o el único valor
  v_precio := coalesce(
    (v_prod.precios ->> coalesce(p_variante, 'base'))::numeric,
    case when jsonb_typeof(v_prod.precios) = 'object'
              and (select count(*) from jsonb_object_keys(v_prod.precios)) = 1
         then (select (v_prod.precios ->> k)::numeric
               from jsonb_object_keys(v_prod.precios) k limit 1) end
  );
  if v_precio is null then raise exception 'variante_invalida'; end if;
  v_nombre := v_prod.nombre || case when p_variante is not null and p_variante <> 'base'
                                    then ' (' || p_variante || ')' else '' end;

  -- fusión con línea pendiente idéntica
  select id into v_id from lineas_pedido
  where comensal_id = p_comensal and producto_id = p_producto
    and estado = 'pendiente' and tiempo = p_tiempo
    and personalizacion = coalesce(p_personalizacion, '{}'::jsonb)
    and nombre = v_nombre
  limit 1;
  if v_id is not null then
    update lineas_pedido set cantidad = cantidad + p_cantidad where id = v_id;
    return v_id;
  end if;

  insert into lineas_pedido (local_id, comensal_id, producto_id, nombre, precio,
                             cantidad, tipo, tiempo, personalizacion)
  values (v_com.local_id, p_comensal, p_producto, v_nombre, v_precio,
          p_cantidad, (select c.tipo from categorias c where c.id = v_prod.categoria_id),
          p_tiempo, coalesce(p_personalizacion, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end $$;

-- Cambia la cantidad de una línea PENDIENTE propia (0 = borrar).
create or replace function qr_cambiar_cantidad(p_linea uuid, p_comensal uuid, p_cantidad int)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_cantidad < 0 or p_cantidad > 50 then raise exception 'cantidad_invalida'; end if;
  if p_cantidad = 0 then
    delete from lineas_pedido
    where id = p_linea and comensal_id = p_comensal and estado = 'pendiente';
  else
    update lineas_pedido set cantidad = p_cantidad
    where id = p_linea and comensal_id = p_comensal and estado = 'pendiente';
  end if;
  if not found then raise exception 'linea_no_editable'; end if;
end $$;

-- Envía a cocina/barra todo lo pendiente de la mesa (comanda por línea).
-- Tiempo 1 entra como 'recibido'; tiempos 2-3 quedan 'en espera' hasta marchar.
create or replace function qr_confirmar_pedido(p_mesa uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  with pendientes as (
    select l.id, l.local_id, l.tipo, l.tiempo
    from lineas_pedido l join comensales c on c.id = l.comensal_id
    where c.mesa_id = any(_grupo_de(p_mesa)) and l.estado = 'pendiente'
    for update of l
  ), enviadas as (
    update lineas_pedido set estado = 'enviado'
    where id in (select id from pendientes)
    returning id
  )
  insert into comandas (local_id, mesa_id, linea_id, destino, estado, tiempo)
  select p.local_id, p_mesa, p.id,
         case when p.tipo = 'comida' then 'cocina' else 'barra' end,
         case when p.tiempo > 1 then 'espera' else 'recibido' end,
         p.tiempo
  from pendientes p;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Llama al camarero (un aviso activo por mesa; repetir no duplica).
create or replace function qr_llamar_camarero(p_mesa uuid, p_nombre text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_local uuid;
begin
  select id into v_id from avisos where mesa_id = p_mesa limit 1;
  if v_id is not null then return v_id; end if;
  select local_id into v_local from mesas where id = p_mesa;
  if v_local is null then raise exception 'mesa_no_existe'; end if;
  insert into avisos (local_id, mesa_id, nombre)
  values (v_local, p_mesa, left(nullif(trim(coalesce(p_nombre, '')), ''), 40))
  returning id into v_id;
  return v_id;
end $$;

-- Cancela el aviso (el cliente se arrepiente).
create or replace function qr_cancelar_aviso(p_mesa uuid)
returns void
language sql security definer set search_path = public as $$
  delete from avisos where mesa_id = p_mesa
$$;

-- El cliente pide la cuenta.
create or replace function qr_pedir_cuenta(p_mesa uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update mesas set estado = 'esperando_cobro'
  where id = any(_grupo_de(p_mesa)) and estado = 'ocupada';
  if not found then raise exception 'mesa_no_cobrable'; end if;
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- Personal: transiciones transaccionales (cobro, grupos, marchar)
-- ────────────────────────────────────────────────────────────────────────────

-- Marca pagada la parte de un comensal; si era el último, cierra el grupo y
-- emite el ticket. Todo en una transacción: dos camareros no se pisan.
create or replace function pagar_parte(
  p_comensal uuid, p_propina numeric default 0,
  p_metodo text default 'efectivo', p_cobrado_por text default null
) returns table (cerrada boolean, ticket bigint)
language plpgsql security definer set search_path = public as $$
declare
  v_local uuid := _local_o_error();
  v_mesa uuid;
  v_grupo uuid[];
  v_pagos jsonb;
  v_prop numeric;
  v_num bigint;
begin
  update comensales set pagado = true, propina = coalesce(p_propina, 0),
                        metodo_pago = p_metodo, cobrado_por = p_cobrado_por
  where id = p_comensal and local_id = v_local
  returning mesa_id into v_mesa;
  if v_mesa is null then raise exception 'comensal_no_existe'; end if;

  v_grupo := _grupo_de(v_mesa);
  if exists (select 1 from comensales where mesa_id = any(v_grupo) and not pagado) then
    return query select false, null::bigint;
    return;
  end if;

  -- Todos pagados: desglose real por método y propinas acumuladas
  select coalesce(jsonb_object_agg(metodo, importe), '{}'::jsonb),
         coalesce(sum(prop), 0)
    into v_pagos, v_prop
  from (
    select coalesce(c.metodo_pago, 'efectivo') as metodo,
           sum((select coalesce(sum(l.precio * l.cantidad), 0)
                from lineas_pedido l where l.comensal_id = c.id)) as importe,
           sum(c.propina) as prop
    from comensales c where c.mesa_id = any(v_grupo)
    group by 1
  ) x;

  v_num := _cerrar_grupo(v_grupo, v_prop, v_pagos, p_cobrado_por, p_cobrado_por);
  return query select true, v_num;
end $$;

-- Cobra la mesa/grupo entera de una vez (pagos = desglose {efectivo: x, ...}).
create or replace function cobrar_mesa(
  p_mesa uuid, p_pagos jsonb default '{}'::jsonb, p_propina numeric default 0,
  p_cobrado_por text default null, p_descuento numeric default 0
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_local uuid := _local_o_error();
  v_grupo uuid[];
begin
  if not exists (select 1 from mesas where id = p_mesa and local_id = v_local) then
    raise exception 'mesa_no_existe';
  end if;
  if coalesce(p_descuento, 0) < 0 then raise exception 'descuento_invalido'; end if;
  v_grupo := _grupo_de(p_mesa);
  return _cerrar_grupo(v_grupo, p_propina, p_pagos, p_cobrado_por, p_cobrado_por, p_descuento);
end $$;

-- Une la mesa secundaria al grupo de la principal (cuenta única).
create or replace function agrupar_mesas(p_principal uuid, p_secundaria uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_local uuid := _local_o_error();
  v_cabeza uuid;
begin
  if p_principal = p_secundaria then raise exception 'misma_mesa'; end if;
  select coalesce(unida_a, id) into v_cabeza
  from mesas where id = p_principal and local_id = v_local for update;
  if v_cabeza is null then raise exception 'mesa_no_existe'; end if;
  -- la secundaria debe existir, ser del local y no tener ya un grupo propio
  perform 1 from mesas
  where id = p_secundaria and local_id = v_local and unida_a is null
    and not exists (select 1 from mesas x where x.unida_a = p_secundaria)
  for update;
  if not found then raise exception 'secundaria_invalida'; end if;

  update mesas set unida_a = v_cabeza,
                   estado = (select estado from mesas where id = v_cabeza)
  where id = p_secundaria;
end $$;

-- Separa el grupo: las secundarias vuelven libres; la cuenta queda en la cabeza.
create or replace function separar_mesas(p_mesa uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_local uuid := _local_o_error();
  v_cabeza uuid;
begin
  select coalesce(unida_a, id) into v_cabeza
  from mesas where id = p_mesa and local_id = v_local;
  if v_cabeza is null then raise exception 'mesa_no_existe'; end if;
  update mesas set unida_a = null, estado = 'libre',
                   abierta_desde = null, camarero_id = null
  where unida_a = v_cabeza;
end $$;

-- Lanza el siguiente tiempo en espera de la mesa (2º plato, postre).
create or replace function marchar_siguiente(p_mesa uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_local uuid := _local_o_error();
  v_tiempo int;
  v_n int;
begin
  select min(tiempo) into v_tiempo
  from comandas where mesa_id = p_mesa and local_id = v_local and estado = 'espera';
  if v_tiempo is null then return 0; end if;
  update comandas set estado = 'recibido', hora_entrada = now()
  where mesa_id = p_mesa and estado = 'espera' and tiempo = v_tiempo;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Registro de anulaciones (no existía en la migración 01)
create table if not exists anulaciones (
  id        uuid primary key default gen_random_uuid(),
  local_id  uuid not null references locales on delete cascade,
  nombre    text not null,
  precio    numeric(10,2) not null,
  cantidad  int not null,
  motivo    text,
  por       text,
  creado_en timestamptz not null default now()
);
create index if not exists anulaciones_local on anulaciones (local_id);
alter table anulaciones enable row level security;
drop policy if exists tenant_all on anulaciones;
create policy tenant_all on anulaciones for all to authenticated
  using (local_id = local_actual()) with check (local_id = local_actual());

-- Anula una línea con auditoría (motivo + quién). Borra su comanda si la había.
create or replace function anular_linea(p_linea uuid, p_motivo text, p_por text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_local uuid := _local_o_error();
  v_l lineas_pedido%rowtype;
begin
  select l.* into v_l from lineas_pedido l
  where l.id = p_linea and l.local_id = v_local for update;
  if not found then raise exception 'linea_no_existe'; end if;

  insert into anulaciones (local_id, nombre, precio, cantidad, motivo, por)
  values (v_local, v_l.nombre, v_l.precio, v_l.cantidad,
          left(coalesce(p_motivo, ''), 200), p_por);
  delete from comandas where linea_id = p_linea;
  delete from lineas_pedido where id = p_linea;
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- Reservas online (cliente anónimo, autogestión por token)
-- ────────────────────────────────────────────────────────────────────────────

-- Crea una reserva validando aforo/solape EN SERVIDOR (config del local:
-- {turnos, intervaloMin, duracionMin, aforo, maxPersonasOnline, diasCerrados}).
create or replace function crear_reserva(
  p_local uuid, p_fecha date, p_hora time, p_personas int,
  p_nombre text, p_email text default null, p_telefono text default null,
  p_zona text default null, p_notas text default null
) returns table (reserva_id uuid, token text)
language plpgsql security definer set search_path = public as $$
declare
  v_cfg jsonb;
  v_dur int;
  v_aforo int;
  v_ocupado int;
begin
  if p_personas < 1 or p_personas > 100 then raise exception 'personas_invalido'; end if;
  if nullif(trim(coalesce(p_nombre, '')), '') is null then raise exception 'nombre_requerido'; end if;
  if p_fecha < current_date then raise exception 'fecha_pasada'; end if;

  select config -> 'reservas' into v_cfg from locales where id = p_local;
  if v_cfg is null then raise exception 'local_no_existe'; end if;

  if p_personas > coalesce((v_cfg ->> 'maxPersonasOnline')::int, 12) then
    raise exception 'grupo_grande';  -- grupos grandes: por teléfono
  end if;
  if coalesce(v_cfg -> 'diasCerrados', '[]'::jsonb) @> to_jsonb(extract(dow from p_fecha)::int) then
    raise exception 'dia_cerrado';
  end if;

  v_dur := coalesce((v_cfg ->> 'duracionMin')::int, 90);

  -- aforo: el configurado, o la suma de plazas (de la zona si se indica)
  v_aforo := coalesce(
    nullif(v_cfg ->> 'aforo', '')::int,
    (select coalesce(sum(capacidad), 0) from mesas
     where local_id = p_local and (p_zona is null or zona = p_zona))
  );

  select coalesce(sum(personas), 0) into v_ocupado
  from reservas r
  where r.local_id = p_local and r.fecha = p_fecha
    and r.estado in ('confirmada', 'sentada')
    and (p_zona is null or r.zona = p_zona)
    and r.hora < p_hora + make_interval(mins => v_dur)
    and r.hora + make_interval(mins => v_dur) > p_hora;

  if v_ocupado + p_personas > v_aforo then raise exception 'sin_aforo'; end if;

  return query
  insert into reservas (local_id, fecha, hora, personas, nombre, email, telefono, zona, notas)
  values (p_local, p_fecha, p_hora, p_personas, trim(p_nombre),
          nullif(trim(coalesce(p_email, '')), ''), nullif(trim(coalesce(p_telefono, '')), ''),
          nullif(trim(coalesce(p_zona, '')), ''), left(coalesce(p_notas, ''), 300))
  returning id, reservas.token;
end $$;

-- Consulta la reserva por su token de autogestión (enlace del email).
create or replace function reserva_por_token(p_token text)
returns table (id uuid, fecha date, hora time, personas int, nombre text,
               zona text, notas text, estado text)
language sql security definer set search_path = public stable as $$
  select r.id, r.fecha, r.hora, r.personas, r.nombre, r.zona, r.notas, r.estado
  from reservas r where r.token = p_token
$$;

-- Cancela por token (autogestión del cliente).
create or replace function cancelar_reserva(p_token text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update reservas set estado = 'cancelada'
  where token = p_token and estado = 'confirmada';
  if not found then raise exception 'reserva_no_cancelable'; end if;
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- Permisos: qué puede llamar cada rol
-- ────────────────────────────────────────────────────────────────────────────

-- Por defecto nadie ejecuta nada…
revoke execute on all functions in schema public from public, anon, authenticated;

-- …las policies RLS evalúan local_actual() como el usuario que consulta:
grant execute on function local_actual() to anon, authenticated;

-- …el cliente anónimo (QR/reservas) SOLO sus RPC:
grant execute on function qr_unirse_mesa(uuid, text)                              to anon, authenticated;
grant execute on function qr_agregar_linea(uuid, uuid, text, jsonb, int, int)     to anon, authenticated;
grant execute on function qr_cambiar_cantidad(uuid, uuid, int)                    to anon, authenticated;
grant execute on function qr_confirmar_pedido(uuid)                               to anon, authenticated;
grant execute on function qr_llamar_camarero(uuid, text)                          to anon, authenticated;
grant execute on function qr_cancelar_aviso(uuid)                                 to anon, authenticated;
grant execute on function qr_pedir_cuenta(uuid)                                   to anon, authenticated;
grant execute on function crear_reserva(uuid, date, time, int, text, text, text, text, text) to anon, authenticated;
grant execute on function reserva_por_token(text)                                 to anon, authenticated;
grant execute on function cancelar_reserva(text)                                  to anon, authenticated;

-- …y el personal autenticado, las de servicio:
grant execute on function verificar_pin(text, boolean)         to authenticated;
grant execute on function fijar_pin(uuid, text)                to authenticated;
grant execute on function pagar_parte(uuid, numeric, text, text) to authenticated;
grant execute on function cobrar_mesa(uuid, jsonb, numeric, text, numeric) to authenticated;
grant execute on function agrupar_mesas(uuid, uuid)            to authenticated;
grant execute on function separar_mesas(uuid)                  to authenticated;
grant execute on function marchar_siguiente(uuid)              to authenticated;
grant execute on function anular_linea(uuid, text, text)       to authenticated;
