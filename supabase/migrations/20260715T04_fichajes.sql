-- ============================================================================
-- TPV Hostelería · Migración 04: fichajes de jornada
-- (registro horario obligatorio, RD-ley 8/2019 — conservar 4 años)
-- El esquema 01 no lo incluía; el front v0.27 ya los gestiona.
-- ============================================================================
create table if not exists fichajes (
  id           uuid primary key default gen_random_uuid(),
  local_id     uuid not null references locales on delete cascade,
  empleado_id  uuid not null references empleados on delete cascade,
  entrada      timestamptz not null default now(),
  salida       timestamptz,
  -- correcciones manuales del admin quedan auditadas
  editado_por  text,
  creado_en    timestamptz not null default now()
);
create index if not exists fichajes_local_fecha on fichajes (local_id, entrada);
alter table fichajes enable row level security;
drop policy if exists tenant_all on fichajes;
create policy tenant_all on fichajes for all to authenticated
  using (local_id = local_actual()) with check (local_id = local_actual());
