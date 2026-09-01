-- ───────────────────────────────────────────────────────────────────────────
-- Que un ticket que ya NO puede registrarse en Hacienda deje rastro.
--
-- Verifacti exige que `fecha_expedicion` sea la del día: un ticket que falla y
-- no se reintenta esa misma jornada no entra nunca. Hasta ahora eso solo se
-- veía abriendo Admin → Tickets, es decir, si alguien miraba.
--
-- El vigilante (scripts/lib/vigilante.mjs) reintenta lo del día y, cuando
-- encuentra tickets de jornadas anteriores sin registrar, lo anota con esta
-- clase para que `npm run salud` lo cante junto a lo demás.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function registrar_incidencia(
  p_clase text, p_mensaje text, p_pantalla text default null, p_version text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_local uuid;
  v_hoy int;
begin
  if coalesce(btrim(p_mensaje), '') = '' then return; end if;
  if p_clase not in ('render', 'js', 'promesa', 'cola', 'impresora', 'fiscal') then return; end if;

  v_local := local_actual();
  if v_local is null then select id into v_local from locales order by creado_en limit 1; end if;
  if v_local is null then return; end if;

  select count(*) into v_hoy from incidencias
   where local_id = v_local and ultima > now() - interval '1 day';
  if v_hoy >= 200 then return; end if;

  insert into incidencias (local_id, clase, mensaje, pantalla, version)
  values (v_local, p_clase, left(btrim(p_mensaje), 300), left(p_pantalla, 80), left(p_version, 20))
  on conflict (local_id, clase, mensaje, coalesce(pantalla, ''))
  do update set veces = incidencias.veces + 1, ultima = now();
end $$;

-- Supabase concede EXECUTE a anon y authenticated al reemplazar una función:
-- se deja exactamente como estaba (abierta a anon a propósito, ver 20260824T30).
revoke all on function registrar_incidencia(text, text, text, text) from public;
grant execute on function registrar_incidencia(text, text, text, text) to anon, authenticated;
