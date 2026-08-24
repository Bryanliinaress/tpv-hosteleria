-- ────────────────────────────────────────────────────────────────────────────
-- Facturas rectificativas (devoluciones).
--
-- El agujero: un ticket ya registrado en la AEAT no se puede borrar ni editar.
-- Si el bar cobró de más y el cliente reclama al día siguiente —que en un bar
-- pasa—, hasta ahora no había salida: el dinero salía del cajón y en Hacienda
-- seguía constando la venta original.
--
-- Lo que exige la norma es emitir una FACTURA RECTIFICATIVA. Como el original
-- es una factura simplificada (F2), la rectificativa es siempre **R5**, sea cual
-- sea el motivo.
--
-- POR DIFERENCIAS, NO POR SUSTITUCIÓN. Las dos son válidas; se elige «I» porque
-- en un bar la devolución es dinero que sale del cajón, y así la caja, los
-- informes y lo que consta en la AEAT dicen EL MISMO número. Por sustitución el
-- documento diría «esto eran 8 € y no 11 €» y el movimiento de caja habría que
-- deducirlo, que es justo como se descuadra un arqueo.
--
-- Una rectificativa es un TICKET MÁS, con importe negativo y apuntando al que
-- corrige. Así entra sola por donde ya pasa todo: se numera con el mismo
-- contador (la serie sigue siendo correlativa y sin huecos, que es lo que pide
-- Verifactu), se registra en la AEAT por la misma vía con sus reintentos, resta
-- en el arqueo y sale en los informes. Nada de un circuito paralelo.
-- ────────────────────────────────────────────────────────────────────────────

alter table tickets add column if not exists rectifica_a uuid references tickets on delete restrict;
alter table tickets add column if not exists motivo_rectificacion text;
create index if not exists tickets_rectifica on tickets (rectifica_a) where rectifica_a is not null;

-- ── Cuánto queda por devolver de un ticket ──────────────────────────────────
-- El original menos lo ya rectificado. Impide devolver dos veces lo mismo, que
-- es la forma más fácil de que se vaya dinero sin que nadie lo note.
create or replace function _pendiente_de_rectificar(p_ticket uuid) returns numeric
language sql stable set search_path = public as $$
  select greatest(
    (select t.total from tickets t where t.id = p_ticket)
    + coalesce((select sum(r.total) from tickets r where r.rectifica_a = p_ticket), 0),
  0)
$$;
revoke all on function _pendiente_de_rectificar(uuid) from public, anon, authenticated;

-- ── Emitir la rectificativa ─────────────────────────────────────────────────
--
-- `p_importe` null = devolución completa. Si es parcial, se reparte entre los
-- tipos de IVA del original EN PROPORCIÓN, y los céntimos sueltos se reparten de
-- forma que la suma cuadre exactamente con lo devuelto (misma técnica que el
-- reparto de un plato compartido: si cada parte se redondea por su cuenta, la
-- suma se va un céntimo).
create or replace function emitir_rectificativa(
  p_ticket uuid,
  p_motivo text,
  p_importe numeric default null,
  p_metodo text default 'efectivo',
  p_por text default null
) returns table (id uuid, numero bigint, total numeric)
language plpgsql security definer set search_path = public as $$
declare
  v_local uuid := _local_o_error();
  v_orig tickets%rowtype;
  v_pendiente numeric;
  v_importe numeric;
  v_detalle jsonb;
  v_nuevo tickets%rowtype;
begin
  if coalesce(btrim(p_motivo), '') = '' then
    raise exception 'motivo_obligatorio';
  end if;

  -- Se bloquea el original: dos devoluciones a la vez del mismo ticket podrían
  -- devolver cada una el total entero.
  select * into v_orig from tickets t
   where t.id = p_ticket and t.local_id = v_local
     for update;
  if not found then raise exception 'ticket_no_existe'; end if;
  if v_orig.rectifica_a is not null then raise exception 'ya_es_rectificativa'; end if;

  v_pendiente := _pendiente_de_rectificar(p_ticket);
  v_importe := round(coalesce(p_importe, v_pendiente), 2);

  if v_importe <= 0 then raise exception 'importe_invalido'; end if;
  if v_importe > v_pendiente then raise exception 'supera_lo_pendiente'; end if;

  -- Detalle de la rectificativa: una línea por tipo de IVA del original, con el
  -- importe en negativo. Se construye así a propósito, para que el desglose lo
  -- calcule `desglose_iva_ticket` como en cualquier otro ticket en vez de tener
  -- otra fórmula escrita aparte.
  with base as (
    select d.iva_pct as iva_pct, d.total as total,
           row_number() over (order by d.iva_pct) as orden,
           sum(d.total) over () as suma
      from desglose_iva_ticket(p_ticket) d
     where d.total <> 0
  ), repartido as (
    -- Reparto proporcional con los céntimos cuadrados: cada parte es la
    -- diferencia entre dos acumulados YA redondeados. Redondeando cada parte
    -- por su cuenta, la suma se va un céntimo de lo que se devuelve.
    --
    -- Ojo con cualificar `base.total`: `total` es también un parámetro de
    -- SALIDA de esta función, y sin el alias Postgres no sabe a cuál te
    -- refieres («column reference "total" is ambiguous»). Es la misma trampa
    -- que ya mordió en `solicitar_dispositivo`.
    select base.iva_pct,
           round(v_importe * (sum(base.total) over (order by base.orden rows unbounded preceding)) / base.suma, 2)
             - round(v_importe * (coalesce(sum(base.total) over (order by base.orden rows between unbounded preceding and 1 preceding), 0)) / base.suma, 2)
             as parte
      from base
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'nombre', 'Devolución (IVA ' || repartido.iva_pct || '%)',
           'precio', -repartido.parte, 'cantidad', 1, 'tipo', 'comida',
           'ivaPct', repartido.iva_pct)), '[]'::jsonb)
    into v_detalle
    from repartido where repartido.parte <> 0;

  insert into tickets (
    local_id, mesa_numero, total, propina, pagos, detalle, camarero, cobrado_por,
    rectifica_a, motivo_rectificacion
  ) values (
    v_local, v_orig.mesa_numero, -v_importe, 0,
    jsonb_build_object(coalesce(nullif(btrim(p_metodo), ''), 'efectivo'), -v_importe),
    jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid(), 'nombre', 'Devolución', 'pagado', true,
      'propina', 0, 'metodoPago', p_metodo, 'cobradoPor', p_por,
      'items', v_detalle)),
    v_orig.camarero, p_por, p_ticket, left(btrim(p_motivo), 300)
  ) returning * into v_nuevo;

  -- Queda registrado en la auditoría de anulaciones, que es donde el encargado
  -- ya mira cuando algo no cuadra.
  insert into anulaciones (local_id, nombre, precio, cantidad, motivo, por)
  values (v_local,
          'Rectificativa del ticket ' || v_orig.numero,
          -v_importe, 1, left(btrim(p_motivo), 300), p_por);

  return query select v_nuevo.id, v_nuevo.numero, v_nuevo.total;
end $$;

revoke all on function emitir_rectificativa(uuid, text, numeric, text, text) from public, anon, authenticated;
-- La emite el personal desde Admin. `anon` NO: es dinero saliendo del cajón.
grant execute on function emitir_rectificativa(uuid, text, numeric, text, text) to authenticated;

-- ── Lo que se manda a Hacienda ──────────────────────────────────────────────
-- Se añade `rectifica`: si viene, la Edge Function compone una R5 en lugar de
-- una F2. Los tickets normales no traen nada y siguen igual.
create or replace function ticket_para_fiscal(p_ticket uuid)
returns jsonb
language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'id', t.id,
    'numero', t.numero,
    'fecha', t.cerrado_en,
    'total', t.total,
    'detalle', t.detalle,
    'estado', t.fiscal_estado,
    'desglose', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'ivaPct', d.iva_pct, 'base', d.base, 'cuota', d.cuota)), '[]'::jsonb)
      from desglose_iva_ticket(t.id) d
    ),
    -- Datos de la factura que se corrige. La serie es la misma: este producto
    -- lleva UNA serie correlativa para todo lo que emite el bar.
    'rectifica', (
      select jsonb_build_object(
        'numero', o.numero,
        'fecha', o.cerrado_en,
        'motivo', t.motivo_rectificacion)
      from tickets o where o.id = t.rectifica_a
    ),
    'emisor', jsonb_build_object(
      'nif', l.config ->> 'cif',
      'nombre', coalesce(l.config ->> 'razonSocial', l.nombre),
      'serie', coalesce(l.config ->> 'serieFiscal', 'TPV'),
      'ivaPct', coalesce((l.config ->> 'ivaPct')::numeric, 10)))
  from tickets t join locales l on l.id = t.local_id
  where t.id = p_ticket
$$;
revoke all on function ticket_para_fiscal(uuid) from public, anon, authenticated;
