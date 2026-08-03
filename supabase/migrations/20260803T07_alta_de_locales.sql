-- ============================================================================
-- TPV Hostelería · Migración 07: alta de locales (multi-tenant de verdad)
--
-- Hasta ahora el proyecto servía a UN local sembrado a mano. Para vender el
-- producto, cada negocio debe poder registrarse y tener su local aislado.
--
-- Modelo: el dueño se registra con email+contraseña (Supabase Auth) y llama a
-- `registrar_local`. La función crea el local, le da de alta como empleado
-- admin y le graba `local_id` en su app_metadata, que es lo que leen todas las
-- policies RLS (`local_actual()`). Un usuario solo puede tener UN local: así
-- nadie puede crear locales en masa ni colarse en el de otro.
-- ============================================================================

-- Normaliza acentos sin depender de la extensión `unaccent` (que no siempre
-- está disponible): suficiente para construir slugs.
create or replace function unaccent_simple(t text)
returns text language sql immutable as $$
  select translate(t,
    'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
    'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC')
$$;

-- ¿El usuario autenticado ya tiene local? (vacío si aún no ha registrado)
create or replace function mi_local()
returns table (local_id uuid, nombre text, slug text, rol text)
language sql security definer set search_path = public stable as $$
  select l.id, l.nombre, l.slug, e.rol
  from empleados e join locales l on l.id = e.local_id
  where e.user_id = auth.uid()
  limit 1
$$;

-- Registra el local del usuario autenticado y lo deja listo para operar.
create or replace function registrar_local(p_nombre text, p_pin_admin text default '1234')
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_nombre text := nullif(trim(coalesce(p_nombre, '')), '');
  v_slug text;
  v_sufijo int := 0;
  v_local uuid;
begin
  if v_user is null then raise exception 'sin_sesion' using errcode = '28000'; end if;
  if v_nombre is null then raise exception 'nombre_requerido'; end if;
  if length(v_nombre) > 60 then raise exception 'nombre_largo'; end if;
  if length(coalesce(p_pin_admin, '')) < 4 then raise exception 'pin_corto'; end if;

  -- un usuario, un local
  if exists (select 1 from empleados where user_id = v_user) then
    raise exception 'ya_tiene_local';
  end if;

  -- slug legible y único (casa-loli, casa-loli-2, …)
  v_slug := trim(both '-' from regexp_replace(lower(unaccent_simple(v_nombre)), '[^a-z0-9]+', '-', 'g'));
  if v_slug = '' then v_slug := 'local'; end if;
  while exists (select 1 from locales where slug = v_slug || case when v_sufijo = 0 then '' else '-' || v_sufijo end) loop
    v_sufijo := v_sufijo + 1;
  end loop;
  if v_sufijo > 0 then v_slug := v_slug || '-' || v_sufijo; end if;

  select email into v_email from auth.users where id = v_user;

  insert into locales (slug, nombre, config)
  values (v_slug, v_nombre, jsonb_build_object(
    'moneda', '€', 'ivaPct', 10, 'onboarded', false,
    'emailContacto', v_email,
    'reservas', jsonb_build_object(
      'turnos', jsonb_build_array(
        jsonb_build_object('id', 'comida', 'nombre', 'Comida', 'inicio', '13:00', 'fin', '16:00'),
        jsonb_build_object('id', 'cena', 'nombre', 'Cena', 'inicio', '20:00', 'fin', '23:30')),
      'intervaloMin', 30, 'duracionMin', 90, 'maxPersonasOnline', 10,
      'diasCerrados', '[]'::jsonb, 'retencionDias', 30, 'aforo', null),
    'carta', jsonb_build_object(
      'formatos', jsonb_build_array(),
      'tiposPan', jsonb_build_array(),
      'extras', jsonb_build_array())
  ))
  returning id into v_local;

  -- el dueño queda como empleado admin, con su PIN para el día a día
  insert into empleados (local_id, user_id, nombre, rol, pin_hash, activo)
  values (v_local, v_user, coalesce(nullif(split_part(v_email, '@', 1), ''), 'Encargado'), 'admin',
          crypt(p_pin_admin, gen_salt('bf')), true);

  -- las policies leen app_metadata.local_id del JWT (hay que refrescar sesión
  -- en el cliente para que el token nuevo lo incluya)
  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('local_id', v_local)
  where id = v_user;

  return v_local;
end $$;

grant execute on function unaccent_simple(text) to authenticated, anon;
grant execute on function mi_local() to authenticated;
grant execute on function registrar_local(text, text) to authenticated;
