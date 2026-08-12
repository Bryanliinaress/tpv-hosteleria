-- ────────────────────────────────────────────────────────────────────────────
-- 17. El camino de «este pago ya lo procesé» estaba roto.
--
-- Stripe reintenta un aviso hasta que le respondes 200, así que el mismo cobro
-- llega varias veces. Para eso está el bloque de idempotencia… que hacía esto:
--
--     select jsonb_build_object('repetido', true, 'ticket', ticket)
--       into v_ticket ...        -- v_ticket es BIGINT y eso es JSONB
--
-- Mete un jsonb en una variable bigint: revienta con «invalid input syntax for
-- type bigint». Nunca se había visto porque `pagos_online` estaba siempre
-- vacía —ningún pago llegaba a registrarse por otro fallo— así que la rama del
-- repetido no se ejecutaba jamás. En cuanto entre el primer pago de verdad,
-- el primer reintento de Stripe se encuentra con esto.
--
-- De paso devuelve el ticket, que es lo que se pretendía: quien pregunta por
-- un pago repetido quiere saber en qué ticket acabó.
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

  -- ¿el dinero que ha entrado cubre lo que se debía? La propina no cuenta:
  -- es un extra, no parte de la cuenta. Si no llega, el pago se registra
  -- igualmente (el dinero está cobrado) pero la cuenta NO se da por saldada.
  v_pendiente := pendiente_de_pago(p_mesa, p_comensal);
  if coalesce(p_importe, 0) - coalesce(p_propina, 0) + 0.01 < v_pendiente then
    insert into pagos_online (local_id, mesa_id, comensal_id, importe, propina, referencia, ticket)
    values (v_local, p_mesa, p_comensal, p_importe, coalesce(p_propina, 0), p_referencia, null);
    return jsonb_build_object(
      'insuficiente', true,
      'pendiente', round(v_pendiente - (coalesce(p_importe, 0) - coalesce(p_propina, 0)), 2));
  end if;

  if p_comensal is not null then
    -- pago de "mi parte": marcar ese comensal
    update comensales
      set pagado = true, propina = coalesce(p_propina, 0),
          metodo_pago = 'online', cobrado_por = 'Pago online'
      where id = p_comensal and mesa_id = any(_grupo_de(p_mesa));
    -- ¿era el último? entonces se cierra la mesa y sale el ticket
    v_grupo := _grupo_de(p_mesa);
    if not exists (select 1 from comensales where mesa_id = any(v_grupo) and not pagado) then
      v_ticket := _cerrar_grupo(v_grupo, coalesce(p_propina, 0),
                                jsonb_build_object('online', p_importe), 'Pago online', 'Pago online');
      v_cerrada := true;
    end if;
  else
    -- pago de la cuenta completa
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
