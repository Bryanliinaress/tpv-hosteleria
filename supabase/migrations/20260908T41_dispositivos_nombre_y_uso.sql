-- ────────────────────────────────────────────────────────────────────────────
-- 41. Renombrar un dispositivo, y saber PARA QUÉ se usa.
--
-- El nombre se ponía una sola vez, al autorizarlo, y no se podía cambiar. Con
-- cuatro tablets iguales llamadas «Tablet», el encargado que quiere quitarle
-- el acceso a la de la barra no sabe cuál de las cuatro es — y quitarle el
-- acceso a la de cocina en mitad de un servicio se nota.
--
-- Poder renombrarlas ayuda, pero un nombre dice lo que alguien QUISO, no lo
-- que el aparato hace. Lo que de verdad lo identifica es en qué pantalla está:
-- la de cocina lleva semanas abierta en el KDS. Eso lo apunta el propio
-- aparato al abrir una pantalla de personal — su sesión es suya, así que la
-- función sabe cuál es sin que nadie se lo diga.
--
-- Y de paso arregla `ultimo_uso`: hasta ahora solo se tocaba al canjear el
-- secreto por una sesión, o sea casi nunca. «Último uso: hace tres semanas»
-- de una tablet que se usa a diario invita a quitarle el acceso por error.
-- ────────────────────────────────────────────────────────────────────────────

alter table dispositivos add column if not exists ultima_pantalla text;

comment on column dispositivos.ultima_pantalla is
  'Clave de la última pantalla de personal que abrió (cocina, barra, camarero…). '
  'La escribe el propio aparato: es lo que dice para qué se usa.';

-- ── El aparato dice dónde está ───────────────────────────────────────────────
-- Solo puede tocar SU fila: se busca por `auth.uid()`, que es la cuenta que el
-- servidor le creó al autorizarlo. Un aparato no puede escribir sobre otro
-- aunque llame a la función con lo que quiera.
create or replace function dispositivo_en_pantalla(p_pantalla text)
returns void
language sql security definer set search_path = public as $$
  update dispositivos
     set ultima_pantalla = nullif(btrim(p_pantalla), ''),
         ultimo_uso = now()
   where user_id = auth.uid() and estado = 'aprobado'
$$;

-- ── El encargado le cambia el nombre ────────────────────────────────────────
-- Con PIN de encargado, como autorizar y revocar: es la misma lista y el mismo
-- gesto. Comprobado en el SERVIDOR — que la pantalla pida el PIN no sirve de
-- nada si la RPC se puede llamar por su cuenta.
create or replace function renombrar_dispositivo(p_id uuid, p_nombre text, p_pin text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from verificar_pin(coalesce(p_pin, ''), true)) then
    raise exception 'pin_no_admin';
  end if;
  if nullif(btrim(coalesce(p_nombre, '')), '') is null then
    raise exception 'nombre_requerido';
  end if;
  update dispositivos set nombre = btrim(p_nombre)
   where id = p_id and local_id = local_actual();
  if not found then raise exception 'dispositivo_no_existe'; end if;
end $$;

-- ── La lista, ahora con la pantalla ─────────────────────────────────────────
-- `create or replace` no puede anadir una columna al resultado: Postgres se
-- niega a cambiarle el tipo de retorno a una funcion que ya existe. Hay que
-- tirarla primero, en esta misma transaccion.
drop function if exists dispositivos_del_local();
create or replace function dispositivos_del_local()
returns table (id uuid, nombre text, codigo text, estado text,
               creado_en timestamptz, aprobado_en timestamptz, ultimo_uso timestamptz,
               ultima_pantalla text)
language sql security definer set search_path = public stable as $$
  select d.id, d.nombre,
         case when d.estado = 'pendiente' then d.codigo else null end,
         d.estado, d.creado_en, d.aprobado_en, d.ultimo_uso, d.ultima_pantalla
    from dispositivos d
   where d.local_id = local_actual()
   order by (d.estado = 'pendiente') desc, d.creado_en desc
$$;

-- ── Permisos ────────────────────────────────────────────────────────────────
-- Supabase concede EXECUTE a anon y authenticated en cuanto se crea una
-- función. Aquí se quita y se da solo lo que toca: el cliente anónimo del QR
-- no tiene nada que decir sobre los dispositivos del bar.
revoke all on function dispositivo_en_pantalla(text)            from public, anon, authenticated;
revoke all on function renombrar_dispositivo(uuid, text, text)  from public, anon, authenticated;
revoke all on function dispositivos_del_local()                 from public, anon, authenticated;
grant execute on function dispositivo_en_pantalla(text)           to authenticated;
grant execute on function renombrar_dispositivo(uuid, text, text) to authenticated;
grant execute on function dispositivos_del_local()                to authenticated;
