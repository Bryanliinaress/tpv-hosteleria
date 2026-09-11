-- ────────────────────────────────────────────────────────────────────────────
-- 49. Qué facturas se han mandado por correo, a quién y si llegó a salir.
--
-- Desde ahora el correo con la factura sale del servidor (Edge Function
-- `enviar-factura`, por Resend) y no del navegador. Cada intento se apunta:
-- «¿me la mandaste?» es de las primeras cosas que pregunta una gestoría, y un
-- envío que falló tiene que poder verse en vez de darse por hecho.
--
-- Solo escribe la Edge Function (service_role). El personal lo lee.
-- Lleva un correo electrónico, que es un dato personal: se borra con su
-- factura solo si algún día se borra el local (`cascade` desde locales).
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists envios_factura (
  id           uuid primary key default gen_random_uuid(),
  local_id     uuid not null references locales on delete cascade,
  factura_id   uuid not null references facturas on delete restrict,
  para         text not null,
  estado       text not null check (estado in ('enviado', 'error')),
  proveedor_id text,
  error        text,
  creado_en    timestamptz not null default now()
);

create index if not exists envios_factura_por_factura on envios_factura (factura_id, creado_en desc);

alter table envios_factura enable row level security;
do $$ begin
  create policy tenant_leer on envios_factura for select to authenticated
    using (local_id = local_actual());
exception when duplicate_object then null; end $$;
