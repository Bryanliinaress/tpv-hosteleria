-- ────────────────────────────────────────────────────────────────────────────
-- 42. De quién es cada aparato.
--
-- Un dispositivo ya dice cómo se llama (migración 41) y para qué se usa (su
-- última pantalla). Lo que falta es de QUIÉN es: «la PDA de María». Con cuatro
-- tablets iguales, saber a quién le quitas el acceso al revocar una —o qué
-- aparatos eran de quien ya no trabaja aquí— es la diferencia entre hacerlo
-- tranquilo y dejar a alguien tirado en mitad de un servicio.
--
-- ⚠️ Esto es INFORMACIÓN, no permisos. Asignarle un aparato a María NO hace que
-- ese aparato entre como María ni le dé sus permisos: quien identifica a la
-- persona sigue siendo **el PIN**, que es lo que distingue a un camarero de un
-- encargado. Si algún día se quiere que un móvil personal entre solo, eso es
-- otra decisión y hay que tomarla a propósito.
-- ────────────────────────────────────────────────────────────────────────────

-- `on delete set null`, NO cascade: dar de baja a un empleado no puede llevarse
-- por delante el acceso de un aparato que sigue en la barra.
alter table dispositivos
  add column if not exists empleado_id uuid references empleados on delete set null;

comment on column dispositivos.empleado_id is
  'De quién es el aparato. Informativo: quien identifica a la persona es el PIN.';

-- ── El encargado dice de quién es ───────────────────────────────────────────
-- Con PIN de encargado, como renombrar o revocar: es la misma lista y el mismo
-- gesto, y comprobado en el SERVIDOR — que la pantalla pida el PIN no sirve de
-- nada si la RPC se puede llamar por su cuenta.
create or replace function asignar_dispositivo(p_id uuid, p_empleado uuid, p_pin text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from verificar_pin(coalesce(p_pin, ''), true)) then
    raise exception 'pin_no_admin';
  end if;
  -- `p_empleado` nulo = «sin asignar», que es una respuesta válida: un aparato
  -- fijo de la barra no es de nadie en particular.
  if p_empleado is not null and not exists (
    select 1 from empleados where id = p_empleado and local_id = local_actual()
  ) then
    raise exception 'empleado_no_existe';
  end if;
  update dispositivos set empleado_id = p_empleado
   where id = p_id and local_id = local_actual();
  if not found then raise exception 'dispositivo_no_existe'; end if;
end $$;

-- ── La lista, ahora con su dueño ────────────────────────────────────────────
-- `create or replace` no puede añadir una columna al resultado: Postgres se
-- niega a cambiarle el tipo de retorno a una función que ya existe.
drop function if exists dispositivos_del_local();
create or replace function dispositivos_del_local()
returns table (id uuid, nombre text, codigo text, estado text,
               creado_en timestamptz, aprobado_en timestamptz, ultimo_uso timestamptz,
               ultima_pantalla text, empleado_id uuid, empleado text)
language sql security definer set search_path = public stable as $$
  select d.id, d.nombre,
         case when d.estado = 'pendiente' then d.codigo else null end,
         d.estado, d.creado_en, d.aprobado_en, d.ultimo_uso, d.ultima_pantalla,
         d.empleado_id, e.nombre
    from dispositivos d
    left join empleados e on e.id = d.empleado_id
   where d.local_id = local_actual()
   order by (d.estado = 'pendiente') desc, d.creado_en desc
$$;

-- ── Permisos ────────────────────────────────────────────────────────────────
-- Supabase concede EXECUTE a anon y authenticated en cuanto se crea una
-- función: aquí se quita y se da solo lo que toca.
revoke all on function asignar_dispositivo(uuid, uuid, text) from public, anon, authenticated;
revoke all on function dispositivos_del_local()              from public, anon, authenticated;
grant execute on function asignar_dispositivo(uuid, uuid, text) to authenticated;
grant execute on function dispositivos_del_local()              to authenticated;
