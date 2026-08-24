-- ────────────────────────────────────────────────────────────────────────────
-- Informes de ventas, calculados en el servidor.
--
-- Antes se calculaban en el navegador a partir del historial descargado. Eso
-- traía dos problemas:
--
--  1. **Solo se veía el mes en curso**, y desde que el historial se baja por
--     ventana (mes anterior en adelante) no se podía mirar más atrás aunque se
--     quisiera. El día 1 de cada mes, Informes aparecía vacío.
--
--  2. **Las devoluciones lo ensucian.** Una rectificativa es un ticket con
--     líneas sintéticas («Devolución (IVA 10%)»), así que salía en el ranking
--     de productos como si fuera un plato, sumaba un comensal que no existió y
--     contaba como un ticket más, bajando el ticket medio. Lo correcto es que
--     RESTE del facturado y no aparezca en ningún ranking.
--
-- Aquí se calcula todo de una vez y por rango de fechas, así que sirve para
-- cualquier periodo sin depender de lo que el dispositivo tenga descargado.
--
-- LA HORA, EN LA ZONA DEL LOCAL. `cerrado_en` es timestamptz; agrupar por hora
-- sin convertir da las horas en UTC, y un informe de horas punta desplazado dos
-- horas en verano es peor que no tenerlo: se contrata personal para la hora
-- equivocada. La zona sale de la config del local (`zonaHoraria`), con
-- Europe/Madrid por defecto.
-- ────────────────────────────────────────────────────────────────────────────

create or replace function informe_ventas(p_desde timestamptz, p_hasta timestamptz)
returns jsonb
language sql security definer set search_path = public stable as $$
with loc as (
  select l.id,
         coalesce(nullif(l.config ->> 'zonaHoraria', ''), 'Europe/Madrid') as tz
    from locales l where l.id = _local_o_error()
), t as (
  select k.*, (select tz from loc) as tz
    from tickets k
   where k.local_id = (select id from loc)
     and k.cerrado_en >= p_desde and k.cerrado_en < p_hasta
), ventas as (
  -- Los cobros de verdad. Las rectificativas van aparte: restan del total, pero
  -- no son ventas ni tienen productos ni comensales.
  select * from t where t.rectifica_a is null
), devoluciones as (
  select * from t where t.rectifica_a is not null
), lineas as (
  select v.id as ticket_id,
         v.camarero,
         i ->> 'nombre' as producto,
         (i ->> 'cantidad')::numeric as uds,
         (i ->> 'precio')::numeric * (i ->> 'cantidad')::numeric as importe
    from ventas v
    cross join lateral jsonb_array_elements(v.detalle) c
    cross join lateral jsonb_array_elements(c -> 'items') i
), metodos as (
  -- Se toma de TODOS los tickets, devoluciones incluidas: una devolución en
  -- efectivo es dinero que sale del cajón y el desglose por método tiene que
  -- reflejarlo, o no cuadra con el arqueo.
  select p.key as metodo, sum(p.value::text::numeric) as importe
    from t cross join lateral jsonb_each(t.pagos) p
   where jsonb_typeof(p.value) = 'number'
   group by p.key
)
select jsonb_build_object(
  'desde', p_desde, 'hasta', p_hasta,
  'zona', (select tz from loc),

  'resumen', jsonb_build_object(
    'tickets',    (select count(*) from ventas),
    'bruto',      coalesce((select sum(v.total) from ventas v), 0),
    'devuelto',   coalesce((select -sum(d.total) from devoluciones d), 0),
    'devoluciones', (select count(*) from devoluciones),
    'neto',       coalesce((select sum(x.total) from t x), 0),
    'propinas',   coalesce((select sum(v.propina) from ventas v), 0),
    'comensales', coalesce((select sum(jsonb_array_length(v.detalle)) from ventas v), 0),
    -- El medio sale de las VENTAS, no de todos los tickets: contar una
    -- devolución como un ticket más lo hunde sin que nadie entienda por qué.
    'medio', case when (select count(*) from ventas) > 0
                  then round(coalesce((select sum(v.total) from ventas v), 0) / (select count(*) from ventas), 2)
                  else 0 end
  ),

  'por_producto', coalesce((
    select jsonb_agg(x order by x.importe desc) from (
      select producto as nombre, sum(uds) as uds, round(sum(importe), 2) as importe
        from lineas group by producto
    ) x), '[]'::jsonb),

  -- Quién ATENDIÓ y quién COBRÓ son cosas distintas, y mezclarlas era engañoso:
  -- en un bar cobra quien está en la caja, no quien sirvió la mesa.
  'por_camarero', coalesce((
    select jsonb_agg(x order by x.importe desc) from (
      select coalesce(v.camarero, 'Sin asignar') as nombre,
             count(*) as tickets, round(sum(v.total), 2) as importe,
             round(sum(v.propina), 2) as propinas
        from ventas v group by coalesce(v.camarero, 'Sin asignar')
    ) x), '[]'::jsonb),

  'por_cobrador', coalesce((
    select jsonb_agg(x order by x.importe desc) from (
      select coalesce(v.cobrado_por, 'Sin asignar') as nombre,
             count(*) as tickets, round(sum(v.total), 2) as importe
        from ventas v group by coalesce(v.cobrado_por, 'Sin asignar')
    ) x), '[]'::jsonb),

  'por_hora', coalesce((
    select jsonb_agg(x order by x.hora) from (
      select extract(hour from v.cerrado_en at time zone v.tz)::int as hora,
             count(*) as tickets, round(sum(v.total), 2) as importe
        from ventas v
       group by extract(hour from v.cerrado_en at time zone v.tz)::int
    ) x), '[]'::jsonb),

  'por_dia', coalesce((
    select jsonb_agg(x order by x.dia) from (
      select (v.cerrado_en at time zone v.tz)::date as dia,
             count(*) as tickets, round(sum(v.total), 2) as importe
        from ventas v group by (v.cerrado_en at time zone v.tz)::date
    ) x), '[]'::jsonb),

  'por_metodo', coalesce((
    select jsonb_agg(jsonb_build_object('metodo', m.metodo, 'importe', round(m.importe, 2))
                     order by m.importe desc)
      from metodos m), '[]'::jsonb)
)
$$;

revoke all on function informe_ventas(timestamptz, timestamptz) from public, anon, authenticated;
-- Son las ventas del bar: solo el personal con sesión.
grant execute on function informe_ventas(timestamptz, timestamptz) to authenticated;
