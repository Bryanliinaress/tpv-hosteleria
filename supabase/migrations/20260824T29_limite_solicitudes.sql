-- ────────────────────────────────────────────────────────────────────────────
-- Un límite a las solicitudes de acceso.
--
-- `solicitar_dispositivo` está abierta a `anon` a propósito: es como pide
-- permiso un aparato nuevo, y pedirlo no da acceso a nada — alguien tiene que
-- autorizarlo a mano. Pero no tenía ningún tope, así que cualquiera que
-- conozca la URL podía crear solicitudes sin parar y dejar al encargado con una
-- lista de «esperando permiso» imposible de leer, justo el día que monta el bar
-- y necesita encontrar SU código entre las demás.
--
-- Dos topes, los dos por local:
--   · cuántas pueden estar esperando a la vez (montar un bar son cinco o seis
--     aparatos, no cincuenta);
--   · cuántas se pueden pedir seguidas en un minuto, que es lo que distingue a
--     alguien montando un bar de un script.
--
-- Se cuenta sobre las PENDIENTES, y las de más de una hora ya se limpian solas
-- ahí mismo: un tope alcanzado se desatasca solo, sin que nadie toque nada.
-- ────────────────────────────────────────────────────────────────────────────

create or replace function solicitar_dispositivo(p_slug text, p_nombre text default null)
returns table (codigo text, secreto text)
-- `extensions` porque ahí viven crypt/gen_salt/gen_random_bytes en Supabase.
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_local uuid;
  v_codigo text;
  v_secreto text := encode(gen_random_bytes(32), 'hex');
  v_esperando int;
  v_ultimo_minuto int;
begin
  select id into v_local from locales where slug = p_slug;
  -- Un solo local por proyecto es lo normal en este producto: si el slug no
  -- casa (se renombró el local, por ejemplo), se coge el único que hay antes
  -- que dejar tirado a quien está montando el bar.
  if v_local is null then
    select id into v_local from locales order by creado_en limit 1;
  end if;
  if v_local is null then raise exception 'local_no_existe'; end if;

  delete from dispositivos
   where local_id = v_local and estado = 'pendiente' and creado_en < now() - interval '1 hour';

  -- Los topes van DESPUÉS de la limpieza: si no, una racha de hace dos horas
  -- dejaría bloqueado a quien llega ahora.
  select count(*) into v_esperando
    from dispositivos where local_id = v_local and estado = 'pendiente';
  if v_esperando >= 20 then
    raise exception 'demasiadas_solicitudes' using
      hint = 'Hay muchas solicitudes esperando. Autoriza o descarta las que sobren.';
  end if;

  select count(*) into v_ultimo_minuto
    from dispositivos
   where local_id = v_local and estado = 'pendiente'
     and creado_en > now() - interval '1 minute';
  if v_ultimo_minuto >= 5 then
    raise exception 'demasiadas_solicitudes' using
      hint = 'Espera un momento antes de volver a pedir acceso.';
  end if;

  -- Ojo con cualificar: `codigo` y `secreto` son también los parámetros de
  -- salida, y sin alias Postgres no sabe a cuál te refieres.
  loop
    v_codigo := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (
      select 1 from dispositivos d
       where d.local_id = v_local and d.codigo = v_codigo and d.estado = 'pendiente');
  end loop;

  insert into dispositivos (local_id, nombre, codigo, secreto_hash)
  values (v_local, coalesce(nullif(btrim(p_nombre), ''), 'Dispositivo'),
          v_codigo, crypt(v_secreto, gen_salt('bf')));

  return query select v_codigo, v_secreto;
end $$;

revoke all on function solicitar_dispositivo(text, text) from public;
grant execute on function solicitar_dispositivo(text, text) to anon, authenticated;
