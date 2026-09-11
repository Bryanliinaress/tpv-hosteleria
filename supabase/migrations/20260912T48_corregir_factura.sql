-- ────────────────────────────────────────────────────────────────────────────
-- 48. Corregir y reenviar una factura que Hacienda RECHAZÓ.
--
-- Pasó con la F-1 de prueba: nombre «t» con un NIF real. Hacienda comprueba
-- que el nombre del destinatario casa con su NIF, y si no, la rechaza. Y la
-- factura se quedaba atascada: no se puede editar (a propósito), los
-- reintentos repetían el mismo error y el ticket ya no admitía otra factura.
--
-- Una factura rechazada NUNCA llegó a constar en Hacienda, así que no se
-- rectifica (eso es para las aceptadas): se corrige y se reenvía con el MISMO
-- número y la misma fecha de expedición —la AEAT la identifica por serie,
-- número y fecha—. Por eso:
--
--   · solo se puede con `fiscal_estado = 'error'`. Una aceptada ya es un
--     documento fiscal; una pendiente aún no ha tenido respuesta;
--   · queda registro de qué ponía antes, qué pone ahora, por qué se rechazó y
--     quién lo cambió (`correcciones_factura`): una factura que cambia de
--     titular es justo lo que hay que poder explicar en una inspección;
--   · se marca `subsanar`: la Edge Function la reenvía como subsanación de un
--     registro rechazado, no como una factura nueva.
-- ────────────────────────────────────────────────────────────────────────────

alter table facturas add column if not exists subsanar boolean not null default false;

create table if not exists correcciones_factura (
  id           uuid primary key default gen_random_uuid(),
  local_id     uuid not null references locales on delete cascade,
  factura_id   uuid not null references facturas on delete restrict,
  antes        jsonb not null,
  despues      jsonb not null,
  error_previo text,
  por          text,
  creado_en    timestamptz not null default now()
);

alter table correcciones_factura enable row level security;
do $$ begin
  create policy tenant_leer on correcciones_factura for select to authenticated
    using (local_id = local_actual());
exception when duplicate_object then null; end $$;

drop function if exists corregir_factura(uuid, text, text, text, text, text, boolean);
create function corregir_factura(
  p_factura uuid,
  p_nombre text,
  p_nif text,
  p_direccion text,
  p_email text default null,
  p_por text default null,
  p_guardar boolean default false
) returns table (id uuid, serie text, numero bigint, token text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_local  uuid := _local_o_error();
  v_f      facturas%rowtype;
  v_nombre text := nullif(btrim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g')), '');
  v_nif    text := upper(regexp_replace(coalesce(p_nif, ''), '[\s.\-]', '', 'g'));
  v_dir    text := nullif(btrim(regexp_replace(coalesce(p_direccion, ''), '\s+', ' ', 'g')), '');
  v_email  text := nullif(btrim(coalesce(p_email, '')), '');
begin
  if v_nombre is null then raise exception 'nombre_vacio'; end if;
  if v_dir is null then raise exception 'direccion_vacia'; end if;
  if v_nif !~ '^([0-9]{8}[A-Z]|[XYZ][0-9]{7}[A-Z]|[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J])$' then
    raise exception 'nif_invalido';
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'email_invalido';
  end if;

  -- Bloqueada: la Edge Function podría estar escribiendo su resultado ahora.
  select * into v_f from facturas f where f.id = p_factura and f.local_id = v_local for update;
  if not found then raise exception 'factura_no_existe'; end if;
  if v_f.fiscal_estado <> 'error' then raise exception 'factura_no_corregible'; end if;

  if v_f.cliente_nombre = left(v_nombre, 120) and v_f.cliente_nif = v_nif
     and v_f.cliente_direccion = left(v_dir, 200)
     and coalesce(v_f.cliente_email, '') = coalesce(left(v_email, 120), '') then
    raise exception 'sin_cambios';
  end if;

  insert into correcciones_factura (local_id, factura_id, antes, despues, error_previo, por)
  values (v_local, v_f.id,
          jsonb_build_object('nombre', v_f.cliente_nombre, 'nif', v_f.cliente_nif,
                             'direccion', v_f.cliente_direccion, 'email', v_f.cliente_email),
          jsonb_build_object('nombre', left(v_nombre, 120), 'nif', v_nif,
                             'direccion', left(v_dir, 200), 'email', left(v_email, 120)),
          v_f.fiscal_error, p_por);

  -- Mismo número y misma fecha. Los intentos vuelven a cero: son intentos de
  -- ESTOS datos, y con los viejos se habría agotado el cupo de reintentos.
  update facturas set
    cliente_nombre = left(v_nombre, 120),
    cliente_nif = v_nif,
    cliente_direccion = left(v_dir, 200),
    cliente_email = left(v_email, 120),
    fiscal_estado = 'pendiente',
    fiscal_error = null,
    fiscal_intentos = 0,
    subsanar = true
  where facturas.id = v_f.id;

  if coalesce(p_guardar, false) then
    insert into clientes_factura (local_id, nombre, nif, direccion, email, facturas, usado_en)
    values (v_local, left(v_nombre, 120), v_nif, left(v_dir, 200), left(v_email, 120), 1, now())
    on conflict (local_id, nif) do update set
      nombre = excluded.nombre,
      direccion = excluded.direccion,
      email = coalesce(excluded.email, clientes_factura.email),
      usado_en = now();
  end if;

  return query select v_f.id, v_f.serie, v_f.numero, v_f.token;
end $$;

revoke all on function corregir_factura(uuid, text, text, text, text, text, boolean) from public, anon, authenticated;
grant execute on function corregir_factura(uuid, text, text, text, text, text, boolean) to authenticated;

-- ── Lo que se manda a Hacienda: ahora dice si es una subsanación ────────────
create or replace function factura_para_fiscal(p_factura uuid)
returns jsonb
language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'id', f.id, 'serie', f.serie, 'numero', f.numero, 'fecha', f.expedida_en,
    'total', f.total, 'desglose', f.desglose, 'estado', f.fiscal_estado,
    'subsanar', f.subsanar,
    'cliente', jsonb_build_object('nombre', f.cliente_nombre, 'nif', f.cliente_nif),
    'emisor', jsonb_build_object('nif', f.emisor ->> 'cif'),
    'sustituye', jsonb_build_object(
      'serie', f.emisor ->> 'serieTickets',
      'numero', t.numero, 'fecha', t.cerrado_en, 'estado', t.fiscal_estado))
  from facturas f join tickets t on t.id = f.ticket_id
  where f.id = p_factura
$$;

revoke all on function factura_para_fiscal(uuid) from public, anon, authenticated;
grant execute on function factura_para_fiscal(uuid) to service_role;
