-- ────────────────────────────────────────────────────────────────────────────
-- Dejar el local COMO RECIÉN ABIERTO, para empezar unas pruebas de cero.
--
-- Se ejecuta contra el proyecto Supabase del local (SQL Editor o Management
-- API). Sustituye el slug si hay más de un local en el proyecto.
--
-- ⚠️ Léelo antes de ejecutarlo: hay dos bloques y el segundo NO se puede
--    deshacer ni se debería usar en un bar que ya esté facturando.
-- ────────────────────────────────────────────────────────────────────────────

-- Local sobre el que se actúa (ajusta el slug si hace falta)
create temporary table _objetivo as
select id from locales where slug = 'casa-loli';

-- ── BLOQUE 1 · El servicio en curso ─────────────────────────────────────────
-- Cierra todas las mesas: se van los comensales, sus líneas, las comandas de
-- cocina/barra y los avisos. NO toca tickets, caja, fichajes ni reservas.
-- Es lo que hace falta para empezar unas pruebas con la sala limpia.

delete from comandas       where local_id in (select id from _objetivo);
delete from lineas_pedido  where local_id in (select id from _objetivo);
delete from comensales     where local_id in (select id from _objetivo);
delete from avisos         where local_id in (select id from _objetivo);

update mesas
   set estado = 'libre',
       unida_a = null,          -- deshace los grupos de mesas
       abierta_desde = null,
       camarero_id = null,
       reserva = null           -- quita el bloqueo puntual de mesa
 where local_id in (select id from _objetivo);

-- ── BLOQUE 2 · El historial ─────────────────────────────────────────────────
-- ⚠️ ESTO SÍ BORRA DATOS DE NEGOCIO. Descoméntalo solo si sabes lo que haces.
--
-- Los TICKETS son facturas simplificadas: si alguno se registró en la AEAT vía
-- Veri*Factu, su copia sigue estando allí y borrarlo aquí deja tu contabilidad
-- sin el respaldo. En un bar que ya factura, esto NO se toca.

-- delete from tickets       where local_id in (select id from _objetivo);
-- delete from cierres_caja  where local_id in (select id from _objetivo);
-- delete from pagos_online  where local_id in (select id from _objetivo);
-- delete from fichajes      where local_id in (select id from _objetivo);
-- delete from reservas      where local_id in (select id from _objetivo);

-- ── Comprobación ────────────────────────────────────────────────────────────
select
  (select count(*) from mesas      where local_id in (select id from _objetivo) and estado <> 'libre') as mesas_no_libres,
  (select count(*) from comensales where local_id in (select id from _objetivo)) as comensales,
  (select count(*) from lineas_pedido where local_id in (select id from _objetivo)) as lineas,
  (select count(*) from comandas   where local_id in (select id from _objetivo)) as comandas,
  (select count(*) from avisos     where local_id in (select id from _objetivo)) as avisos,
  (select count(*) from tickets    where local_id in (select id from _objetivo)) as tickets_conservados;
