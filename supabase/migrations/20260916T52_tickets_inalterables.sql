-- ────────────────────────────────────────────────────────────────────────────
-- 51. Un ticket emitido no se toca.
--
-- El RRSIF (RD 1007/2023, art. 8.2.a) exige que los registros de facturación,
-- una vez generados, «no puedan ser alterados sin que el sistema informático lo
-- detecte y avise de ello».
--
-- Hasta aquí, `tickets` llevaba la política de la migración 01:
--
--     create policy tenant_all on tickets for all to authenticated
--       using (local_id = local_actual()) with check (local_id = local_actual())
--
-- `for all` incluye **update y delete**. Cualquier dispositivo autorizado del
-- local podía cambiar el importe de un ticket ya cobrado y ya registrado en
-- Hacienda, o borrarlo, y no había trigger, ni huella local, ni aviso que lo
-- detectara. Un TPV en el que el ticket nº 12 puede pasar de 48 € a 8 € sin
-- dejar rastro no cumple el artículo, y tampoco es un TPV.
--
-- Las **facturas** ya se hicieron bien en la migración 45, con el comentario
-- que lo explica todo: «una factura que se puede editar con un `update` no es
-- una factura». Los tickets son de junio y nadie volvió a mirarlos.
--
-- A partir de aquí el personal **lee** sus tickets y nada más. Lo que sí tiene
-- que seguir escribiéndolos sigue funcionando igual, porque no pasa por RLS:
--
--   · el cobro los crea desde las RPC transaccionales (`security definer`);
--   · `fiscal_resultado` (migración 08) guarda el resultado del envío a la
--     AEAT — `security definer`, la llama la Edge Function;
--   · `reembolso_resultado` (migración 34) anota la devolución — igual;
--   · el servicio de impresión entra con `service_role`, que se salta RLS.
--
-- Comprobado antes de tocar nada: no hay una sola escritura directa a `tickets`
-- desde el navegador. La única referencia fuera de las RPC es un `select` del
-- servicio de impresión.
--
-- No se tocan `lineas_pedido` ni `comandas`: son el servicio en curso, no
-- registros de facturación, y se modifican durante la comanda a propósito.
-- ────────────────────────────────────────────────────────────────────────────

drop policy if exists tenant_all on tickets;

do $$ begin
  create policy tenant_leer on tickets for select to authenticated
    using (local_id = local_actual());
exception when duplicate_object then null; end $$;
