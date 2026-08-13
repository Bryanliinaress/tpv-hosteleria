-- ────────────────────────────────────────────────────────────────────────────
-- Migración 11 · Los SUPLEMENTOS no se estaban cobrando (fallo 23)
--
-- `qr_agregar_linea` calculaba el precio solo con `productos.precios[variante]`.
-- Todo lo que la app suma en pantalla por encima de ese precio se perdía:
--
--   · tipo de pan  → «Sin gluten» +1,20 €   (locales.config.carta.tiposPan[].sup)
--   · extras       → «Queso» +0,20 € c/u    (locales.config.carta.extras[].precio)
--   · menú del día → «Solomillo» +2,00 €    (productos.modificadores.menu)
--
-- El cliente ve 3,70 € y el bar cobra 2,50 €. En un bar de bocadillos, con
-- extras en media docena de comandas por servicio, es dinero todos los días.
--
-- El precio se sigue calculando EN EL SERVIDOR (el cliente nunca manda importes:
-- si los mandara, cualquiera podría pedirse el menú a 0 €). Lo que cambia es que
-- ahora el servidor mira también la personalización, contrastándola SIEMPRE con
-- la configuración del local y con los grupos del propio producto: un extra o
-- una elección que no existan en la carta valen 0, no lo que diga el cliente.
-- ────────────────────────────────────────────────────────────────────────────

-- Suplemento del tipo de pan elegido (p. ej. sin gluten), 0 si no existe.
create or replace function sup_tipo_pan(p_local uuid, p_tipo text)
returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(max((t ->> 'sup')::numeric), 0)
  from locales l,
       lateral jsonb_array_elements(coalesce(l.config -> 'carta' -> 'tiposPan', '[]'::jsonb)) t
  where l.id = p_local and p_tipo is not null and t ->> 'id' = p_tipo;
$$;

-- Suma de los extras añadidos, a los precios de la carta del local.
-- Un extra puede estar guardado como texto suelto ("Queso") o como objeto
-- ({nombre, precio}); en el primer caso el precio por defecto es 0,20 €.
create or replace function sup_extras(p_local uuid, p_anadidos jsonb)
returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(
    coalesce(
      (select case when jsonb_typeof(e) = 'string' then 0.20
                   else coalesce((e ->> 'precio')::numeric, 0) end
       from locales l,
            lateral jsonb_array_elements(coalesce(l.config -> 'carta' -> 'extras', '[]'::jsonb)) e
       where l.id = p_local
         and coalesce(e ->> 'nombre', e #>> '{}') = a #>> '{}'
       limit 1),
      0)
  ), 0)
  from jsonb_array_elements(coalesce(p_anadidos, '[]'::jsonb)) a;
$$;

-- Suplementos del menú del día: solo se cobran las elecciones que EXISTEN en
-- los grupos del producto, y con el suplemento que dice la carta.
create or replace function sup_menu(p_producto uuid, p_elecciones jsonb)
returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(
    coalesce((
      select coalesce((o ->> 'sup')::numeric, 0)
      from productos p,
           lateral jsonb_array_elements(coalesce(p.modificadores -> 'menu' -> 'grupos', '[]'::jsonb)) g,
           lateral jsonb_array_elements(coalesce(g -> 'opciones', '[]'::jsonb)) o
      where p.id = p_producto
        and g ->> 'titulo' = el ->> 'grupo'
        and o ->> 'nombre' = el ->> 'opcion'
      limit 1
    ), 0)
  ), 0)
  from jsonb_array_elements(coalesce(p_elecciones, '[]'::jsonb)) el;
$$;

-- Misma firma que antes: no hay que tocar el cliente para que siga funcionando.
create or replace function qr_agregar_linea(
  p_comensal uuid, p_producto uuid,
  p_variante text default null,           -- clave en productos.precios
  p_personalizacion jsonb default '{}'::jsonb,
  p_tiempo int default 1,
  p_cantidad int default 1
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_com comensales%rowtype;
  v_prod productos%rowtype;
  v_precio numeric;
  v_nombre text;
  v_id uuid;
begin
  if p_cantidad < 1 or p_cantidad > 50 then raise exception 'cantidad_invalida'; end if;
  if p_tiempo not between 1 and 3 then raise exception 'tiempo_invalido'; end if;

  select * into v_com from comensales where id = p_comensal;
  if not found then raise exception 'comensal_no_existe'; end if;
  if exists (select 1 from mesas m where m.id = v_com.mesa_id and m.estado = 'libre') then
    raise exception 'mesa_cerrada';
  end if;

  select * into v_prod from productos
  where id = p_producto and local_id = v_com.local_id and disponible;
  if not found then raise exception 'producto_no_disponible'; end if;

  -- precio de la variante pedida, o 'base', o el único valor
  v_precio := coalesce(
    (v_prod.precios ->> coalesce(p_variante, 'base'))::numeric,
    case when jsonb_typeof(v_prod.precios) = 'object'
              and (select count(*) from jsonb_object_keys(v_prod.precios)) = 1
         then (select (v_prod.precios ->> k)::numeric
               from jsonb_object_keys(v_prod.precios) k limit 1) end
  );
  if v_precio is null then raise exception 'variante_invalida'; end if;

  -- suplementos, cada uno contrastado con la carta del local (fallo 23)
  v_precio := v_precio
    + sup_tipo_pan(v_com.local_id, p_personalizacion -> 'pan' ->> 'tipo')
    + sup_extras(v_com.local_id, p_personalizacion -> 'anadidos')
    + sup_menu(p_producto, p_personalizacion -> 'elecciones');
  v_precio := round(v_precio, 2);

  v_nombre := v_prod.nombre || case when p_variante is not null and p_variante <> 'base'
                                    then ' (' || p_variante || ')' else '' end;

  -- fusión con línea pendiente idéntica
  select id into v_id from lineas_pedido
  where comensal_id = p_comensal and producto_id = p_producto
    and estado = 'pendiente' and tiempo = p_tiempo
    and personalizacion = coalesce(p_personalizacion, '{}'::jsonb)
    and nombre = v_nombre
  limit 1;
  if v_id is not null then
    update lineas_pedido set cantidad = cantidad + p_cantidad where id = v_id;
    return v_id;
  end if;

  insert into lineas_pedido (local_id, comensal_id, producto_id, nombre, precio,
                             cantidad, tipo, tiempo, personalizacion)
  values (v_com.local_id, p_comensal, p_producto, v_nombre, v_precio,
          p_cantidad, (select c.tipo from categorias c where c.id = v_prod.categoria_id),
          p_tiempo, coalesce(p_personalizacion, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end $$;

grant execute on function qr_agregar_linea(uuid, uuid, text, jsonb, int, int) to anon, authenticated;
-- OJO con el `public`: sin él esto no quitaba nada. El permiso no lo tenían
-- `anon` ni `authenticated` directamente, lo heredaban de PUBLIC —a quien
-- Supabase se lo concede al crear la función—, así que estas tres líneas
-- estuvieron meses ahí, pareciendo hechas, y las funciones seguían abiertas.
-- Lo destapó `npm run permisos` el 13/08. Ver también la migración 21.
revoke execute on function sup_tipo_pan(uuid, text)   from public, anon, authenticated;
revoke execute on function sup_extras(uuid, jsonb)    from public, anon, authenticated;
revoke execute on function sup_menu(uuid, jsonb)      from public, anon, authenticated;
