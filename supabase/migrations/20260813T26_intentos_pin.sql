-- ────────────────────────────────────────────────────────────────────────────
-- 26. Bloquear el PIN tras varios fallos seguidos.
--
-- Un PIN son 4 dígitos: 10.000 combinaciones. Desde un dispositivo YA
-- autorizado —el propio personal, o quien coja la tablet de la barra— se
-- pueden probar todas en un rato. Y ahora pesa más que antes: con dispositivos
-- autorizados, el PIN de encargado es lo que permite dar acceso al TPV a un
-- aparato nuevo.
--
-- Se cuenta por DISPOSITIVO (auth.uid()), no por local: bloquear el local
-- entero dejaría al bar sin cobrar por culpa de una tablet, que es peor que el
-- problema que se quiere evitar.
--
-- Nunca se guarda el PIN probado, ni entero ni troceado: solo si acertó.
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists intentos_pin (
  id        bigserial primary key,
  local_id  uuid not null references locales on delete cascade,
  quien     uuid,                       -- la cuenta del dispositivo
  acierto   boolean not null,
  creado_en timestamptz not null default now()
);
create index if not exists intentos_pin_quien on intentos_pin (quien, creado_en desc);

alter table intentos_pin enable row level security;
-- Nadie la lee desde el cliente: solo la escribe `verificar_pin`, que es
-- `security definer`. Sin políticas, RLS lo niega todo, que es lo que se busca.

-- ── Cuántos fallos seguidos lleva este dispositivo ──────────────────────────
create or replace function _fallos_recientes(p_quien uuid)
returns int
language sql security definer set search_path = public stable as $$
  select count(*)::int
    from intentos_pin
   where quien = p_quien
     and creado_en > now() - interval '5 minutes'
     and not acierto
     -- solo los POSTERIORES al último acierto: entrar bien limpia la cuenta
     and creado_en > coalesce(
       (select max(creado_en) from intentos_pin
         where quien = p_quien and acierto), '-infinity'::timestamptz)
$$;

-- ── verificar_pin, ahora con memoria ────────────────────────────────────────
create or replace function verificar_pin(p_pin text, p_solo_admin boolean default false)
returns table (id uuid, nombre text, rol text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_local uuid := _local_o_error();
  v_quien uuid := auth.uid();
  v_fallos int := _fallos_recientes(v_quien);
  v_encontrado boolean := false;
begin
  -- 5 fallos seguidos: se para 5 minutos. Suficiente para que probar los
  -- 10.000 PINs deje de ser cuestión de un rato, y poco para quien se ha
  -- equivocado de verdad.
  if v_fallos >= 5 then
    raise exception 'pin_bloqueado';
  end if;

  return query
    select e.id, e.nombre, e.rol from empleados e
    where e.local_id = v_local
      and e.activo
      and e.pin_hash is not null
      and e.pin_hash = crypt(p_pin, e.pin_hash)
      and (not p_solo_admin or e.rol = 'admin')
    limit 1;

  get diagnostics v_encontrado = row_count;
  insert into intentos_pin (local_id, quien, acierto) values (v_local, v_quien, v_encontrado > 0);

  -- limpieza perezosa: no hace falta guardar esto más de un día
  delete from intentos_pin where creado_en < now() - interval '1 day';
end $$;

revoke all on function _fallos_recientes(uuid) from public, anon, authenticated;
grant execute on function verificar_pin(text, boolean) to authenticated;
revoke all on function verificar_pin(text, boolean) from public, anon;
