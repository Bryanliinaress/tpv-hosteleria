-- ============================================================================
-- TPV Hostelería · Migración 09: el NIF y el teléfono SÍ son públicos
--
-- `config_publica` (migración 05) ocultaba `cif` y `telefono` por prudencia,
-- pero son datos que van impresos en CUALQUIER factura o ticket: sin ellos el
-- ticket del cliente no cumple. Lo que sí queda fuera es la configuración
-- interna (personal, PINes…), que nunca ha estado en `config`.
-- ============================================================================
create or replace function config_publica(p_mesa uuid default null)
returns jsonb
language plpgsql security definer set search_path = public stable as $$
declare v_local locales%rowtype;
begin
  if p_mesa is not null then
    select l.* into v_local from locales l
    join mesas m on m.local_id = l.id where m.id = p_mesa;
  elsif (select count(*) from locales) = 1 then
    select l.* into v_local from locales l;
  end if;
  if v_local.id is null then return null; end if;
  return jsonb_build_object(
    'localId', v_local.id,
    'nombre', v_local.nombre,
    'slug', v_local.slug,
    -- identidad completa del emisor (la que se imprime en el ticket)
    'config', v_local.config || jsonb_build_object(
      'reservas', coalesce(v_local.config -> 'reservas', '{}'::jsonb),
      'carta',    coalesce(v_local.config -> 'carta', '{}'::jsonb))
  );
end $$;

grant execute on function config_publica(uuid) to anon, authenticated;
