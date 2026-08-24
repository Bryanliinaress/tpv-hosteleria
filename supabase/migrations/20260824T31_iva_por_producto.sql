-- ────────────────────────────────────────────────────────────────────────────
-- IVA por producto.
--
-- Hasta ahora había UN tipo por local (`config.ivaPct`, 10 por defecto). En un
-- bar de hostelería pura vale: el servicio va al 10 %. Pero en cuanto uno vende
-- algo fuera de eso —una botella para llevar al 21 %, pan o leche al 4 %— el
-- ticket y lo que consta en Hacienda están mal, y eso ya no es un detalle
-- estético: es la factura simplificada que se entrega al cliente y el registro
-- que se manda a la AEAT.
--
-- Tres piezas:
--
--  1. `productos.iva_pct` — NULL significa «el del local». Así nada cambia para
--     quien ya está funcionando: hoy todos son NULL y todo sigue al 10 %.
--
--  2. `lineas_pedido.iva_pct` — el tipo se CONGELA en la línea al pedir, igual
--     que ya se congelan el nombre y el precio. Si no, cambiar el IVA de un
--     producto en junio reescribiría los tickets de mayo, que son documentos
--     fiscales ya emitidos.
--
--  3. El desglose por tipo, para el ticket y para la AEAT: una factura con dos
--     tipos lleva DOS líneas de desglose, no una con la media.
-- ────────────────────────────────────────────────────────────────────────────

alter table productos     add column if not exists iva_pct numeric(5,2);
alter table lineas_pedido add column if not exists iva_pct numeric(5,2);

-- Un tipo de IVA no puede ser cualquier número.
do $$ begin
  alter table productos add constraint productos_iva_valido
    check (iva_pct is null or (iva_pct >= 0 and iva_pct <= 100));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table lineas_pedido add constraint lineas_iva_valido
    check (iva_pct is null or (iva_pct >= 0 and iva_pct <= 100));
exception when duplicate_object then null; end $$;

-- ── El tipo que le toca a un producto ───────────────────────────────────────
create or replace function _iva_de(p_producto uuid, p_local uuid) returns numeric
language sql stable set search_path = public as $$
  select coalesce(
    (select p.iva_pct from productos p where p.id = p_producto),
    (select (l.config ->> 'ivaPct')::numeric from locales l where l.id = p_local),
    10)
$$;
revoke all on function _iva_de(uuid, uuid) from public, anon, authenticated;

-- ── Congelar el tipo al crear la línea ──────────────────────────────────────
-- Se hace con un trigger y no tocando cada RPC que inserta líneas: hay varias
-- (el cliente del QR, la PDA, el mostrador) y una regla escrita cuatro veces es
-- una regla que va a fallar en la que se olvide.
create or replace function _congelar_iva_linea() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.iva_pct is null then
    new.iva_pct := _iva_de(new.producto_id, new.local_id);
  end if;
  return new;
end $$;

-- Supabase concede EXECUTE a anon y authenticated en cuanto se crea una
-- función; esta la llama el trigger, nadie más.
revoke all on function _congelar_iva_linea() from public, anon, authenticated;

drop trigger if exists trg_linea_iva on lineas_pedido;
create trigger trg_linea_iva before insert on lineas_pedido
  for each row execute function _congelar_iva_linea();

-- Las líneas que ya existen se quedan con el tipo del local, que es el que se
-- les aplicó de hecho.
update lineas_pedido l
   set iva_pct = coalesce((select (c.config ->> 'ivaPct')::numeric from locales c where c.id = l.local_id), 10)
 where l.iva_pct is null;

-- ── El detalle del ticket lleva el tipo de cada línea ───────────────────────
-- Sin esto, el desglose habría que adivinarlo, y un ticket ya emitido no se
-- adivina.
create or replace function _detalle_grupo(p_grupo uuid[]) returns jsonb
language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'nombre', c.nombre, 'pagado', c.pagado,
    'propina', c.propina, 'metodoPago', c.metodo_pago, 'cobradoPor', c.cobrado_por,
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'nombre', l.nombre, 'precio', l.precio, 'cantidad', l.cantidad,
        'tipo', l.tipo, 'personalizacion', l.personalizacion,
        'ivaPct', l.iva_pct
      ) order by l.creado_en), '[]'::jsonb)
      from lineas_pedido l where l.comensal_id = c.id
    )
  ) order by c.creado_en), '[]'::jsonb)
  from comensales c where c.mesa_id = any(p_grupo)
$$;

-- ── Desglose por tipo, para el ticket y para la AEAT ────────────────────────
--
-- Los precios llevan el IVA incluido, así que por cada tipo hay que sacar base
-- y cuota. La cuota se calcula RESTANDO de la base ya redondeada: redondeando
-- las dos por separado, «base + cuota» puede quedarse un céntimo por encima del
-- total y la factura no cuadra. Es la misma regla que en `src/lib/dinero.js`.
create or replace function desglose_iva_ticket(p_ticket uuid)
returns table (iva_pct numeric, base numeric, cuota numeric, total numeric)
language sql security definer set search_path = public stable as $$
  with lineas as (
    select coalesce((i ->> 'ivaPct')::numeric,
                    (select (l.config ->> 'ivaPct')::numeric from locales l where l.id = t.local_id),
                    10) as pct,
           (i ->> 'precio')::numeric * (i ->> 'cantidad')::numeric as importe
      from tickets t
      cross join lateral jsonb_array_elements(t.detalle) c
      cross join lateral jsonb_array_elements(c -> 'items') i
     where t.id = p_ticket
  ), por_tipo as (
    select pct, round(sum(importe), 2) as total from lineas group by pct
  )
  select pct,
         round(total / (1 + pct / 100), 2) as base,
         total - round(total / (1 + pct / 100), 2) as cuota,
         total
    from por_tipo
   order by pct
$$;
revoke all on function desglose_iva_ticket(uuid) from public, anon, authenticated;

-- ── Lo que se manda a Hacienda ──────────────────────────────────────────────
-- Se añade `desglose`: la Edge Function lo usa tal cual si viene, y sigue
-- funcionando con `ivaPct` para los tickets viejos que no lo traen.
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
    'desglose', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'ivaPct', d.iva_pct, 'base', d.base, 'cuota', d.cuota)), '[]'::jsonb)
      from desglose_iva_ticket(t.id) d
    ),
    'emisor', jsonb_build_object(
      'nif', l.config ->> 'cif',
      'nombre', coalesce(l.config ->> 'razonSocial', l.nombre),
      'serie', coalesce(l.config ->> 'serieFiscal', 'TPV'),
      'ivaPct', coalesce((l.config ->> 'ivaPct')::numeric, 10)))
  from tickets t join locales l on l.id = t.local_id
  where t.id = p_ticket
$$;
revoke all on function ticket_para_fiscal(uuid) from public, anon, authenticated;
