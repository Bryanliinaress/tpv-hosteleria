-- ────────────────────────────────────────────────────────────────────────────
-- 24. Pedir acceso sabiendo el SLUG, no una mesa.
--
-- La 22 deducía el local a partir del uuid de una mesa, porque era lo único
-- que se suponía que conocía un aparato sin sesión (va en la URL del QR). Al
-- montar la pantalla se ve que no sirve: la tablet de cocina abre `/cocina` y
-- ahí no hay ninguna mesa. El QR es cosa del cliente, no del personal.
--
-- Lo que SÍ sabe siempre un aparato es de qué local es el build: cada bar
-- compila el suyo y el slug viaja dentro (`VITE_PERFIL`). Eso es lo que se usa.
--
-- No es un dato sensible: saber el slug no da acceso a nada — solo crea una
-- solicitud que alguien tiene que autorizar a mano.
-- ────────────────────────────────────────────────────────────────────────────
drop function if exists solicitar_dispositivo(uuid, text);

create or replace function solicitar_dispositivo(p_slug text, p_nombre text default null)
returns table (codigo text, secreto text)
-- `extensions` porque ahí viven crypt/gen_salt/gen_random_bytes en Supabase.
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_local uuid;
  v_codigo text;
  v_secreto text := encode(gen_random_bytes(32), 'hex');
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

grant execute on function solicitar_dispositivo(text, text) to anon, authenticated;
