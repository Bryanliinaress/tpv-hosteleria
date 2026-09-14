-- ────────────────────────────────────────────────────────────────────────────
-- 50. Lo que se empieza y no se termina, no desaparece.
--
-- «Cerrar mesa sin cobrar» borraba los comensales, lo pedido y las comandas:
-- de una cuenta de 40 € que no se cobró no quedaba NADA. Es exactamente lo que
-- la Ley 11/2021 (antifraude) prohíbe que permita un programa de facturación:
-- poder hacer desaparecer ventas. Y en el día a día, es la pregunta sin
-- respuesta de «¿qué pasó con la mesa 7 del sábado?».
--
-- Ahora esa cuenta se CONGELA antes de liberar la mesa, con lo que se pidió,
-- el importe, el motivo (obligatorio) y quién la cerró, en `cuentas_anuladas`.
-- No es un ticket —no se cobró, no lleva número fiscal ni suma en caja—: es un
-- borrador anulado. El personal lo lee y NO lo puede cambiar ni borrar.
--
-- Y las facturas que se empiezan y se cancelan antes de emitir dejan sus datos
-- en `borradores_factura`, para retomarlas. Eso sí se puede descartar: aún no
-- es ningún documento.
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists cuentas_anuladas (
  id            uuid primary key default gen_random_uuid(),
  local_id      uuid not null references locales on delete cascade,
  mesa_numero   int,
  zona          text,
  abierta_desde timestamptz,
  cerrada_en    timestamptz not null default now(),
  total         numeric(10,2) not null,
  sin_cobrar    numeric(10,2) not null,
  detalle       jsonb not null,
  motivo        text not null,
  por           text,
  camarero      text
);

create index if not exists cuentas_anuladas_local_fecha on cuentas_anuladas (local_id, cerrada_en desc);

alter table cuentas_anuladas enable row level security;
-- Solo lectura. Sin políticas de update ni delete: desde la app (o desde la
-- API con la sesión de un aparato) no se puede tocar lo que se anuló.
do $$ begin
  create policy tenant_leer on cuentas_anuladas for select to authenticated
    using (local_id = local_actual());
exception when duplicate_object then null; end $$;

create or replace function cerrar_mesa_sin_cobrar(p_mesa uuid, p_motivo text default null, p_por text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_local   uuid := _local_o_error();
  v_mesa    mesas%rowtype;
  v_cabeza  mesas%rowtype;
  v_grupo   uuid[];
  v_total   numeric;
  v_pend    numeric;
  v_motivo  text := nullif(btrim(regexp_replace(coalesce(p_motivo, ''), '\s+', ' ', 'g')), '');
  v_id      uuid := null;
begin
  select * into v_mesa from mesas m where m.id = p_mesa and m.local_id = v_local for update;
  if not found then raise exception 'mesa_no_existe'; end if;

  v_grupo := _grupo_de(p_mesa);
  perform 1 from mesas m where m.id = any(v_grupo) for update;
  select * into v_cabeza from mesas m where m.id = coalesce(v_mesa.unida_a, v_mesa.id);

  select coalesce(sum(l.precio * l.cantidad), 0),
         coalesce(sum(l.precio * l.cantidad) filter (where not c.pagado), 0)
    into v_total, v_pend
    from lineas_pedido l join comensales c on c.id = l.comensal_id
   where c.mesa_id = any(v_grupo);

  -- Con algo pedido, la cuenta se guarda y hay que decir por qué no se cobra.
  -- Una mesa abierta por error y sin nada pedido se libera sin más.
  if exists (select 1 from lineas_pedido l join comensales c on c.id = l.comensal_id where c.mesa_id = any(v_grupo)) then
    if v_motivo is null then raise exception 'motivo_cierre_obligatorio'; end if;
    insert into cuentas_anuladas (local_id, mesa_numero, zona, abierta_desde, total, sin_cobrar, detalle, motivo, por, camarero)
    values (v_local, v_cabeza.numero, v_cabeza.zona, v_cabeza.abierta_desde, round(v_total, 2), round(v_pend, 2),
            _detalle_grupo(v_grupo), left(v_motivo, 300), p_por,
            (select e.nombre from empleados e where e.id = v_cabeza.camarero_id))
    returning id into v_id;
  end if;

  delete from comandas where mesa_id = any(v_grupo);
  delete from avisos where mesa_id = any(v_grupo);
  delete from comensales where mesa_id = any(v_grupo);   -- las líneas van en cascada
  update mesas set estado = 'libre', abierta_desde = null, camarero_id = null, unida_a = null
   where id = any(v_grupo);

  return v_id;
end $$;

revoke all on function cerrar_mesa_sin_cobrar(uuid, text, text) from public, anon, authenticated;
grant execute on function cerrar_mesa_sin_cobrar(uuid, text, text) to authenticated;

-- ── Facturas sin terminar ───────────────────────────────────────────────────
create table if not exists borradores_factura (
  id             uuid primary key default gen_random_uuid(),
  local_id       uuid not null default local_actual() references locales on delete cascade,
  ticket_id      uuid not null unique references tickets on delete cascade,
  datos          jsonb not null,
  por            text,
  actualizado_en timestamptz not null default now()
);

alter table borradores_factura enable row level security;
do $$ begin
  create policy tenant_all on borradores_factura for all to authenticated
    using (local_id = local_actual()) with check (local_id = local_actual());
exception when duplicate_object then null; end $$;
