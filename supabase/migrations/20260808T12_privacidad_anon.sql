-- ────────────────────────────────────────────────────────────────────────────
-- Migración 12 · Datos de clientes visibles para cualquiera (fallo 31)
--
-- `mesas` es de lectura pública para anon (la carta por QR y la página de
-- reservas necesitan número, zona y estado). Pero la tabla tiene una columna
-- `reserva` jsonb con **el nombre y el teléfono** de quien reservó:
--
--   {"nombre":"Marta López","telefono":"600...","hora":"21:30","personas":4}
--
-- Cualquiera que abriera el QR de la carta —o leyera la clave anon del bundle,
-- que es pública por diseño— podía descargarse de una petición la lista de
-- reservas del día con nombres y teléfonos. Datos personales de terceros.
--
-- RLS filtra FILAS, no columnas: el corte se hace con privilegios de columna,
-- que se aplican además de la policy. `estado_mesa()` y `config_publica()` son
-- security definer, así que el cliente sigue viendo lo suyo igual.
-- ────────────────────────────────────────────────────────────────────────────

revoke select on mesas from anon;
grant select (id, local_id, numero, zona, capacidad, estado, unida_a) on mesas to anon;

-- `abierta_desde` y `camarero_id` tampoco son asunto del cliente: dicen desde
-- cuándo está sentada otra mesa y qué empleado la lleva.

-- Comprobación rápida tras aplicarla (con la clave anon, no la de servicio):
--   select id, numero, zona from mesas;   -- debe funcionar
--   select reserva from mesas;            -- debe dar «permission denied»
