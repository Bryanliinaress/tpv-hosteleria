-- ────────────────────────────────────────────────────────────────────────────
-- La cola sin conexión podía duplicar un producto.
--
-- En un bar el wifi se cae a mitad de servicio y las operaciones de servicio se
-- guardan para reenviarlas. El problema no es la caída limpia: es cuando la
-- petición SÍ llega al servidor, se aplica, y lo que se pierde es la respuesta.
-- El cliente lo ve como fallo de red, lo encola, y al volver la línea lo manda
-- otra vez: dos cervezas donde el cliente pidió una. Y `marchar_siguiente` dos
-- veces se salta un plato.
--
-- La solución es una clave por operación que el cliente genera ANTES del primer
-- intento y reutiliza en cada reenvío. Si la clave ya se vio, no se vuelve a
-- aplicar.
--
-- Los cuerpos de las RPC no se tocan: se envuelven. Duplicar el cuerpo para
-- meterle una guarda arriba sería otra regla escrita dos veces, y ya sabemos
-- cómo acaba eso. Cada envoltorio comprueba la clave y delega en la de siempre.
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists operaciones_idem (
  clave     text primary key,
  creado_en timestamptz not null default now()
);
create index if not exists operaciones_idem_creado on operaciones_idem (creado_en);

-- Nadie de fuera la lee ni la escribe: la mueven los envoltorios, que corren
-- como dueño. Mismo patrón que `intentos_pin` y `contadores_ticket`.
alter table operaciones_idem enable row level security;
revoke all on table operaciones_idem from anon, authenticated;

-- ¿Es la primera vez que se ve esta clave? Deja constancia y responde.
create or replace function _op_nueva(p_clave text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_filas int;
begin
  if p_clave is null or p_clave = '' then return true; end if;  -- sin clave, sin red de seguridad

  insert into operaciones_idem (clave) values (p_clave)
  on conflict (clave) do nothing;
  -- `get diagnostics` devuelve un ENTERO (filas insertadas): 1 la primera vez,
  -- 0 si la clave ya estaba.
  get diagnostics v_filas = row_count;

  -- Barrido perezoso: un pedido de hace dos días ya no se va a reintentar, y
  -- esta tabla no debe crecer para siempre. Una de cada cien llamadas basta.
  if random() < 0.01 then
    delete from operaciones_idem where creado_en < now() - interval '2 days';
  end if;

  return v_filas > 0;
end $$;
revoke all on function _op_nueva(text) from public, anon, authenticated;

-- ── Envoltorios ─────────────────────────────────────────────────────────────
-- Devuelven lo mismo que la original la primera vez; en un reenvío repetido no
-- hacen nada y devuelven el valor neutro (el cliente ya no lo mira: la pantalla
-- se rehidrata del servidor).

create or replace function qr_agregar_linea_idem(
  p_idem text, p_comensal uuid, p_producto uuid,
  p_variante text default null, p_personalizacion jsonb default '{}'::jsonb,
  p_tiempo int default 1, p_cantidad int default 1
) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if not _op_nueva(p_idem) then return null; end if;
  return qr_agregar_linea(p_comensal, p_producto, p_variante, p_personalizacion, p_tiempo, p_cantidad);
end $$;

create or replace function qr_cambiar_cantidad_idem(
  p_idem text, p_linea uuid, p_comensal uuid, p_cantidad int
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not _op_nueva(p_idem) then return; end if;
  perform qr_cambiar_cantidad(p_linea, p_comensal, p_cantidad);
end $$;

create or replace function qr_confirmar_pedido_idem(p_idem text, p_mesa uuid) returns int
language plpgsql security definer set search_path = public as $$
begin
  -- Repetir esto imprime la comanda otra vez y la cocina hace el plato dos
  -- veces: es de los que más caro sale duplicar.
  if not _op_nueva(p_idem) then return 0; end if;
  return qr_confirmar_pedido(p_mesa);
end $$;

create or replace function marchar_siguiente_idem(p_idem text, p_mesa uuid) returns int
language plpgsql security definer set search_path = public as $$
begin
  if not _op_nueva(p_idem) then return 0; end if;
  return marchar_siguiente(p_mesa);
end $$;

-- El cliente pasa a usar SOLO los envoltorios: si las originales siguieran a su
-- alcance, bastaría llamarlas directamente para saltarse la red de seguridad.
-- Los envoltorios las llaman igual porque corren como dueño.
revoke all on function qr_agregar_linea(uuid, uuid, text, jsonb, int, int) from public, anon, authenticated;
revoke all on function qr_cambiar_cantidad(uuid, uuid, int)                 from public, anon, authenticated;
revoke all on function qr_confirmar_pedido(uuid)                            from public, anon, authenticated;
revoke all on function marchar_siguiente(uuid)                              from public, anon, authenticated;

-- Se revoca a TODOS antes de conceder, y no solo a `public`: Supabase concede
-- EXECUTE a `anon` y `authenticated` en cuanto se crea una función (`alter
-- default privileges`), y un `revoke … from public` no quita esa concesión
-- directa. Aquí mismo pasó: `marchar_siguiente_idem` —que es de personal—
-- quedó abierta a `anon` sin que nadie la concediera, y lo cazó
-- `npm run permisos`.
revoke all on function qr_agregar_linea_idem(text, uuid, uuid, text, jsonb, int, int) from public, anon, authenticated;
revoke all on function qr_cambiar_cantidad_idem(text, uuid, uuid, int)                from public, anon, authenticated;
revoke all on function qr_confirmar_pedido_idem(text, uuid)                           from public, anon, authenticated;
revoke all on function marchar_siguiente_idem(text, uuid)                             from public, anon, authenticated;

-- Quien pide es el cliente del QR (anónimo) y el personal; marchar, solo el personal.
grant execute on function qr_agregar_linea_idem(text, uuid, uuid, text, jsonb, int, int) to anon, authenticated;
grant execute on function qr_cambiar_cantidad_idem(text, uuid, uuid, int)                to anon, authenticated;
grant execute on function qr_confirmar_pedido_idem(text, uuid)                           to anon, authenticated;
grant execute on function marchar_siguiente_idem(text, uuid)                             to authenticated;
