-- ────────────────────────────────────────────────────────────────────────────
-- 43. Un plato que no está en la carta.
--
-- La sugerencia de la pizarra, el descorche, la tarta que trajo el cliente, el
-- suplemento de terraza. Hasta ahora, o se cobraba por fuera del TPV —dinero
-- que no aparece en ningún ticket ni en ningún arqueo— o había que dar de alta
-- un producto de la carta que el cliente del QR ve esa misma noche.
--
-- ⚠️ AQUÍ EL PRECIO LO PONE UNA PERSONA. Es exactamente lo contrario de
-- `qr_agregar_linea`, que resuelve el precio desde el catálogo y está concedida
-- a `anon` justamente porque así el cliente NO puede ponerle precio a lo que
-- pide. Esta función es la excepción, y por eso:
--
--   · se concede SOLO a `authenticated` — nunca a `anon`;
--   · valida el precio en el servidor (0 … 999,99), que la pantalla avise no
--     sirve de nada si la RPC se puede llamar por su cuenta;
--   · deja `producto_id` a null: la línea no miente diciendo ser un producto
--     de la carta, y si mañana se borra la carta entera esta línea sigue en su
--     ticket con su nombre y su precio.
--
-- El IVA se lo pone el trigger `_congelar_iva_linea` (migración 31): sin
-- producto, el del local. Un plato fuera de carta con IVA distinto no existe
-- todavía; cuando exista, se le añade el parámetro AQUÍ y no en cuatro sitios.
-- ────────────────────────────────────────────────────────────────────────────

create or replace function personal_agregar_libre(
  p_comensal uuid,
  p_nombre text,
  p_precio numeric,
  p_cantidad int default 1,
  p_tipo text default 'comida'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_com comensales%rowtype;
  v_nombre text := nullif(trim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g')), '');
  v_id uuid;
begin
  if v_nombre is null then raise exception 'nombre_vacio'; end if;
  if length(v_nombre) > 60 then v_nombre := left(v_nombre, 60); end if;

  -- El precio, redondeado a céntimos aquí: `numeric(10,2)` redondearía igual
  -- al insertar, pero entonces el tope de abajo se comprobaría sobre otro
  -- número que el que se guarda.
  if p_precio is null then raise exception 'precio_invalido'; end if;
  if round(p_precio, 2) < 0 or round(p_precio, 2) > 999.99 then raise exception 'precio_invalido'; end if;
  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 50 then raise exception 'cantidad_invalida'; end if;
  if p_tipo is null or p_tipo not in ('comida', 'bebida') then raise exception 'tipo_invalido'; end if;

  select * into v_com from comensales where id = p_comensal;
  if not found then raise exception 'comensal_no_existe'; end if;
  -- `local_actual()` y no el del comensal: el mostrador de un bar no le añade
  -- líneas a la mesa de otro.
  if v_com.local_id <> local_actual() then raise exception 'comensal_no_existe'; end if;
  if exists (select 1 from mesas m where m.id = v_com.mesa_id and m.estado = 'libre') then
    raise exception 'mesa_cerrada';
  end if;

  -- No se fusiona con una línea igual, al revés que en la carta: dos «Tarta de
  -- la abuela» pueden tener precios distintos porque los teclea una persona, y
  -- juntarlas se comería uno de los dos.
  insert into lineas_pedido (local_id, comensal_id, producto_id, nombre, precio,
                             cantidad, tipo, tiempo, personalizacion)
  values (v_com.local_id, p_comensal, null, v_nombre, round(p_precio, 2),
          p_cantidad, p_tipo, 1, '{}'::jsonb)
  returning id into v_id;
  return v_id;
end $$;

comment on function personal_agregar_libre(uuid, text, numeric, int, text) is
  'Línea sin producto de carta, con precio puesto a mano. SOLO personal: el cliente del QR nunca pone precios.';

-- ── Permisos ────────────────────────────────────────────────────────────────
-- Supabase concede EXECUTE a anon y authenticated en cuanto se crea una
-- función. Aquí se quita todo y se da solo a `authenticated`: que `anon` pueda
-- llamar a esto es poder pedirse una ronda a 0 €.
revoke all on function personal_agregar_libre(uuid, text, numeric, int, text) from public, anon, authenticated;
grant execute on function personal_agregar_libre(uuid, text, numeric, int, text) to authenticated;
