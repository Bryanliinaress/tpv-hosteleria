-- ────────────────────────────────────────────────────────────────────────────
-- 46. Un ticket con factura no se devuelve por la vía del ticket.
--
-- La devolución emite una rectificativa **R5**, que corrige una factura
-- SIMPLIFICADA (el ticket, F2). Pero en cuanto el cliente pidió factura, ese
-- F2 quedó SUSTITUIDO por una F3 (migración 45). Rectificar el F2 sería
-- corregir un documento que ya no es el que vale: la AEAT tendría la F3 con el
-- importe entero y una R5 restando de algo sustituido. Lo que corresponde ahí
-- es rectificar la F3 (R1–R4), y ese circuito no existe todavía.
--
-- Hasta que exista, se impide: mejor un «no se puede» claro en el mostrador
-- que un registro fiscal que no cuadra y que nadie ve hasta la inspección.
--
-- Va como trigger y no dentro de `emitir_rectificativa` a propósito: esa
-- función ya tiene cinco comprobaciones y un reparto de céntimos delicado, y
-- esto es una regla sobre QUÉ se puede insertar en `tickets`, venga de donde
-- venga.
-- ────────────────────────────────────────────────────────────────────────────

create or replace function _no_rectificar_facturado() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.rectifica_a is not null
     and exists (select 1 from facturas f where f.ticket_id = new.rectifica_a) then
    raise exception 'ticket_facturado';
  end if;
  return new;
end $$;

revoke all on function _no_rectificar_facturado() from public, anon, authenticated;

drop trigger if exists trg_no_rectificar_facturado on tickets;
create trigger trg_no_rectificar_facturado before insert on tickets
  for each row when (new.rectifica_a is not null)
  execute function _no_rectificar_facturado();
