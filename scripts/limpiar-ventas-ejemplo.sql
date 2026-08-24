-- ────────────────────────────────────────────────────────────────────────────
-- Quita las ventas de ejemplo que siembra `scripts/sembrar-ventas.sql`.
--
-- Se reconocen por la zona de la mesa («Ejemplo») no: las mesas se borran al
-- sembrar. Se reconocen por el camarero y la fecha, así que ajusta el filtro si
-- has sembrado otro día.
--
-- ⚠️ Borra TICKETS, que son documentos fiscales. En la demo da igual —no hay
-- nada registrado de verdad en la AEAT—, pero en un bar esto NO se lanza jamás.
-- Después se reajusta el contador para que la serie siga donde toca.
-- ────────────────────────────────────────────────────────────────────────────

-- las rectificativas primero: apuntan a los tickets con `on delete restrict`
delete from tickets
 where rectifica_a in (
   select t.id from tickets t
    where t.local_id = (select id from locales where slug = 'marchando')
      and t.cerrado_en >= current_date
      and t.camarero in ('María', 'Juan'));

delete from tickets
 where local_id = (select id from locales where slug = 'marchando')
   and cerrado_en >= current_date
   and camarero in ('María', 'Juan');

delete from anulaciones
 where local_id = (select id from locales where slug = 'marchando')
   and creado_en >= current_date
   and por = 'María';

delete from mesas
 where local_id = (select id from locales where slug = 'marchando')
   and zona = 'Ejemplo';

-- El contador vuelve al último número que sigue existiendo, para no dejar un
-- hueco enorme en la serie.
update contadores_ticket c
   set ultimo = coalesce((select max(t.numero) from tickets t where t.local_id = c.local_id), 0);

select (select count(*) from tickets) as tickets,
       (select ultimo from contadores_ticket limit 1) as contador;
