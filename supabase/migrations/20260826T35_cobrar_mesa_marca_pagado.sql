-- ───────────────────────────────────────────────────────────────────────────
-- Un ticket cobrado en mostrador salía como PENDIENTE DE PAGO.
--
-- `cobrar_mesa` (cobrar la cuenta entera en la barra, que es como cobra un bar
-- la mayoría de las veces) llamaba a `_cerrar_grupo` SIN tocar `comensales`.
-- El dinero se registraba bien —`pagos` lleva el desglose y el arqueo cuadra—
-- pero `_detalle_grupo` fotografía `c.pagado` y `c.metodo_pago`, y los dejaba
-- en `false` y `null` para todo el mundo.
--
-- Consecuencia: al reimprimir el ticket desde Admin → Tickets, el papel que se
-- le da a un cliente que YA HA PAGADO dice «PENDIENTE DE PAGO» y no lleva línea
-- de método de pago. `pagar_parte` y el cobro online sí marcaban al comensal,
-- por eso solo fallaban los cobrados en mostrador.
--
-- Aquí se marca al comensal ANTES de cerrar. Se respeta a quien ya hubiera
-- pagado su parte (`where not pagado`, y `coalesce` en método y cobrador): en
-- una cuenta a medias no se puede pisar el método real de quien ya pagó.
--
-- El método sale del desglose `p_pagos`: si solo hay uno, ese; si hay varios,
-- 'mixto' —el mismo criterio que usa el cliente en useStore.js—; si no viene
-- ninguno, 'efectivo', que es el valor por defecto de la propia función.
-- 'descuento' no es un método de pago: es un apunte que `_cerrar_grupo` añade
-- al desglose, y contarlo daría 'mixto' en cobros de un solo método.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function cobrar_mesa(
  p_mesa uuid, p_pagos jsonb default '{}'::jsonb, p_propina numeric default 0,
  p_cobrado_por text default null, p_descuento numeric default 0
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_local uuid := _local_o_error();
  v_grupo uuid[];
  v_metodos text[];
  v_metodo text;
begin
  if not exists (select 1 from mesas where id = p_mesa and local_id = v_local) then
    raise exception 'mesa_no_existe';
  end if;
  if coalesce(p_descuento, 0) < 0 then raise exception 'descuento_invalido'; end if;
  v_grupo := _grupo_de(p_mesa);

  select coalesce(array_agg(k), '{}')
    into v_metodos
    from jsonb_object_keys(coalesce(p_pagos, '{}'::jsonb)) k
   where k not in ('descuento', 'sincobrar');

  v_metodo := case
    when array_length(v_metodos, 1) is null then 'efectivo'
    when array_length(v_metodos, 1) = 1     then v_metodos[1]
    else 'mixto'
  end;

  update comensales
     set pagado      = true,
         metodo_pago = coalesce(metodo_pago, v_metodo),
         cobrado_por = coalesce(cobrado_por, p_cobrado_por)
   where mesa_id = any(v_grupo)
     and not pagado;

  return _cerrar_grupo(v_grupo, p_propina, p_pagos, p_cobrado_por, p_cobrado_por, p_descuento);
end $$;

-- Supabase concede EXECUTE a anon y authenticated en cuanto se crea/reemplaza
-- una función (alter default privileges). Se revoca y se vuelve a conceder solo
-- a quien debe: esta cobra dinero.
revoke all on function cobrar_mesa(uuid, jsonb, numeric, text, numeric)
  from public, anon;
grant execute on function cobrar_mesa(uuid, jsonb, numeric, text, numeric)
  to authenticated;
