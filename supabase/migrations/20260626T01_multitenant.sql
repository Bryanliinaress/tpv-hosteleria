-- ============================================================================
-- TPV Hostelería · Esquema multi-local (Fase 0 de PRODUCCION.md)
-- Un local por negocio, datos aislados con RLS, operaciones por entidad
-- (sustituye a la fila JSONB única de la demo).
--
-- Aplicar con: supabase db push  (o pegar en el SQL editor del proyecto)
-- Requiere: extensión pgcrypto (gen_random_uuid) — activa por defecto.
-- ============================================================================

-- ── Tenants ─────────────────────────────────────────────────────────────────
create table if not exists locales (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,          -- p. ej. 'casa-loli' (URL pública)
  nombre     text not null,
  -- identidad + configuración (subtítulo, CIF, IVA, moneda, pie, reservas…)
  config     jsonb not null default '{}'::jsonb,
  creado_en  timestamptz not null default now()
);

-- ── Personal ────────────────────────────────────────────────────────────────
-- Cada empleado puede vincularse a un usuario de Supabase Auth (login serio del
-- encargado) y además tener un PIN corto (hash) para el cambio rápido de
-- usuario en los dispositivos del local ya autenticados.
create table if not exists empleados (
  id         uuid primary key default gen_random_uuid(),
  local_id   uuid not null references locales on delete cascade,
  user_id    uuid references auth.users on delete set null,
  nombre     text not null,
  rol        text not null default 'camarero' check (rol in ('admin', 'camarero', 'cocina')),
  pin_hash   text,                          -- hash del PIN (nunca en claro)
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);
create index if not exists empleados_local on empleados (local_id);

-- ── Sala ────────────────────────────────────────────────────────────────────
create table if not exists mesas (
  id             uuid primary key default gen_random_uuid(),
  local_id       uuid not null references locales on delete cascade,
  numero         int  not null,
  zona           text not null default 'Sala',
  capacidad      int  not null default 4,
  estado         text not null default 'libre'
                 check (estado in ('libre', 'ocupada', 'esperando_cobro', 'reservada')),
  unida_a        uuid references mesas on delete set null,  -- grupo: cabeza de mesa
  abierta_desde  timestamptz,
  camarero_id    uuid references empleados on delete set null,
  reserva        jsonb,                     -- bloqueo puntual {nombre,hora,personas}
  unique (local_id, numero)
);
create index if not exists mesas_local on mesas (local_id);

-- ── Carta ───────────────────────────────────────────────────────────────────
create table if not exists categorias (
  id        uuid primary key default gen_random_uuid(),
  local_id  uuid not null references locales on delete cascade,
  nombre    text not null,
  tipo      text not null default 'comida' check (tipo in ('comida', 'bebida')),
  emoji     text,
  orden     int not null default 0
);
create index if not exists categorias_local on categorias (local_id);

create table if not exists productos (
  id           uuid primary key default gen_random_uuid(),
  local_id     uuid not null references locales on delete cascade,
  categoria_id uuid not null references categorias on delete cascade,
  nombre       text not null,
  descripcion  text not null default '',
  -- precio único {"base": 2.0} o variantes {"pitufo": 1.5, "viena": 2.5}
  precios      jsonb not null default '{}'::jsonb,
  -- personalización configurable (tipos de pan, extras, quitables…)
  modificadores jsonb not null default '[]'::jsonb,
  alergenos    text[] not null default '{}',
  disponible   boolean not null default true,
  orden        int not null default 0
);
create index if not exists productos_local on productos (local_id);

-- ── Servicio en curso ───────────────────────────────────────────────────────
create table if not exists comensales (
  id          uuid primary key default gen_random_uuid(),
  local_id    uuid not null references locales on delete cascade,
  mesa_id     uuid not null references mesas on delete cascade,
  nombre      text not null,
  pagado      boolean not null default false,
  propina     numeric(10,2) not null default 0,
  metodo_pago text,
  cobrado_por text,
  creado_en   timestamptz not null default now()
);
create index if not exists comensales_mesa on comensales (mesa_id);
create index if not exists comensales_local on comensales (local_id);

create table if not exists lineas_pedido (
  id              uuid primary key default gen_random_uuid(),
  local_id        uuid not null references locales on delete cascade,
  comensal_id     uuid not null references comensales on delete cascade,
  producto_id     uuid references productos on delete set null,
  nombre          text not null,            -- snapshot (por si la carta cambia)
  precio          numeric(10,2) not null,
  cantidad        int not null default 1 check (cantidad > 0),
  tipo            text not null default 'comida' check (tipo in ('comida', 'bebida')),
  estado          text not null default 'pendiente' check (estado in ('pendiente', 'enviado')),
  tiempo          int not null default 1 check (tiempo between 1 and 3),
  personalizacion jsonb not null default '{}'::jsonb,  -- pan, quitados, añadidos, nota
  compartido_con  uuid[] not null default '{}',
  creado_en       timestamptz not null default now()
);
create index if not exists lineas_comensal on lineas_pedido (comensal_id);
create index if not exists lineas_local on lineas_pedido (local_id);

-- Cola de cocina/barra (una comanda por línea enviada)
create table if not exists comandas (
  id            uuid primary key default gen_random_uuid(),
  local_id      uuid not null references locales on delete cascade,
  mesa_id       uuid not null references mesas on delete cascade,
  linea_id      uuid not null references lineas_pedido on delete cascade,
  destino       text not null check (destino in ('cocina', 'barra')),
  estado        text not null default 'recibido'
                check (estado in ('espera', 'recibido', 'preparando', 'listo')),
  tiempo        int not null default 1,
  hora_entrada  timestamptz not null default now()
);
create index if not exists comandas_local_estado on comandas (local_id, estado);

-- ── Avisos (llamadas al camarero) ───────────────────────────────────────────
create table if not exists avisos (
  id        uuid primary key default gen_random_uuid(),
  local_id  uuid not null references locales on delete cascade,
  mesa_id   uuid not null references mesas on delete cascade,
  nombre    text,
  creado_en timestamptz not null default now()
);
create index if not exists avisos_local on avisos (local_id);

-- ── Reservas ────────────────────────────────────────────────────────────────
create table if not exists reservas (
  id        uuid primary key default gen_random_uuid(),
  local_id  uuid not null references locales on delete cascade,
  token     text not null default encode(gen_random_bytes(9), 'hex'), -- gestión por email
  fecha     date not null,
  hora      time not null,
  personas  int  not null check (personas > 0),
  nombre    text not null,
  email     text,
  telefono  text,
  zona      text,
  notas     text,
  estado    text not null default 'confirmada'
            check (estado in ('confirmada', 'sentada', 'cancelada', 'no_show')),
  mesa_id   uuid references mesas on delete set null,
  creada_en timestamptz not null default now()
);
create index if not exists reservas_local_fecha on reservas (local_id, fecha);

-- ── Historial (tickets) y caja ──────────────────────────────────────────────
create table if not exists tickets (
  id          uuid primary key default gen_random_uuid(),
  local_id    uuid not null references locales on delete cascade,
  numero      bigint not null,               -- correlativo POR LOCAL (fiscal)
  mesa_numero int,
  cerrado_en  timestamptz not null default now(),
  total       numeric(10,2) not null,
  propina     numeric(10,2) not null default 0,
  pagos       jsonb not null default '{}'::jsonb,   -- {efectivo: 3.2, tarjeta: 1}
  detalle     jsonb not null,                       -- snapshot de comensales+líneas
  camarero    text,
  cobrado_por text,
  unique (local_id, numero)
);
create index if not exists tickets_local_fecha on tickets (local_id, cerrado_en);

-- Numeración correlativa por local (requisito fiscal)
create sequence if not exists tickets_numero_seq;
create or replace function asignar_numero_ticket() returns trigger
language plpgsql as $$
begin
  select coalesce(max(numero), 0) + 1 into new.numero
  from tickets where local_id = new.local_id;
  return new;
end $$;
drop trigger if exists trg_ticket_numero on tickets;
create trigger trg_ticket_numero before insert on tickets
  for each row when (new.numero is null) execute function asignar_numero_ticket();

create table if not exists cierres_caja (
  id         uuid primary key default gen_random_uuid(),
  local_id   uuid not null references locales on delete cascade,
  desde      timestamptz,
  hasta      timestamptz not null default now(),
  total      numeric(10,2) not null,
  propinas   numeric(10,2) not null default 0,
  pagos      jsonb not null default '{}'::jsonb,
  n_tickets  int not null default 0,
  contado    numeric(10,2),
  descuadre  numeric(10,2)
);
create index if not exists cierres_local on cierres_caja (local_id);

-- ============================================================================
-- RLS: aislamiento por local
--   El JWT del empleado lleva app_metadata.local_id (se fija al invitarlo).
--   El cliente anónimo (QR/reservas) accede solo vía funciones RPC controladas
--   o con policies específicas de lectura de carta.
-- ============================================================================
create or replace function local_actual() returns uuid
language sql stable as $$
  select nullif(((auth.jwt() -> 'app_metadata') ->> 'local_id'), '')::uuid
$$;

-- Activar RLS en todo
alter table locales        enable row level security;
alter table empleados      enable row level security;
alter table mesas          enable row level security;
alter table categorias     enable row level security;
alter table productos      enable row level security;
alter table comensales     enable row level security;
alter table lineas_pedido  enable row level security;
alter table comandas       enable row level security;
alter table avisos         enable row level security;
alter table reservas       enable row level security;
alter table tickets        enable row level security;
alter table cierres_caja   enable row level security;

-- Personal autenticado: acceso completo a SU local
do $$
declare t text;
begin
  foreach t in array array['empleados','mesas','categorias','productos','comensales',
                           'lineas_pedido','comandas','avisos','reservas','tickets','cierres_caja']
  loop
    execute format('drop policy if exists tenant_all on %I', t);
    execute format(
      'create policy tenant_all on %I for all to authenticated
         using (local_id = local_actual()) with check (local_id = local_actual())', t);
  end loop;
end $$;

-- El local propio: el personal puede leerlo y el admin actualizar su config
drop policy if exists local_read on locales;
create policy local_read on locales for select to authenticated
  using (id = local_actual());
drop policy if exists local_update on locales;
create policy local_update on locales for update to authenticated
  using (id = local_actual()
    and exists (select 1 from empleados e
                where e.local_id = locales.id and e.user_id = auth.uid() and e.rol = 'admin'));

-- Cliente anónimo (QR): puede LEER la carta y la sala del local (para pedir)
drop policy if exists carta_publica on productos;
create policy carta_publica on productos for select to anon using (true);
drop policy if exists categorias_publicas on categorias;
create policy categorias_publicas on categorias for select to anon using (true);
drop policy if exists mesas_publicas on mesas;
create policy mesas_publicas on mesas for select to anon using (true);

-- El resto de operaciones del cliente anónimo (unirse a mesa, pedir, reservar)
-- van por funciones RPC `security definer` que validan la entrada — NO por
-- acceso directo a las tablas. (Se definen en la migración 02, junto a la
-- lógica de servicio: abrir mesa, enviar pedido, marchar, cobrar…)
