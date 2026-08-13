-- ────────────────────────────────────────────────────────────────────────────
-- 22. Dispositivos autorizados por el encargado.
--
-- Hasta ahora, conectar un aparato pedía el correo y la contraseña del local.
-- En un TPV que se monta bar por bar eso es una credencial que alguien tiene
-- que custodiar y acabar olvidando — pasó: nadie recordaba cuál era.
--
-- El modelo nuevo se parece a como funciona un bar de verdad: el aparato pide
-- permiso, y el encargado se lo da desde su panel. Una vez dado, lo tiene para
-- siempre (sesión normal, con su refresco), y el encargado puede quitárselo
-- cuando quiera — que es lo que faltaba: hasta ahora una tablet perdida seguía
-- entrando indefinidamente.
--
-- Cada dispositivo autorizado acaba teniendo SU PROPIA cuenta de Supabase, que
-- crea el servidor al aprobarlo (ver la Edge Function `canjear-dispositivo`).
-- Compartir una sola cuenta haría que revocar un aparato echara a todos.
--
-- Lo que NO viaja al cliente: el secreto se guarda hasheado, igual que un PIN.
-- El código de 6 dígitos es solo para que dos personas se entiendan en voz
-- alta; lo que autentica es el secreto, que solo tiene el aparato.
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists dispositivos (
  id           uuid primary key default gen_random_uuid(),
  local_id     uuid not null references locales on delete cascade,
  nombre       text not null default 'Dispositivo',
  codigo       text not null,                    -- 6 dígitos, para leerlo en voz alta
  secreto_hash text not null,                    -- lo que autentica de verdad
  estado       text not null default 'pendiente'
               check (estado in ('pendiente', 'aprobado', 'revocado')),
  user_id      uuid,                             -- su cuenta, al aprobarlo
  creado_en    timestamptz not null default now(),
  aprobado_en  timestamptz,
  ultimo_uso   timestamptz
);
create index if not exists dispositivos_local on dispositivos (local_id, estado);
create unique index if not exists dispositivos_codigo_vivo
  on dispositivos (local_id, codigo) where estado = 'pendiente';

alter table dispositivos enable row level security;

-- El personal ve y gestiona los de SU local. El cliente anónimo, nada:
-- todo lo suyo pasa por las RPC de abajo, que solo miran su propia fila.
drop policy if exists dispositivos_tenant on dispositivos;
create policy dispositivos_tenant on dispositivos for all to authenticated
  using (local_id = local_actual()) with check (local_id = local_actual());

-- ── El aparato pide permiso ─────────────────────────────────────────────────
-- Devuelve el código (para enseñarlo) y el secreto (para guardárselo). El
-- secreto no se puede volver a consultar: si se pierde, se pide otra vez.
create or replace function solicitar_dispositivo(p_mesa uuid, p_nombre text default null)
returns table (codigo text, secreto text)
-- `extensions` porque ahí viven crypt/gen_salt/gen_random_bytes en Supabase:
-- con `search_path = public` a secas, la función se crea y revienta al usarla.
-- Ya pasó con `verificar_pin` (migración 06).
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_local uuid;
  v_codigo text;
  v_secreto text := encode(gen_random_bytes(32), 'hex');
begin
  -- El local se deduce de una mesa, que es lo único que un aparato sin sesión
  -- conoce (va en la URL del QR). Así no hace falta que nadie lo teclee.
  select local_id into v_local from mesas where id = p_mesa;
  if v_local is null then raise exception 'mesa_no_existe'; end if;

  -- Se caducan las solicitudes viejas para que no se acumulen códigos vivos
  delete from dispositivos
   where local_id = v_local and estado = 'pendiente' and creado_en < now() - interval '1 hour';

  -- Ojo con cualificar las columnas: `codigo` y `secreto` son también los
  -- parámetros de salida de esta función, y sin el alias Postgres no sabe a
  -- cuál te refieres («column reference is ambiguous»).
  loop
    v_codigo := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (
      select 1 from dispositivos d
       where d.local_id = v_local and d.codigo = v_codigo and d.estado = 'pendiente');
  end loop;

  insert into dispositivos (local_id, nombre, codigo, secreto_hash)
  values (v_local, coalesce(nullif(btrim(p_nombre), ''), 'Dispositivo'),
          v_codigo, crypt(v_secreto, gen_salt('bf')));

  return query select v_codigo, v_secreto;
end $$;

-- ── El aparato pregunta si ya le han dado permiso ───────────────────────────
-- Solo dice el estado. El canje de la sesión lo hace la Edge Function, que es
-- quien puede crear cuentas.
create or replace function estado_dispositivo(p_secreto text)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v_estado text;
begin
  select estado into v_estado from dispositivos
   where secreto_hash = crypt(p_secreto, secreto_hash)
   limit 1;
  return coalesce(v_estado, 'desconocido');
end $$;

-- ── El encargado, desde su panel ────────────────────────────────────────────
create or replace function dispositivos_del_local()
returns table (id uuid, nombre text, codigo text, estado text,
               creado_en timestamptz, aprobado_en timestamptz, ultimo_uso timestamptz)
language sql security definer set search_path = public stable as $$
  select d.id, d.nombre,
         case when d.estado = 'pendiente' then d.codigo else null end,
         d.estado, d.creado_en, d.aprobado_en, d.ultimo_uso
    from dispositivos d
   where d.local_id = local_actual()
   order by (d.estado = 'pendiente') desc, d.creado_en desc
$$;

-- Autorizar y revocar exigen ser ADMIN: dar acceso al TPV no es cosa de
-- cualquier camarero que tenga la tablet a mano.
create or replace function _soy_admin() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from empleados
     where local_id = local_actual() and user_id = auth.uid() and rol = 'admin')
$$;

create or replace function aprobar_dispositivo(p_id uuid, p_nombre text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not _soy_admin() then raise exception 'solo_admin'; end if;
  update dispositivos
     set estado = 'aprobado',
         aprobado_en = now(),
         nombre = coalesce(nullif(btrim(p_nombre), ''), nombre)
   where id = p_id and local_id = local_actual() and estado = 'pendiente';
  if not found then raise exception 'dispositivo_no_existe'; end if;
end $$;

create or replace function revocar_dispositivo(p_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  if not _soy_admin() then raise exception 'solo_admin'; end if;
  update dispositivos set estado = 'revocado'
   where id = p_id and local_id = local_actual()
   returning user_id into v_user;
  if not found then raise exception 'dispositivo_no_existe'; end if;
  -- El que llama se encarga de tirar también su cuenta (hace falta service_role)
  return v_user;
end $$;

-- ── Permisos ────────────────────────────────────────────────────────────────
-- El aparato sin sesión solo puede pedir permiso y preguntar por el suyo.
grant execute on function solicitar_dispositivo(uuid, text) to anon, authenticated;
grant execute on function estado_dispositivo(text)          to anon, authenticated;
grant execute on function dispositivos_del_local()          to authenticated;
grant execute on function aprobar_dispositivo(uuid, text)   to authenticated;
grant execute on function revocar_dispositivo(uuid)         to authenticated;

-- Y ahora quitarles a `anon` lo que Supabase les concede por su cuenta al
-- crearlas. Sin esto, `aprobar_dispositivo` quedaba al alcance de cualquiera
-- con la carta abierta: se autorizaba su propio aparato y entraba al TPV.
-- No es hipotético — lo cazó `npm run permisos` en esta misma migración,
-- antes de subirla.
revoke all on function dispositivos_del_local()        from public, anon;
revoke all on function aprobar_dispositivo(uuid, text) from public, anon;
revoke all on function revocar_dispositivo(uuid)       from public, anon;
grant execute on function dispositivos_del_local()        to authenticated;
grant execute on function aprobar_dispositivo(uuid, text) to authenticated;
grant execute on function revocar_dispositivo(uuid)       to authenticated;

-- Internas: el permiso llega solo al crearlas, así que hay que quitarlo.
revoke all on function _soy_admin() from public, anon, authenticated;
