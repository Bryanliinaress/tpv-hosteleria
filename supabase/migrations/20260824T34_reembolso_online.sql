-- ────────────────────────────────────────────────────────────────────────────
-- Devolver de verdad un cobro hecho con tarjeta.
--
-- El agujero: se podía emitir la rectificativa de un ticket pagado por Stripe,
-- pero el dinero NO volvía a la tarjeta del cliente. Y encima la devolución se
-- apuntaba como efectivo, así que el arqueo de esa noche cantaba un faltante de
-- caja que no existía —de ese cajón no había salido nada—.
--
-- Aquí va la parte de base de datos. Deshacer el cobro lo hace Stripe, y eso
-- vive en la Edge Function `devolver-pago` (la clave secreta no puede estar en
-- ningún otro sitio).
--
-- DE PASO SE ARREGLA UN FALLO DE RAÍZ: `pagos_online.ticket` solo se rellenaba
-- en el cobro que CERRABA la mesa. Si tres comensales pagaban su parte por el
-- móvil, dos quedaban con `ticket = null` —indistinguibles de un cobro
-- huérfano— y era imposible saber qué tarjetas había detrás de un ticket. Sin
-- eso no hay forma de devolver a las correctas.
-- ────────────────────────────────────────────────────────────────────────────

-- Cuánto se ha devuelto ya de cada cobro: impide devolver dos veces la misma
-- tarjeta, que es dinero regalado.
alter table pagos_online add column if not exists devuelto numeric(10,2) not null default 0;

-- Estado del reembolso de una rectificativa. Mismo patrón que el registro
-- fiscal: la devolución nunca se bloquea por esto; queda pendiente y se
-- reintenta, pero SE VE que el dinero aún no ha vuelto.
alter table tickets add column if not exists reembolso_estado text;
alter table tickets add column if not exists reembolso_error text;
alter table tickets add column if not exists reembolso_ref text;
do $$ begin
  alter table tickets add constraint tickets_reembolso_estado
    check (reembolso_estado is null or reembolso_estado in ('pendiente', 'hecho', 'error'));
exception when duplicate_object then null; end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- Que TODOS los cobros de una mesa queden atados a su ticket, no solo el último
--
-- Se parte de la versión viva y se le añade SOLO eso: el resto —el cobro
-- sobrante cuando la cuenta ya estaba saldada, y el cobro que no llega a cubrir
-- lo que se debe— sigue exactamente igual. Reescribirlo entero habría borrado
-- las dos cosas sin que nadie se enterase hasta que faltara dinero.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function registrar_pago_online(
  p_mesa uuid, p_comensal uuid, p_importe numeric, p_propina numeric,
  p_referencia text, p_local uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_local uuid;
  v_grupo uuid[];
  v_ticket bigint;
  v_pendiente numeric;
  v_cerrada boolean := false;
  v_abierta timestamptz;
begin
  -- idempotencia: si ya procesamos este pago, devolvemos lo mismo sin repetir
  if exists (select 1 from pagos_online where referencia = p_referencia) then
    select ticket into v_ticket from pagos_online where referencia = p_referencia limit 1;
    return jsonb_build_object('repetido', true, 'ticket', v_ticket);
  end if;

  select local_id into v_local from mesas where id = p_mesa;
  if v_local is null then raise exception 'mesa_no_existe'; end if;

  v_pendiente := pendiente_de_pago(p_mesa, p_comensal);

  -- Nadie debe nada: la cuenta ya se saldó (otro comensal se adelantó, o el
  -- camarero cobró en efectivo). El dinero entró, así que se guarda, pero no
  -- hay cuenta que cerrar ni ticket que emitir.
  if coalesce(v_pendiente, 0) <= 0 then
    insert into pagos_online (local_id, mesa_id, comensal_id, importe, propina, referencia, ticket)
    values (v_local, p_mesa, p_comensal, p_importe, coalesce(p_propina, 0), p_referencia, null);
    return jsonb_build_object('sobrante', true, 'importe', p_importe);
  end if;

  -- ¿el dinero que ha entrado cubre lo que se debía? La propina no cuenta:
  -- es un extra, no parte de la cuenta. Si no llega, el pago se registra
  -- igualmente (el dinero está cobrado) pero la cuenta NO se da por saldada.
  if coalesce(p_importe, 0) - coalesce(p_propina, 0) + 0.01 < v_pendiente then
    insert into pagos_online (local_id, mesa_id, comensal_id, importe, propina, referencia, ticket)
    values (v_local, p_mesa, p_comensal, p_importe, coalesce(p_propina, 0), p_referencia, null);
    return jsonb_build_object(
      'insuficiente', true,
      'pendiente', round(v_pendiente - (coalesce(p_importe, 0) - coalesce(p_propina, 0)), 2));
  end if;

  -- Se guarda ANTES de cerrar: al cerrar se pone a null, y hace falta para
  -- distinguir los cobros de ESTE servicio de los de uno anterior de la misma
  -- mesa (los ids de mesa se reutilizan siempre).
  v_grupo := _grupo_de(p_mesa);
  select m.abierta_desde into v_abierta from mesas m where m.id = v_grupo[1];

  if p_comensal is not null then
    update comensales
      set pagado = true, propina = coalesce(p_propina, 0),
          metodo_pago = 'online', cobrado_por = 'Pago online'
      where id = p_comensal and mesa_id = any(_grupo_de(p_mesa));
    v_grupo := _grupo_de(p_mesa);
    if not exists (select 1 from comensales where mesa_id = any(v_grupo) and not pagado) then
      v_ticket := _cerrar_grupo(v_grupo, coalesce(p_propina, 0),
                                jsonb_build_object('online', p_importe), 'Pago online', 'Pago online');
      v_cerrada := true;
    end if;
  else
    v_grupo := _grupo_de(p_mesa);
    v_ticket := _cerrar_grupo(v_grupo, coalesce(p_propina, 0),
                              jsonb_build_object('online', p_importe), 'Pago online', 'Pago online');
    v_cerrada := true;
  end if;

  insert into pagos_online (local_id, mesa_id, comensal_id, importe, propina, referencia, ticket)
  values (v_local, p_mesa, p_comensal, p_importe, coalesce(p_propina, 0), p_referencia, v_ticket);

  -- Si este cobro ha cerrado la mesa, los de los demás comensales de ESTE
  -- servicio son del mismo ticket: se atan también. Antes se quedaban con
  -- `ticket = null` y parecían cobros huérfanos.
  if v_cerrada and v_ticket is not null then
    update pagos_online
       set ticket = v_ticket
     where mesa_id = any(v_grupo)
       and ticket is null
       and local_id = v_local
       and (v_abierta is null or creado_en >= v_abierta);
  end if;

  return jsonb_build_object('cerrada', v_cerrada, 'ticket', v_ticket);
end $$;

revoke all on function registrar_pago_online(uuid, uuid, numeric, numeric, text, uuid)
  from public, anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- Los cobros con tarjeta que hay detrás de un ticket y cuánto queda por
-- devolver de cada uno. Solo del local que llama.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function pagos_devolubles(p_numero bigint)
returns table (id uuid, referencia text, disponible numeric)
language sql security definer set search_path = public stable as $$
  select p.id, p.referencia, round(p.importe + p.propina - p.devuelto, 2)
    from pagos_online p
   where p.local_id = _local_o_error()
     and p.ticket = p_numero
     and round(p.importe + p.propina - p.devuelto, 2) > 0
   order by p.creado_en
$$;
revoke all on function pagos_devolubles(bigint) from public, anon, authenticated;

-- La misma consulta para la Edge Function, que va con `service_role` y no tiene
-- sesión de la que sacar el local: se lo pasa explícito. Solo servidor.
create or replace function pagos_devolubles_de(p_local uuid, p_numero bigint)
returns table (id uuid, referencia text, disponible numeric)
language sql security definer set search_path = public stable as $$
  select p.id, p.referencia, round(p.importe + p.propina - p.devuelto, 2)
    from pagos_online p
   where p.local_id = p_local
     and p.ticket = p_numero
     and round(p.importe + p.propina - p.devuelto, 2) > 0
   order by p.creado_en
$$;
revoke all on function pagos_devolubles_de(uuid, bigint) from public, anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- Anotar cómo fue el reembolso. La llama la Edge Function con service_role.
-- `p_reparto` es [{pago, importe}]: lo devuelto de cada cobro, para que no se
-- pueda devolver dos veces la misma tarjeta.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function anotar_reembolso(
  p_rectificativa uuid, p_estado text,
  p_ref text default null, p_error text default null, p_reparto jsonb default '[]'::jsonb
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_estado not in ('pendiente', 'hecho', 'error') then
    raise exception 'estado_invalido';
  end if;

  update tickets
     set reembolso_estado = p_estado,
         reembolso_ref = coalesce(p_ref, reembolso_ref),
         reembolso_error = left(p_error, 300)
   where id = p_rectificativa and rectifica_a is not null;

  if p_estado = 'hecho' then
    update pagos_online p
       set devuelto = round(p.devuelto + (x ->> 'importe')::numeric, 2)
      from jsonb_array_elements(coalesce(p_reparto, '[]'::jsonb)) x
     where p.id = (x ->> 'pago')::uuid;
  end if;
end $$;
revoke all on function anotar_reembolso(uuid, text, text, text, jsonb) from public, anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- Las rectificativas de un cobro con tarjeta nacen «pendientes» de reembolso:
-- así se ve que el dinero todavía no ha vuelto, en vez de darlo por hecho.
--
-- Cambia el tipo de retorno (añade `reembolso`), así que hay que tirarla antes:
-- `create or replace` no puede cambiarlo.
-- ────────────────────────────────────────────────────────────────────────────
drop function if exists emitir_rectificativa(uuid, text, numeric, text, text);

create function emitir_rectificativa(
  p_ticket uuid,
  p_motivo text,
  p_importe numeric default null,
  p_metodo text default 'efectivo',
  p_por text default null
) returns table (id uuid, numero bigint, total numeric, reembolso text)
language plpgsql security definer set search_path = public as $$
declare
  v_local uuid := _local_o_error();
  v_orig tickets%rowtype;
  v_pendiente numeric;
  v_importe numeric;
  v_detalle jsonb;
  v_metodo text := coalesce(nullif(btrim(p_metodo), ''), 'efectivo');
  v_reembolso text := null;
  v_devoluble numeric;
  v_nuevo tickets%rowtype;
begin
  if coalesce(btrim(p_motivo), '') = '' then
    raise exception 'motivo_obligatorio';
  end if;

  -- Se bloquea el original: dos devoluciones a la vez del mismo ticket podrían
  -- devolver cada una el total entero.
  select * into v_orig from tickets t
   where t.id = p_ticket and t.local_id = v_local
     for update;
  if not found then raise exception 'ticket_no_existe'; end if;
  if v_orig.rectifica_a is not null then raise exception 'ya_es_rectificativa'; end if;

  v_pendiente := _pendiente_de_rectificar(p_ticket);
  v_importe := round(coalesce(p_importe, v_pendiente), 2);

  if v_importe <= 0 then raise exception 'importe_invalido'; end if;
  if v_importe > v_pendiente then raise exception 'supera_lo_pendiente'; end if;

  -- Devolver a la tarjeta exige que haya cobros con tarjeta detrás y que
  -- lleguen. Si no, se estaría prometiendo un reembolso que Stripe no puede
  -- hacer y el cliente se iría creyendo que ya tiene su dinero.
  if v_metodo = 'online' then
    select coalesce(sum(d.disponible), 0) into v_devoluble from pagos_devolubles(v_orig.numero) d;
    if v_devoluble < v_importe then raise exception 'sin_cobro_online_suficiente'; end if;
    v_reembolso := 'pendiente';
  end if;

  with base as (
    select d.iva_pct as iva_pct, d.total as total,
           row_number() over (order by d.iva_pct) as orden,
           sum(d.total) over () as suma
      from desglose_iva_ticket(p_ticket) d
     where d.total <> 0
  ), repartido as (
    -- Reparto proporcional con los céntimos cuadrados: cada parte es la
    -- diferencia entre dos acumulados YA redondeados.
    --
    -- Ojo con cualificar `base.total`: `total` es también un parámetro de
    -- SALIDA de esta función («column reference "total" is ambiguous»).
    select base.iva_pct,
           round(v_importe * (sum(base.total) over (order by base.orden rows unbounded preceding)) / base.suma, 2)
             - round(v_importe * (coalesce(sum(base.total) over (order by base.orden rows between unbounded preceding and 1 preceding), 0)) / base.suma, 2)
             as parte
      from base
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'nombre', 'Devolución (IVA ' || repartido.iva_pct || '%)',
           'precio', -repartido.parte, 'cantidad', 1, 'tipo', 'comida',
           'ivaPct', repartido.iva_pct)), '[]'::jsonb)
    into v_detalle
    from repartido where repartido.parte <> 0;

  insert into tickets (
    local_id, mesa_numero, total, propina, pagos, detalle, camarero, cobrado_por,
    rectifica_a, motivo_rectificacion, reembolso_estado
  ) values (
    v_local, v_orig.mesa_numero, -v_importe, 0,
    -- El método sale de cómo se cobró: apuntar como efectivo la devolución de
    -- una tarjeta descuadra el arqueo de esa noche.
    jsonb_build_object(v_metodo, -v_importe),
    jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid(), 'nombre', 'Devolución', 'pagado', true,
      'propina', 0, 'metodoPago', v_metodo, 'cobradoPor', p_por,
      'items', v_detalle)),
    v_orig.camarero, p_por, p_ticket, left(btrim(p_motivo), 300), v_reembolso
  ) returning * into v_nuevo;

  -- Queda registrado en la auditoría de anulaciones, que es donde el encargado
  -- ya mira cuando algo no cuadra.
  insert into anulaciones (local_id, nombre, precio, cantidad, motivo, por)
  values (v_local,
          'Rectificativa del ticket ' || v_orig.numero,
          -v_importe, 1, left(btrim(p_motivo), 300), p_por);

  return query select v_nuevo.id, v_nuevo.numero, v_nuevo.total, v_nuevo.reembolso_estado;
end $$;

revoke all on function emitir_rectificativa(uuid, text, numeric, text, text) from public, anon, authenticated;
-- La emite el personal desde Admin. `anon` NO: es dinero saliendo del cajón.
grant execute on function emitir_rectificativa(uuid, text, numeric, text, text) to authenticated;

-- Qué reembolsos quedaron a medias, para poder reintentarlos desde Admin.
create or replace function reembolsos_pendientes()
returns table (id uuid, numero bigint, total numeric, estado text, error text, cuando timestamptz)
language sql security definer set search_path = public stable as $$
  select t.id, t.numero, t.total, t.reembolso_estado, t.reembolso_error, t.cerrado_en
    from tickets t
   where t.local_id = _local_o_error()
     and t.reembolso_estado in ('pendiente', 'error')
   order by t.cerrado_en desc
$$;
revoke all on function reembolsos_pendientes() from public, anon, authenticated;
grant execute on function reembolsos_pendientes() to authenticated;
