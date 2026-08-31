-- ───────────────────────────────────────────────────────────────────────────
-- Entradas y salidas de dinero del cajón que no son ventas.
--
-- El arqueo Z calculaba «efectivo esperado = ventas en efectivo + propinas en
-- metálico». Le faltaba TODO lo demás que pasa por un cajón en un día normal:
--
--   · el FONDO de cambio con el que se abre (150 € en monedas y billetes
--     pequeños que están ahí desde antes de la primera venta),
--   · el dinero que se SACA para pagar al del pan, o para llevar la recaudación
--     al banco a media tarde,
--   · el que se METE porque se acabó el cambio.
--
-- Sin eso, el descuadre que enseñaba la pantalla no era un descuadre: era la
-- diferencia entre lo contado y una cuenta incompleta. Salía «sobran 150 €»
-- todos los días y se dejaba de mirar — que es la peor forma de tener un
-- control de caja, porque parece que lo tienes.
--
-- El fondo vive en la configuración del local (`config.fondoCaja`): es un
-- número que se pone una vez y no cambia a diario. Los movimientos, aquí.
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists movimientos_caja (
  id          uuid primary key default gen_random_uuid(),
  local_id    uuid not null references locales on delete cascade,
  -- 'entrada': dinero que ENTRA en el cajón y no es una venta (más cambio).
  -- 'salida':  dinero que SALE (pagar a un proveedor, retirar recaudación).
  tipo        text not null check (tipo in ('entrada', 'salida')),
  importe     numeric(10,2) not null check (importe > 0),
  -- Un movimiento de caja sin motivo es dinero que desapareció: se exige.
  motivo      text not null check (btrim(motivo) <> ''),
  creado_por  text,
  creado_en   timestamptz not null default now()
);
create index if not exists movimientos_local_fecha on movimientos_caja (local_id, creado_en);

alter table movimientos_caja enable row level security;
drop policy if exists tenant_all on movimientos_caja;
create policy tenant_all on movimientos_caja for all to authenticated
  using (local_id = local_actual()) with check (local_id = local_actual());

-- El cierre guarda lo que había en el cajón por encima de las ventas, para que
-- un arqueo viejo se pueda releer sin recalcular nada.
alter table cierres_caja add column if not exists fondo        numeric(10,2) not null default 0;
alter table cierres_caja add column if not exists movimientos  numeric(10,2) not null default 0;
