-- ────────────────────────────────────────────────────────────────────────────
-- 15. `estado_mesa` devuelve la línea COMPLETA.
--
-- El cliente anónimo del QR no puede leer las tablas (RLS): todo lo que ve le
-- llega por esta función. Y se dejaba tres columnas fuera:
--
--   · compartido_con → el móvil del cliente es JUSTO donde está el botón de
--     «Dividir este plato». Sin esta columna, la pantalla no sabía con quién
--     estaba compartido: el reparto se pintaba como si el plato fuera de uno
--     solo y el botón parecía no hacer nada. La migración 14 arregló el RPC y
--     el reparto del dinero, pero el cliente seguía sin poder VERLO.
--   · producto_id → sin él, «otra ronda» no sabe qué producto repetir.
--   · creado_en   → es con lo que se agrupa la última ronda.
--
-- Se nombran igual que las columnas de la tabla a propósito: así el cliente
-- puede usar la MISMA función de desempaquetado que el personal, en vez de
-- tener una copia a mano que se queda corta cada vez que se añade un campo.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function estado_mesa(p_mesa uuid)
returns jsonb
language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'mesa', (select jsonb_build_object(
        'id', m.id, 'numero', m.numero, 'estado', m.estado,
        'abiertaDesde', m.abierta_desde, 'unidaA', m.unida_a)
      from mesas m where m.id = p_mesa),
    'comensales', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'nombre', c.nombre, 'pagado', c.pagado,
        'items', (select coalesce(jsonb_agg(jsonb_build_object(
            'id', l.id, 'producto_id', l.producto_id,
            'nombre', l.nombre, 'precio', l.precio,
            'cantidad', l.cantidad, 'tipo', l.tipo, 'estado', l.estado,
            'tiempo', l.tiempo, 'personalizacion', l.personalizacion,
            'compartido_con', l.compartido_con, 'creado_en', l.creado_en,
            -- estado de preparación de la comanda de esta línea (si se envió)
            'preparacion', (select k.estado from comandas k where k.linea_id = l.id limit 1)
          ) order by l.creado_en), '[]'::jsonb)
          from lineas_pedido l where l.comensal_id = c.id)
      ) order by c.creado_en), '[]'::jsonb)
      from comensales c where c.mesa_id = any(_grupo_de(p_mesa))),
    'avisoActivo', exists (select 1 from avisos a where a.mesa_id = p_mesa)
  )
$$;

grant execute on function estado_mesa(uuid) to anon, authenticated;
