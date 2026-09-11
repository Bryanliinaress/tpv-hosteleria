-- ────────────────────────────────────────────────────────────────────────────
-- 45. Facturas: «¿me haces factura?».
--
-- En un bar, cada cobro ya es una FACTURA SIMPLIFICADA (F2, el ticket) y ya se
-- registra en la AEAT. Lo que pide el cliente que viene por trabajo es una
-- factura COMPLETA, con su nombre, su NIF y su domicilio, para deducírsela.
--
-- ⚠️ Esa factura NO es una venta nueva. Es la misma consumición, ya declarada
-- en el ticket. Por eso:
--
--   · se registra como **F3** —«factura emitida en sustitución de facturas
--     simplificadas facturadas y declaradas»— apuntando al ticket que
--     sustituye. Una F1 aparte declararía la venta DOS veces;
--   · el ticket NO se anula ni se rectifica: sigue siendo el F2 que fue;
--   · NO es una fila de `tickets`. Si lo fuera, entraría en el arqueo, en los
--     informes y en «facturado hoy», y el bar vendería dos veces el mismo café.
--     Va en su propia tabla, con su propia serie y su propio contador.
--
-- Una factura por ticket (`unique`). Y un ticket con devoluciones no se
-- factura por aquí: la AEAT dice que, si la simplificada se abonó, la factura
-- que la sustituye va como F1 y no como F3 — es otro documento y otra decisión.
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists facturas (
  id                uuid primary key default gen_random_uuid(),
  local_id          uuid not null references locales on delete cascade,
  serie             text not null,
  numero            bigint,
  -- `restrict`: un ticket con factura no se puede borrar por debajo.
  ticket_id         uuid not null unique references tickets on delete restrict,
  expedida_en       timestamptz not null default now(),
  cliente_nombre    text not null,
  cliente_nif       text not null,
  cliente_direccion text not null,
  cliente_email     text,
  total             numeric(10,2) not null,
  -- Se CONGELA todo al emitir: si mañana cambia el nombre del local o el IVA
  -- de un producto, la factura de hoy tiene que seguir diciendo lo que dijo.
  lineas            jsonb not null,
  desglose          jsonb not null,
  emisor            jsonb not null,
  -- El enlace que se manda por correo. 64 hex aleatorios: no se adivina.
  token             text not null unique
                    default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  creada_por        text,
  fiscal_estado     text not null default 'pendiente'
                    check (fiscal_estado in ('pendiente', 'enviado', 'error', 'no_aplica')),
  fiscal_uuid       text,
  fiscal_qr         text,
  fiscal_url        text,
  fiscal_error      text,
  fiscal_intentos   int not null default 0,
  fiscal_enviado_en timestamptz,
  unique (local_id, serie, numero)
);

create index if not exists facturas_local_fecha on facturas (local_id, expedida_en desc);
create index if not exists facturas_fiscal_pendientes
  on facturas (local_id, fiscal_estado) where fiscal_estado in ('pendiente', 'error');

alter table facturas enable row level security;
-- El personal las LEE. Escribirlas, solo `emitir_factura`: una factura que se
-- puede editar con un `update` no es una factura.
do $$ begin
  create policy tenant_leer on facturas for select to authenticated
    using (local_id = local_actual());
exception when duplicate_object then null; end $$;

-- ── Numeración: correlativa y sin huecos, POR SERIE ─────────────────────────
-- Mismo mecanismo que los tickets (migración 27): contador bloqueado con
-- `update … returning`, en tabla aparte sin políticas, fuera del alcance de
-- quien edita la configuración del local.
create table if not exists contadores_factura (
  local_id uuid not null references locales on delete cascade,
  serie    text not null,
  ultimo   bigint not null default 0,
  primary key (local_id, serie)
);
alter table contadores_factura enable row level security;
revoke all on table contadores_factura from anon, authenticated;

create or replace function asignar_numero_factura() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into contadores_factura (local_id, serie, ultimo)
  values (new.local_id, new.serie, 1)
  on conflict (local_id, serie) do update
    set ultimo = contadores_factura.ultimo + 1
  returning ultimo into new.numero;
  return new;
end $$;
revoke all on function asignar_numero_factura() from public, anon, authenticated;

drop trigger if exists trg_factura_numero on facturas;
create trigger trg_factura_numero before insert on facturas
  for each row when (new.numero is null) execute function asignar_numero_factura();

-- ── Emitir ──────────────────────────────────────────────────────────────────
drop function if exists emitir_factura(uuid, text, text, text, text, text);
create function emitir_factura(
  p_ticket uuid,
  p_nombre text,
  p_nif text,
  p_direccion text,
  p_email text default null,
  p_por text default null
) returns table (id uuid, serie text, numero bigint, token text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_local  uuid := _local_o_error();
  v_t      tickets%rowtype;
  v_cfg    jsonb;
  v_nombre text := nullif(btrim(coalesce(p_nombre, '')), '');
  v_nif    text := upper(regexp_replace(coalesce(p_nif, ''), '[\s.\-]', '', 'g'));
  v_dir    text := nullif(btrim(coalesce(p_direccion, '')), '');
  v_email  text := nullif(btrim(coalesce(p_email, '')), '');
  v_lineas jsonb;
  v_desg   jsonb;
  v_f      facturas%rowtype;
begin
  -- Los datos que la ley pide del destinatario de una factura completa:
  -- nombre o razón social, NIF y domicilio (RD 1619/2012, art. 6).
  if v_nombre is null then raise exception 'nombre_vacio'; end if;
  if v_dir is null then raise exception 'direccion_vacia'; end if;
  -- DNI, NIE o CIF. La letra de control la comprueba también la pantalla;
  -- aquí se exige al menos la forma, que es lo que la AEAT rechaza de plano.
  if v_nif !~ '^([0-9]{8}[A-Z]|[XYZ][0-9]{7}[A-Z]|[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J])$' then
    raise exception 'nif_invalido';
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'email_invalido';
  end if;

  select l.config into v_cfg from locales l where l.id = v_local;
  -- Sin NIF del emisor no hay factura; sin domicilio del emisor, tampoco.
  if coalesce(v_cfg ->> 'cif', '') = '' then raise exception 'local_sin_cif'; end if;
  if coalesce(nullif(v_cfg ->> 'direccionFiscal', ''), v_cfg ->> 'direccion', '') = '' then
    raise exception 'local_sin_direccion';
  end if;

  -- Bloqueado: dos «hazme factura» a la vez del mismo ticket no pueden sacar
  -- dos números. El `unique (ticket_id)` también lo impide, pero así el error
  -- es el que se entiende.
  select * into v_t from tickets t where t.id = p_ticket and t.local_id = v_local for update;
  if not found then raise exception 'ticket_no_existe'; end if;
  if v_t.rectifica_a is not null then raise exception 'es_devolucion'; end if;
  if v_t.total <= 0 then raise exception 'importe_invalido'; end if;
  if exists (select 1 from tickets r where r.rectifica_a = p_ticket) then
    raise exception 'ticket_con_devolucion';
  end if;
  if exists (select 1 from facturas f where f.ticket_id = p_ticket) then
    raise exception 'ya_facturado';
  end if;

  -- Las líneas, agrupadas: en la factura de una comida de empresa «4× Menú
  -- del día» es una línea, no cuatro repartidas por comensal.
  select coalesce(jsonb_agg(jsonb_build_object(
           'nombre', x.nombre, 'cantidad', x.cantidad, 'precio', x.precio,
           'importe', round(x.precio * x.cantidad, 2), 'ivaPct', x.iva_pct)
           order by x.primera), '[]'::jsonb)
    into v_lineas
    from (
      select i ->> 'nombre' as nombre,
             (i ->> 'precio')::numeric as precio,
             coalesce((i ->> 'ivaPct')::numeric, (v_cfg ->> 'ivaPct')::numeric, 10) as iva_pct,
             sum((i ->> 'cantidad')::numeric) as cantidad,
             min(c.ord * 1000 + i_ord) as primera
        from jsonb_array_elements(v_t.detalle) with ordinality c(com, ord)
        cross join lateral jsonb_array_elements(c.com -> 'items') with ordinality i_(i, i_ord)
       group by 1, 2, 3
    ) x
   where x.cantidad <> 0;

  -- El desglose por tipo, con la MISMA función que el ticket: la factura y el
  -- F2 al que sustituye no pueden decir bases distintas.
  select coalesce(jsonb_agg(jsonb_build_object(
           'ivaPct', d.iva_pct, 'base', d.base, 'cuota', d.cuota, 'total', d.total)
           order by d.iva_pct), '[]'::jsonb)
    into v_desg
    from desglose_iva_ticket(p_ticket) d;

  insert into facturas (
    local_id, serie, ticket_id, cliente_nombre, cliente_nif, cliente_direccion, cliente_email,
    total, lineas, desglose, emisor, creada_por
  ) values (
    v_local,
    coalesce(nullif(btrim(v_cfg ->> 'serieFacturas'), ''), 'F'),
    p_ticket, left(v_nombre, 120), v_nif, left(v_dir, 200), left(v_email, 120),
    v_t.total, v_lineas, v_desg,
    jsonb_build_object(
      'nombre', (select l.nombre from locales l where l.id = v_local),
      'razonSocial', coalesce(nullif(v_cfg ->> 'razonSocial', ''), (select l.nombre from locales l where l.id = v_local)),
      'cif', v_cfg ->> 'cif',
      'direccion', coalesce(nullif(v_cfg ->> 'direccionFiscal', ''), v_cfg ->> 'direccion'),
      'serieTickets', coalesce(nullif(v_cfg ->> 'serieFiscal', ''), 'TPV'),
      'ticketNumero', v_t.numero,
      'ticketFecha', v_t.cerrado_en),
    p_por
  ) returning * into v_f;

  return query select v_f.id, v_f.serie, v_f.numero, v_f.token;
end $$;

revoke all on function emitir_factura(uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function emitir_factura(uuid, text, text, text, text, text) to authenticated;

-- ── Lo que se manda a Hacienda ──────────────────────────────────────────────
create or replace function factura_para_fiscal(p_factura uuid)
returns jsonb
language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'id', f.id, 'serie', f.serie, 'numero', f.numero, 'fecha', f.expedida_en,
    'total', f.total, 'desglose', f.desglose, 'estado', f.fiscal_estado,
    'cliente', jsonb_build_object('nombre', f.cliente_nombre, 'nif', f.cliente_nif),
    'emisor', jsonb_build_object('nif', f.emisor ->> 'cif'),
    -- El F2 que se sustituye: su serie, número y fecha, y si ya consta en la
    -- AEAT. Una F3 que apunta a un ticket que Hacienda aún no tiene se
    -- rechazaría: la Edge Function espera a que el ticket esté registrado.
    'sustituye', jsonb_build_object(
      'serie', f.emisor ->> 'serieTickets',
      'numero', t.numero, 'fecha', t.cerrado_en, 'estado', t.fiscal_estado))
  from facturas f join tickets t on t.id = f.ticket_id
  where f.id = p_factura
$$;

create or replace function factura_fiscal_resultado(
  p_factura uuid, p_estado text, p_uuid text default null,
  p_qr text default null, p_url text default null, p_error text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  update facturas set
    fiscal_estado = p_estado,
    fiscal_uuid = coalesce(p_uuid, fiscal_uuid),
    fiscal_qr = coalesce(p_qr, fiscal_qr),
    fiscal_url = coalesce(p_url, fiscal_url),
    fiscal_error = p_error,
    fiscal_intentos = fiscal_intentos + 1,
    fiscal_enviado_en = case when p_estado = 'enviado' then now() else fiscal_enviado_en end
  where id = p_factura;
end $$;

revoke all on function factura_para_fiscal(uuid) from public, anon, authenticated;
revoke all on function factura_fiscal_resultado(uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function factura_para_fiscal(uuid) to service_role;
grant execute on function factura_fiscal_resultado(uuid, text, text, text, text, text) to service_role;

-- ── Ver la factura desde el enlace del correo ───────────────────────────────
-- El cliente no tiene sesión: la abre desde su correo, en su móvil o en la
-- gestoría. Devuelve SOLO esa factura, y solo con el token exacto — el mismo
-- esquema que la gestión de una reserva (`reserva_por_token`).
create or replace function factura_por_token(p_token text)
returns jsonb
language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'serie', f.serie, 'numero', f.numero, 'expedidaEn', f.expedida_en,
    'cliente', jsonb_build_object('nombre', f.cliente_nombre, 'nif', f.cliente_nif,
                                  'direccion', f.cliente_direccion),
    'emisor', f.emisor, 'lineas', f.lineas, 'desglose', f.desglose, 'total', f.total,
    'fiscalEstado', f.fiscal_estado, 'fiscalUrl', f.fiscal_url)
  from facturas f
  where length(coalesce(p_token, '')) >= 32 and f.token = p_token
$$;

revoke all on function factura_por_token(text) from public, anon, authenticated;
grant execute on function factura_por_token(text) to anon, authenticated;
