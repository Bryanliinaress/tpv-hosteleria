-- ============================================================================
-- TPV Hostelería · Migración 05: config pública del local para el cliente QR
--
-- El cliente anónimo (carta QR / reservas) necesita la identidad y config del
-- local (nombre, moneda, formatos de carta, turnos de reserva) pero `locales`
-- no es legible por anon (contiene la config completa de TODOS los locales).
-- RPC dirigida: dado una mesa (QR) devuelve SOLO lo público de SU local; sin
-- mesa, funciona si el proyecto tiene un único local (fase actual).
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
    -- identidad visible al cliente + configuración de carta y reservas
    'config', (v_local.config - 'cif' - 'telefono') || jsonb_build_object(
      'reservas', coalesce(v_local.config -> 'reservas', '{}'::jsonb),
      'carta',    coalesce(v_local.config -> 'carta', '{}'::jsonb))
  );
end $$;

grant execute on function config_publica(uuid) to anon, authenticated;
