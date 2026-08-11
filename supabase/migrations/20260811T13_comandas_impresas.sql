-- ────────────────────────────────────────────────────────────────────────────
-- Migración 13 · Marcar qué comandas ya han salido en papel
--
-- Hasta ahora la impresión la disparaba una PANTALLA abierta (la Estación de
-- impresión): si nadie la tenía abierta, no salía nada, y lo perdido no se
-- recuperaba nunca. Para que imprima un servicio de fondo —sin navegador— hace
-- falta saber qué está impreso y qué no:
--
--   · al arrancar, saca lo pendiente (el PC estaba apagado, hubo un corte…)
--   · si el servicio se reinicia, NO vuelve a imprimir lo mismo
--
-- Columna aditiva y opcional: nada que la ignore deja de funcionar.
-- ────────────────────────────────────────────────────────────────────────────

alter table comandas add column if not exists impresa_en timestamptz;

comment on column comandas.impresa_en is
  'Cuándo salió en papel. NULL = pendiente de imprimir (lo usa scripts/impresion-automatica.mjs).';

-- Buscar lo pendiente tiene que ser barato: se consulta en cada arranque y no
-- interesa recorrer el histórico entero.
create index if not exists comandas_pendientes_impresion
  on comandas (local_id, hora_entrada)
  where impresa_en is null;
