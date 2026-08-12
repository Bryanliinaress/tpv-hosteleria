-- ────────────────────────────────────────────────────────────────────────────
-- 14. Compartir un plato entre comensales (fallo 27).
--
-- La columna `lineas_pedido.compartido_con` existe desde la migración 1, pero
-- nadie la escribía y NADIE la leía: en la app real el botón de compartir no
-- hacía nada y la cuenta salía como si el plato fuera de uno solo. En la demo
-- (v1) sí funciona, porque el reparto lo hace el navegador — aquí no puede,
-- porque el importe lo decide el servidor.
--
-- Trae dos cosas:
--   1. `qr_compartir_linea`: el toggle, llamable por el cliente anónimo del QR.
--   2. `_debe_por_comensal`: lo que debe cada uno repartiendo los compartidos,
--      y con ella se recalculan `pendiente_de_pago` y el desglose de
--      `pagar_parte`. Sin esto, Stripe cobraría al dueño del plato el importe
--      entero y el arqueo cuadraría mal.
-- ────────────────────────────────────────────────────────────────────────────

-- ── Lo que debe cada comensal del grupo ─────────────────────────────────────
-- Espejo de owedPorPersona() del cliente. Un plato se reparte entre su dueño y
-- los comensales con los que se comparta QUE SIGAN EN EL GRUPO: si uno se marcha
-- y se le borra, su parte vuelve a repartirse entre los que quedan en vez de
-- desaparecer de la cuenta.
--
-- El redondeo va sobre el ACUMULADO, no parte por parte: redondeando cada una
-- por su cuenta, 20 € entre tres suman 20,01 y el arqueo se va un céntimo en
-- cada mesa compartida. Es la misma corrección que ya lleva el cliente.
create or replace function _debe_por_comensal(p_grupo uuid[])
returns table (comensal_id uuid, importe numeric)
language sql stable set search_path = public as $$
  with socios as (
    select l.precio * l.cantidad as bruto,
           array(select c2.id from comensales c2
                  where c2.mesa_id = any(p_grupo)
                    and (c2.id = l.comensal_id or c2.id = any(l.compartido_con))) as ids
      from lineas_pedido l
      join comensales c on c.id = l.comensal_id
     where c.mesa_id = any(p_grupo)
  ), bruto_por_comensal as (
    select c.id,
           coalesce((select sum(s.bruto / array_length(s.ids, 1))
                       from socios s where c.id = any(s.ids)), 0) as bruto,
           row_number() over (order by c.creado_en, c.id) as orden
      from comensales c
     where c.mesa_id = any(p_grupo)
  ), acumulado as (
    select id,
           round(sum(bruto) over (order by orden rows unbounded preceding), 2) as hasta_aqui,
           round(coalesce(sum(bruto) over (order by orden rows between unbounded preceding and 1 preceding), 0), 2) as hasta_antes
      from bruto_por_comensal
  )
  select id, hasta_aqui - hasta_antes from acumulado
$$;

-- ── El toggle, desde el móvil del cliente ───────────────────────────────────
-- `p_con` tiene que estar sentado en el MISMO grupo de mesas: sin esa
-- comprobación, cualquiera podría colgarle su plato a un comensal de otra mesa.
-- Solo se tocan líneas del propio dueño.
create or replace function qr_compartir_linea(p_linea uuid, p_comensal uuid, p_con uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_mesa uuid;
begin
  if p_con = p_comensal then raise exception 'compartir_consigo_mismo'; end if;

  select c.mesa_id into v_mesa
    from lineas_pedido l join comensales c on c.id = l.comensal_id
   where l.id = p_linea and l.comensal_id = p_comensal;
  if v_mesa is null then raise exception 'linea_no_editable'; end if;

  if not exists (select 1 from comensales
                  where id = p_con and mesa_id = any(_grupo_de(v_mesa))) then
    raise exception 'comensal_no_existe';
  end if;

  update lineas_pedido
     set compartido_con = case
           when p_con = any(compartido_con) then array_remove(compartido_con, p_con)
           else compartido_con || p_con
         end
   where id = p_linea;
end $$;

-- ── El dinero, ahora contando los compartidos ───────────────────────────────
-- Lo pendiente de una mesa (o de un comensal). Antes sumaba las líneas PROPIAS
-- de cada uno, que es justo lo que compartir deja de significar.
create or replace function pendiente_de_pago(p_mesa uuid, p_comensal uuid default null)
returns numeric
language sql security definer set search_path = public stable as $$
  select coalesce(sum(d.importe), 0)
    from _debe_por_comensal(_grupo_de(p_mesa)) d
    join comensales c on c.id = d.comensal_id
   where not c.pagado
     and (p_comensal is null or c.id = p_comensal)
$$;

-- Cobro de "mi parte". Igual que antes salvo el desglose por método de pago,
-- que ahora reparte los platos compartidos en vez de cargárselos a su dueño.
create or replace function pagar_parte(
  p_comensal uuid, p_propina numeric default 0,
  p_metodo text default 'efectivo', p_cobrado_por text default null
) returns table (cerrada boolean, ticket bigint)
language plpgsql security definer set search_path = public as $$
declare
  v_local uuid := _local_o_error();
  v_mesa uuid;
  v_grupo uuid[];
  v_pagos jsonb;
  v_prop numeric;
  v_num bigint;
begin
  update comensales set pagado = true, propina = coalesce(p_propina, 0),
                        metodo_pago = p_metodo, cobrado_por = p_cobrado_por
  where id = p_comensal and local_id = v_local
  returning mesa_id into v_mesa;
  if v_mesa is null then raise exception 'comensal_no_existe'; end if;

  v_grupo := _grupo_de(v_mesa);
  if exists (select 1 from comensales where mesa_id = any(v_grupo) and not pagado) then
    return query select false, null::bigint;
    return;
  end if;

  -- Todos pagados: desglose real por método y propinas acumuladas
  select coalesce(jsonb_object_agg(metodo, importe), '{}'::jsonb),
         coalesce(sum(prop), 0)
    into v_pagos, v_prop
  from (
    select coalesce(c.metodo_pago, 'efectivo') as metodo,
           sum(d.importe) as importe,
           sum(c.propina) as prop
      from comensales c
      join _debe_por_comensal(v_grupo) d on d.comensal_id = c.id
     where c.mesa_id = any(v_grupo)
     group by 1
  ) x;

  v_num := _cerrar_grupo(v_grupo, v_prop, v_pagos, p_cobrado_por, p_cobrado_por);
  return query select true, v_num;
end $$;

grant execute on function qr_compartir_linea(uuid, uuid, uuid) to anon, authenticated;
