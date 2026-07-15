-- ============================================================================
-- TPV Hostelería · Migración 03: realtime + lectura del cliente QR
--
-- 1) Publicación realtime: las tablas de servicio emiten cambios (sin esto
--    las suscripciones de lib/repo.js no reciben nada).
-- 2) `estado_mesa`: el cliente anónimo del QR necesita ver SU mesa (comensales,
--    líneas, estado de comandas, avisos) sin abrir las tablas enteras a anon
--    (los nombres de comensales de otros locales no deben ser públicos).
--    Una llamada = un JSON con todo; el front la usa al cargar y tras cada
--    evento realtime de su mesa.
-- ============================================================================

-- ── 1. Realtime ─────────────────────────────────────────────────────────────
-- (idempotente: añadir una tabla ya publicada da error, por eso el bucle)
do $$
declare t text;
begin
  foreach t in array array['mesas','comensales','lineas_pedido','comandas','avisos','reservas']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;

-- Los eventos UPDATE/DELETE de realtime necesitan replica identity para llevar
-- la fila anterior (filtrado por local_id en el cliente).
alter table mesas          replica identity full;
alter table comensales     replica identity full;
alter table lineas_pedido  replica identity full;
alter table comandas       replica identity full;
alter table avisos         replica identity full;
alter table reservas       replica identity full;

-- ── 2. Estado de la mesa para el cliente QR ─────────────────────────────────
create or replace function estado_mesa(p_mesa uuid)
returns jsonb
language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'mesa', (select jsonb_build_object(
        'id', m.id, 'numero', m.numero, 'estado', m.estado,
        'abiertaDesde', m.abierta_desde, 'unidaA', m.unida_a)
      from mesas m where m.id = p_mesa),
    'comensales', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'nombre', c.nombre, 'pagado', c.pagado,
        'items', (select coalesce(jsonb_agg(jsonb_build_object(
            'id', l.id, 'nombre', l.nombre, 'precio', l.precio,
            'cantidad', l.cantidad, 'tipo', l.tipo, 'estado', l.estado,
            'tiempo', l.tiempo, 'personalizacion', l.personalizacion,
            -- estado de preparación de la comanda de esta línea (si se envió)
            'preparacion', (select k.estado from comandas k where k.linea_id = l.id limit 1)
          ) order by l.creado_en), '[]'::jsonb)
          from lineas_pedido l where l.comensal_id = c.id)
      ) order by c.creado_en), '[]'::jsonb)
      from comensales c where c.mesa_id = any(_grupo_de(p_mesa))),
    'avisoActivo', exists (select 1 from avisos a where a.mesa_id = p_mesa)
  )
$$;

grant execute on function estado_mesa(uuid) to anon, authenticated;
