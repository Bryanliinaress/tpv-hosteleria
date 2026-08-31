-- ───────────────────────────────────────────────────────────────────────────
-- Que una impresora que no imprime deje rastro.
--
-- `registrar_incidencia` solo admitía fallos de la pantalla ('render', 'js',
-- 'promesa', 'cola'). La impresión no tenía dónde quejarse, y por eso pudo
-- estar del 12 al 28 de agosto de 2026 sin sacar un solo papel mientras el log
-- escribía «🖨 impresa» en cada comanda: nueve trabajos muertos en la cola de
-- Windows y ni un aviso en ninguna pantalla.
--
-- Con la clase 'impresora', el servicio de impresión registra el fallo y
-- `npm run salud` lo saca junto a lo demás que se haya roto. En un bar, que la
-- cocina se quede sin comandas tiene que verse el mismo día, no cuando alguien
-- pregunta por un plato que nunca se pidió.
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
  if p_clase not in ('render', 'js', 'promesa', 'cola', 'impresora') then return; end if;

  -- Con sesión, el local sale del JWT; sin ella (cliente del QR, o el servicio
  -- de impresión con la clave de servicio) se usa el único del proyecto, que es
  -- el modelo de este producto: un bar, una instalación.
  v_local := local_actual();
  if v_local is null then select id into v_local from locales order by creado_en limit 1; end if;
  if v_local is null then return; end if;

  -- Tope diario por local: si algo se rompe en bucle, que no se coma la base.
  -- Se cuenta sobre incidencias DISTINTAS, no sobre repeticiones (esas se
  -- agrupan solas), así que 200 al día ya es una mañana muy mala.
  select count(*) into v_hoy from incidencias
   where local_id = v_local and ultima > now() - interval '1 day';
  if v_hoy >= 200 then return; end if;

  insert into incidencias (local_id, clase, mensaje, pantalla, version)
  values (v_local, p_clase, left(btrim(p_mensaje), 300), left(p_pantalla, 80), left(p_version, 20))
  on conflict (local_id, clase, mensaje, coalesce(pantalla, ''))
  do update set veces = incidencias.veces + 1, ultima = now();
end $$;

-- Supabase concede EXECUTE a anon y authenticated en cuanto se reemplaza una
-- función: se vuelve a dejar exactamente como estaba (abierta a anon a
-- propósito, ver la migración 20260824T30).
revoke all on function registrar_incidencia(text, text, text, text) from public;
grant execute on function registrar_incidencia(text, text, text, text) to anon, authenticated;
