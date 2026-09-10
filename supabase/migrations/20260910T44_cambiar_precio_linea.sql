-- ────────────────────────────────────────────────────────────────────────────
-- 44. Cambiarle el precio a una línea.
--
-- Pasa todos los días en un bar: el menú del día se cobra a precio de menú
-- aunque los platos vengan de la carta, se le hace un precio a la mesa grande,
-- se rebaja un plato que salió tarde, o el de la pizarra se tecleó mal.
-- Hasta ahora la única salida era anular la línea y volver a meterla, lo que
-- deja una anulación falsa en la auditoría y una comanda repetida en cocina.
--
-- ⚠️ Cambiar un precio es, literalmente, la forma en que el dinero se va de un
-- bar sin que nadie robe nada. Por eso esto NO es un `update` a secas:
--
--   · queda registro de qué línea, cuánto valía, cuánto vale, quién y por qué
--     — exactamente igual que `anulaciones` (migración 02);
--   · se concede SOLO a `authenticated`, nunca a `anon`: el cliente del QR no
--     puede tocar el precio de lo que pide, que es la regla de toda la casa;
--   · no se toca una línea ya COBRADA. Ese importe ya está en un ticket
--     registrado en la AEAT; cambiarlo dejaría la cuenta y el ticket diciendo
--     cosas distintas. Para eso está la rectificativa.
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists cambios_precio (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references locales on delete cascade,
  linea_id uuid,                       -- sin FK: la línea puede irse después
  nombre text not null,
  antes numeric(10,2) not null,
  despues numeric(10,2) not null,
  cantidad int not null,
  motivo text,
  por text,
  creado_en timestamptz not null default now()
);

alter table cambios_precio enable row level security;
do $$ begin
  create policy tenant_all on cambios_precio for all to authenticated
    using (local_id = local_actual()) with check (local_id = local_actual());
exception when duplicate_object then null; end $$;

create index if not exists cambios_precio_local_fecha on cambios_precio (local_id, creado_en desc);

create or replace function cambiar_precio_linea(
  p_linea uuid, p_precio numeric, p_motivo text default null, p_por text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_local uuid := _local_o_error();
  v_l lineas_pedido%rowtype;
  v_nuevo numeric := round(p_precio, 2);
begin
  if p_precio is null or v_nuevo < 0 or v_nuevo > 999.99 then
    raise exception 'precio_invalido';
  end if;

  select l.* into v_l from lineas_pedido l
   where l.id = p_linea and l.local_id = v_local for update;
  if not found then raise exception 'linea_no_existe'; end if;

  -- Una línea de un comensal que ya pagó está dentro de un ticket fiscal.
  if exists (select 1 from comensales c where c.id = v_l.comensal_id and c.pagado) then
    raise exception 'linea_ya_cobrada';
  end if;

  -- Cambiar por el mismo precio no es un cambio: no ensucia la auditoría.
  if v_l.precio = v_nuevo then return; end if;

  insert into cambios_precio (local_id, linea_id, nombre, antes, despues, cantidad, motivo, por)
  values (v_local, v_l.id, v_l.nombre, v_l.precio, v_nuevo, v_l.cantidad,
          nullif(left(coalesce(p_motivo, ''), 200), ''), p_por);

  update lineas_pedido set precio = v_nuevo where id = p_linea;
  -- La comanda no lleva precio: cocina no se entera, y no tiene por qué.
end $$;

comment on function cambiar_precio_linea(uuid, numeric, text, text) is
  'Cambia el precio de una línea NO cobrada dejando registro en cambios_precio. Solo personal.';

-- ── Permisos ────────────────────────────────────────────────────────────────
-- Supabase concede EXECUTE a anon y authenticated en cuanto se crea una
-- función. Que `anon` pueda llamar a esto es poder rebajarse la cuenta.
revoke all on function cambiar_precio_linea(uuid, numeric, text, text) from public, anon, authenticated;
grant execute on function cambiar_precio_linea(uuid, numeric, text, text) to authenticated;
