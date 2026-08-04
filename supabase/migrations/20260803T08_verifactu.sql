-- ============================================================================
-- TPV Hostelería · Migración 08: registro fiscal Verifactu (RD 1007/2023)
--
-- Cada ticket cobrado debe registrarse en la AEAT. Lo hace una Edge Function
-- contra Verifacti (proveedor homologado) y guarda aquí el resultado: el QR
-- verificable que hay que imprimir y el estado del envío, con reintentos.
--
-- El envío NO puede bloquear el cobro (si la AEAT o internet fallan, el bar
-- tiene que poder seguir cobrando): el ticket nace 'pendiente' y un proceso
-- lo reintenta. Esto es lo que permite Verifactu (remisión diferida).
-- ============================================================================

alter table tickets
  add column if not exists fiscal_estado text not null default 'pendiente'
    check (fiscal_estado in ('pendiente', 'enviado', 'error', 'no_aplica')),
  add column if not exists fiscal_uuid text,          -- id del registro en Verifacti
  add column if not exists fiscal_qr text,            -- QR verificable (base64 o URL)
  add column if not exists fiscal_url text,           -- URL de cotejo de la AEAT
  add column if not exists fiscal_error text,
  add column if not exists fiscal_intentos int not null default 0,
  add column if not exists fiscal_enviado_en timestamptz;

create index if not exists tickets_fiscal_pendientes
  on tickets (local_id, fiscal_estado) where fiscal_estado in ('pendiente', 'error');

-- Datos fiscales del local (NIF y serie) para componer el registro
-- viven en locales.config: { cif, razonSocial, direccionFiscal, serieFiscal }

-- Ticket + datos del emisor listos para enviar a la AEAT.
create or replace function ticket_para_fiscal(p_ticket uuid)
returns jsonb
language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'id', t.id,
    'numero', t.numero,
    'fecha', t.cerrado_en,
    'total', t.total,
    'detalle', t.detalle,
    'estado', t.fiscal_estado,
    'emisor', jsonb_build_object(
      'nif', l.config ->> 'cif',
      'nombre', coalesce(l.config ->> 'razonSocial', l.nombre),
      'serie', coalesce(l.config ->> 'serieFiscal', 'TPV'),
      'ivaPct', coalesce((l.config ->> 'ivaPct')::numeric, 10)))
  from tickets t join locales l on l.id = t.local_id
  where t.id = p_ticket
$$;

-- Guarda el resultado del envío (la llama la Edge Function con service_role).
create or replace function fiscal_resultado(
  p_ticket uuid, p_estado text, p_uuid text default null,
  p_qr text default null, p_url text default null, p_error text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  update tickets set
    fiscal_estado = p_estado,
    fiscal_uuid = coalesce(p_uuid, fiscal_uuid),
    fiscal_qr = coalesce(p_qr, fiscal_qr),
    fiscal_url = coalesce(p_url, fiscal_url),
    fiscal_error = p_error,
    fiscal_intentos = fiscal_intentos + 1,
    fiscal_enviado_en = case when p_estado = 'enviado' then now() else fiscal_enviado_en end
  where id = p_ticket;
end $$;

-- Tickets que quedaron sin registrar (para reintentar y para avisar al dueño).
create or replace function tickets_fiscal_pendientes()
returns table (id uuid, numero bigint, total numeric, cerrado_en timestamptz,
               fiscal_estado text, fiscal_error text, fiscal_intentos int)
language sql security definer set search_path = public stable as $$
  select t.id, t.numero, t.total, t.cerrado_en, t.fiscal_estado, t.fiscal_error, t.fiscal_intentos
  from tickets t
  where t.local_id = local_actual() and t.fiscal_estado in ('pendiente', 'error')
  order by t.cerrado_en
$$;

grant execute on function tickets_fiscal_pendientes() to authenticated;
-- ticket_para_fiscal y fiscal_resultado solo las usa la Edge Function
-- (service_role); no se conceden a authenticated ni anon.
