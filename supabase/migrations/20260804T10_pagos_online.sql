-- ============================================================================
-- TPV Hostelería · Migración 10: pagos online confirmados en servidor
--
-- El webhook de Stripe llama a `registrar_pago_online` cuando el dinero ha
-- entrado DE VERDAD. Antes se marcaba pagado con lo que decía el navegador,
-- que ni es fiable (si el cliente cierra el móvil, se pierde) ni es seguro
-- (una URL manipulada marcaba como pagada una cuenta sin cobrar).
--
-- Es IDEMPOTENTE: Stripe reintenta sus avisos, y un mismo pago no puede
-- cobrarse dos veces ni generar dos tickets.
-- ============================================================================

create table if not exists pagos_online (
  id          uuid primary key default gen_random_uuid(),
  local_id    uuid references locales on delete cascade,
  mesa_id     uuid,
  comensal_id uuid,
  importe     numeric(10,2) not null,
  propina     numeric(10,2) not null default 0,
  referencia  text not null unique,          -- id de la sesión de Stripe
  ticket      bigint,                        -- ticket emitido, si cerró la mesa
  creado_en   timestamptz not null default now()
);
create index if not exists pagos_online_local on pagos_online (local_id, creado_en);

alter table pagos_online enable row level security;
drop policy if exists tenant_all on pagos_online;
create policy tenant_all on pagos_online for all to authenticated
  using (local_id = local_actual()) with check (local_id = local_actual());

-- Registra el cobro y cierra lo que corresponda. La llama el webhook con
-- service_role (por eso no se concede a anon ni a authenticated).
create or replace function registrar_pago_online(
  p_mesa uuid, p_comensal uuid, p_importe numeric, p_propina numeric,
  p_referencia text, p_local uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_local uuid;
  v_grupo uuid[];
  v_ticket bigint;
  v_cerrada boolean := false;
begin
  -- idempotencia: si ya procesamos este pago, devolvemos lo mismo sin repetir
  if exists (select 1 from pagos_online where referencia = p_referencia) then
    select jsonb_build_object('repetido', true, 'ticket', ticket)
      into v_ticket from pagos_online where referencia = p_referencia limit 1;
    return jsonb_build_object('repetido', true);
  end if;

  select local_id into v_local from mesas where id = p_mesa;
  if v_local is null then raise exception 'mesa_no_existe'; end if;

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
