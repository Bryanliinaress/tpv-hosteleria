-- ────────────────────────────────────────────────────────────────────────────
-- 47. Clientes de factura guardados.
--
-- El que pide factura suele VOLVER: el comercial que come aquí cada martes, el
-- taller de enfrente, la empresa que hace la comida de Navidad. Teclear otra
-- vez razón social, NIF y domicilio cada vez es lento con el cliente delante
-- y es donde se cuela la errata del NIF que luego rechaza Hacienda.
--
-- Se guardan al emitir, en la MISMA transacción que la factura (así no queda
-- un cliente guardado de una factura que falló, ni al revés), y solo si quien
-- factura lo marca.
--
-- ⚠️ Datos personales (RGPD): un DNI y un domicilio son datos de una persona.
-- Se guardan solo para facturarle y se pueden borrar en cualquier momento
-- desde Admin. Borrar al cliente NO toca sus facturas: la factura emitida es
-- un documento fiscal que hay que conservar (4 años) y lleva sus datos
-- congelados dentro.
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists clientes_factura (
  id         uuid primary key default gen_random_uuid(),
  local_id   uuid not null default local_actual() references locales on delete cascade,
  nombre     text not null check (length(btrim(nombre)) between 1 and 120),
  nif        text not null check (nif ~ '^([0-9]{8}[A-Z]|[XYZ][0-9]{7}[A-Z]|[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J])$'),
  direccion  text not null check (length(btrim(direccion)) between 1 and 200),
  email      text,
  facturas   int not null default 0,
  usado_en   timestamptz not null default now(),
  creado_en  timestamptz not null default now(),
  -- Un NIF, un cliente: si vuelve con otro domicilio, se actualiza el suyo.
  unique (local_id, nif)
);

create index if not exists clientes_factura_recientes on clientes_factura (local_id, usado_en desc);

alter table clientes_factura enable row level security;
-- El personal los lee, los corrige y los borra. Es una agenda, no un
-- documento fiscal: aquí no hay nada que blindar contra un `update`.
do $$ begin
  create policy tenant_all on clientes_factura for all to authenticated
    using (local_id = local_actual()) with check (local_id = local_actual());
exception when duplicate_object then null; end $$;

-- ── Emitir, ahora pudiendo guardar al cliente ───────────────────────────────
-- `create or replace` no puede añadir un parámetro: hay que tirar la de 6.
drop function if exists emitir_factura(uuid, text, text, text, text, text);
drop function if exists emitir_factura(uuid, text, text, text, text, text, boolean);
create function emitir_factura(
  p_ticket uuid,
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
  v_t      tickets%rowtype;
  v_cfg    jsonb;
  v_nombre text := nullif(btrim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g')), '');
  v_nif    text := upper(regexp_replace(coalesce(p_nif, ''), '[\s.\-]', '', 'g'));
  v_dir    text := nullif(btrim(regexp_replace(coalesce(p_direccion, ''), '\s+', ' ', 'g')), '');
  v_email  text := nullif(btrim(coalesce(p_email, '')), '');
  v_lineas jsonb;
  v_desg   jsonb;
  v_f      facturas%rowtype;
begin
  if v_nombre is null then raise exception 'nombre_vacio'; end if;
  if v_dir is null then raise exception 'direccion_vacia'; end if;
  if v_nif !~ '^([0-9]{8}[A-Z]|[XYZ][0-9]{7}[A-Z]|[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J])$' then
    raise exception 'nif_invalido';
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'email_invalido';
  end if;

  select l.config into v_cfg from locales l where l.id = v_local;
  if coalesce(v_cfg ->> 'cif', '') = '' then raise exception 'local_sin_cif'; end if;
  if coalesce(nullif(v_cfg ->> 'direccionFiscal', ''), v_cfg ->> 'direccion', '') = '' then
    raise exception 'local_sin_direccion';
  end if;

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

  -- Guardar al cliente para la próxima. Si ya estaba (mismo NIF), se ponen al
  -- día sus datos: si trae otro domicilio, el bueno es el de hoy. El correo
  -- vacío no borra el que ya había.
  if coalesce(p_guardar, false) then
    insert into clientes_factura (local_id, nombre, nif, direccion, email, facturas, usado_en)
    values (v_local, left(v_nombre, 120), v_nif, left(v_dir, 200), left(v_email, 120), 1, now())
    on conflict (local_id, nif) do update set
      nombre = excluded.nombre,
      direccion = excluded.direccion,
      email = coalesce(excluded.email, clientes_factura.email),
      facturas = clientes_factura.facturas + 1,
      usado_en = now();
  end if;

  return query select v_f.id, v_f.serie, v_f.numero, v_f.token;
end $$;

revoke all on function emitir_factura(uuid, text, text, text, text, text, boolean) from public, anon, authenticated;
grant execute on function emitir_factura(uuid, text, text, text, text, text, boolean) to authenticated;
