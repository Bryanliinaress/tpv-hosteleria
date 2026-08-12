-- ────────────────────────────────────────────────────────────────────────────
-- 18. Un pago que llega cuando ya no se debe nada NO puede emitir un ticket.
--
-- Pasó de verdad: dos cobros de la misma mesa con 70 segundos de diferencia.
-- El primero cerró la mesa; cuando llegó el segundo, el grupo ya estaba vacío,
-- y `_cerrar_grupo` emitió un ticket **sin líneas y con total 0,00 €** con
-- 4,40 € cobrados dentro. La caja quedó así:
--
--     Ventas 13,90 €   ·   desglose por método 18,30 €
--
-- En un bar esto es constante: dos comensales de la misma mesa pulsan «pagar»
-- a la vez desde sus móviles. El segundo paga, no queda constancia de qué, y
-- el arqueo descuadra sin que nadie sepa por qué.
--
-- Ahora ese dinero se registra igual —está cobrado, no se puede perder— pero
-- como pago SIN cuenta (`ticket = null`), y no se emite ticket ni se cierra
-- nada. Se devuelve `sobrante: true` para que el webhook lo deje en su log y
-- se pueda localizar para devolverlo.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function registrar_pago_online(
  p_mesa uuid, p_comensal uuid, p_importe numeric, p_propina numeric,
  p_referencia text, p_local uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_local uuid;
  v_grupo uuid[];
  v_ticket bigint;
  v_pendiente numeric;
  v_cerrada boolean := false;
begin
  -- idempotencia: si ya procesamos este pago, devolvemos lo mismo sin repetir
  if exists (select 1 from pagos_online where referencia = p_referencia) then
    select ticket into v_ticket from pagos_online where referencia = p_referencia limit 1;
    return jsonb_build_object('repetido', true, 'ticket', v_ticket);
  end if;

  select local_id into v_local from mesas where id = p_mesa;
  if v_local is null then raise exception 'mesa_no_existe'; end if;

  v_pendiente := pendiente_de_pago(p_mesa, p_comensal);

  -- Nadie debe nada: la cuenta ya se saldó (otro comensal se adelantó, o el
  -- camarero cobró en efectivo). El dinero entró, así que se guarda, pero no
  -- hay cuenta que cerrar ni ticket que emitir.
  if coalesce(v_pendiente, 0) <= 0 then
    insert into pagos_online (local_id, mesa_id, comensal_id, importe, propina, referencia, ticket)
    values (v_local, p_mesa, p_comensal, p_importe, coalesce(p_propina, 0), p_referencia, null);
    return jsonb_build_object('sobrante', true, 'importe', p_importe);
  end if;

  -- ¿el dinero que ha entrado cubre lo que se debía? La propina no cuenta:
  -- es un extra, no parte de la cuenta. Si no llega, el pago se registra
  -- igualmente (el dinero está cobrado) pero la cuenta NO se da por saldada.
  if coalesce(p_importe, 0) - coalesce(p_propina, 0) + 0.01 < v_pendiente then
    insert into pagos_online (local_id, mesa_id, comensal_id, importe, propina, referencia, ticket)
    values (v_local, p_mesa, p_comensal, p_importe, coalesce(p_propina, 0), p_referencia, null);
    return jsonb_build_object(
      'insuficiente', true,
      'pendiente', round(v_pendiente - (coalesce(p_importe, 0) - coalesce(p_propina, 0)), 2));
  end if;

  if p_comensal is not null then
    update comensales
      set pagado = true, propina = coalesce(p_propina, 0),
          metodo_pago = 'online', cobrado_por = 'Pago online'
      where id = p_comensal and mesa_id = any(_grupo_de(p_mesa));
    v_grupo := _grupo_de(p_mesa);
    if not exists (select 1 from comensales where mesa_id = any(v_grupo) and not pagado) then
      v_ticket := _cerrar_grupo(v_grupo, coalesce(p_propina, 0),
                                jsonb_build_object('online', p_importe), 'Pago online', 'Pago online');
      v_cerrada := true;
    end if;
  else
    v_grupo := _grupo_de(p_mesa);
    v_ticket := _cerrar_grupo(v_grupo, coalesce(p_propina, 0),
                              jsonb_build_object('online', p_importe), 'Pago online', 'Pago online');
    v_cerrada := true;
  end if;

  insert into pagos_online (local_id, mesa_id, comensal_id, importe, propina, referencia, ticket)
  values (v_local, p_mesa, p_comensal, p_importe, coalesce(p_propina, 0), p_referencia, v_ticket);

  return jsonb_build_object('cerrada', v_cerrada, 'ticket', v_ticket);
end $$;

grant execute on function registrar_pago_online(uuid, uuid, numeric, numeric, text, uuid) to service_role;
revoke all on function registrar_pago_online(uuid, uuid, numeric, numeric, text, uuid)
  from public, anon, authenticated;
