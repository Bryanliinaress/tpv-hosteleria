-- ────────────────────────────────────────────────────────────────────────────
-- 23. Las tres piezas que solo usa el servidor al canjear un dispositivo.
--
-- Las llama la Edge Function `canjear-dispositivo` con la service_role key.
-- Ninguna puede quedar al alcance del cliente: `dispositivo_por_secreto`
-- devuelve el local y la cuenta de un aparato, y `vincular_dispositivo_usuario`
-- decide qué cuenta manda en él.
-- ────────────────────────────────────────────────────────────────────────────

-- Busca el dispositivo por su secreto (que se guarda hasheado, como un PIN) y
-- devuelve lo que la función necesita para darle su sesión.
create or replace function dispositivo_por_secreto(p_secreto text)
returns table (id uuid, local_id uuid, nombre text, estado text, user_id uuid, email text)
-- `extensions`: ahí vive crypt() en Supabase (ver migración 06)
language sql security definer set search_path = public, extensions stable as $$
  select d.id, d.local_id, d.nombre, d.estado, d.user_id, u.email::text
    from dispositivos d
    left join auth.users u on u.id = d.user_id
   where d.secreto_hash = crypt(p_secreto, d.secreto_hash)
   limit 1
$$;

-- Ata el dispositivo a la cuenta que le acaba de crear el servidor.
create or replace function vincular_dispositivo_usuario(p_id uuid, p_user uuid)
returns void
language sql security definer set search_path = public as $$
  update dispositivos set user_id = p_user, ultimo_uso = now() where id = p_id
$$;

-- Última vez que entró: para que el encargado vea cuál lleva meses sin usarse
-- y pueda quitarlo sin miedo.
create or replace function dispositivo_visto(p_id uuid)
returns void
language sql security definer set search_path = public as $$
  update dispositivos set ultimo_uso = now() where id = p_id
$$;

revoke all on function dispositivo_por_secreto(text)          from public, anon, authenticated;
revoke all on function vincular_dispositivo_usuario(uuid, uuid) from public, anon, authenticated;
revoke all on function dispositivo_visto(uuid)                from public, anon, authenticated;
grant execute on function dispositivo_por_secreto(text)          to service_role;
grant execute on function vincular_dispositivo_usuario(uuid, uuid) to service_role;
grant execute on function dispositivo_visto(uuid)                to service_role;
