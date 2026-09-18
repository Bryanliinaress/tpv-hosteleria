-- ────────────────────────────────────────────────────────────────────────────
-- 54. Quién es el responsable, para la página de privacidad.
--
-- El art. 13 del RGPD obliga a identificar al responsable del tratamiento —
-- nombre, NIF, dirección y una forma de contacto — ANTES de pedirle datos a
-- nadie. La página `/privacidad` es pública y la abre gente sin sesión.
--
-- `config_publica` quita `cif` y `telefono` del config a propósito, para no
-- publicar el teléfono del dueño. Eso está bien y se queda: aquí no se
-- destapan, se añade **solo** lo que la ley exige enseñar, en su propio
-- objeto y con nombres explícitos:
--
--   · responsable → razón social, o el nombre comercial si no hay otra
--   · nif         → el CIF del local. Es dato de empresa, sale en cada ticket
--                   y en el registro mercantil; no es dato personal de nadie.
--   · direccion   → la fiscal, o la de contacto si no hay fiscal
--   · email       → `emailRgpd`, el de ejercicio de derechos (Admin › Local)
--
-- El **teléfono sigue sin salir**. Si algún día el bar quiere darlo como vía
-- de contacto RGPD, que lo escriba en `emailRgpd`… o se añade aparte, pero a
-- propósito y no de rebote.
--
-- Los cuatro pueden venir vacíos: un local recién montado no tiene NIF puesto
-- todavía. La página lo dice —«falta por rellenar»— en vez de inventárselo o
-- de fingir que la política está completa.
-- ────────────────────────────────────────────────────────────────────────────

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
      'carta',    coalesce(v_local.config -> 'carta', '{}'::jsonb),
      'privacidad', jsonb_build_object(
        'responsable', coalesce(nullif(v_local.config ->> 'razonSocial', ''), v_local.nombre),
        'nif',         coalesce(v_local.config ->> 'cif', ''),
        'direccion',   coalesce(nullif(v_local.config ->> 'direccionFiscal', ''),
                                v_local.config ->> 'direccion', ''),
        'email',       coalesce(v_local.config ->> 'emailRgpd', '')))
  );
end $$;

-- `create or replace` de una función `security definer` puede dejar los
-- permisos como estaban, pero no se da por supuesto: se declaran.
revoke all on function config_publica(uuid) from public;
grant execute on function config_publica(uuid) to anon, authenticated;
