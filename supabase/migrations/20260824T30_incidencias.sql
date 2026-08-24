-- ────────────────────────────────────────────────────────────────────────────
-- Que un bar roto no dependa de que alguien llame por teléfono.
--
-- Hoy no hay nada: si la tablet de la barra se queda atascada un sábado, se
-- enteran ellos y, con suerte, avisan el lunes. Con un bar se sobrevive; con
-- diez, no te enteras nunca de la mitad de las cosas.
--
-- Esto es deliberadamente pequeño y sin depender de nadie de fuera: una tabla
-- donde la app deja lo que se ha roto, y un comando (`npm run salud`) que la
-- lee. Nada de un servicio de terceros al que mandar datos de un bar.
--
-- QUÉ NO SE GUARDA: nada que escriba un cliente ni un camarero. Solo el
-- mensaje del error, la pantalla y la versión. El mensaje se recorta, porque un
-- error puede arrastrar dentro lo que se estaba manejando.
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists incidencias (
  id        uuid primary key default gen_random_uuid(),
  local_id  uuid references locales on delete cascade,
  clase     text not null,                  -- 'render' | 'js' | 'promesa' | 'cola'
  mensaje   text not null,
  pantalla  text,
  version   text,
  veces     int not null default 1,
  primera   timestamptz not null default now(),
  ultima    timestamptz not null default now()
);
create index if not exists incidencias_local on incidencias (local_id, ultima desc);

-- Un mismo fallo repitiéndose no puede llenar la tabla: se agrupa por lo que lo
-- identifica y se cuenta cuántas veces ha pasado, que además es el dato útil
-- («esto le pasa a un bar 400 veces al día» dice mucho más que 400 filas).
create unique index if not exists incidencias_unica
  on incidencias (local_id, clase, mensaje, coalesce(pantalla, ''));

alter table incidencias enable row level security;

-- La escribe la función de abajo (que corre como dueño), no el cliente.
revoke all on table incidencias from anon, authenticated;

-- Leerla sí puede el personal del local, para que el encargado pueda enseñar
-- lo que le sale sin tener que hacer una foto a la pantalla.
grant select on table incidencias to authenticated;
drop policy if exists tenant_select on incidencias;
create policy tenant_select on incidencias for select to authenticated
  using (local_id = local_actual());

-- ────────────────────────────────────────────────────────────────────────────
-- Registrar una incidencia. Abierta a `anon` a propósito: el cliente del QR
-- también puede encontrarse una pantalla rota, y es cuando más falta hace
-- enterarse —ese es el que se va sin pedir y no vuelve.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function registrar_incidencia(
  p_clase text, p_mensaje text, p_pantalla text default null, p_version text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_local uuid;
  v_hoy int;
begin
  if coalesce(btrim(p_mensaje), '') = '' then return; end if;
  if p_clase not in ('render', 'js', 'promesa', 'cola') then return; end if;

  -- Con sesión, el local sale del JWT; sin ella (cliente del QR) se usa el
  -- único del proyecto, que es el modelo de este producto: un bar, una
  -- instalación.
  v_local := local_actual();
  if v_local is null then select id into v_local from locales order by creado_en limit 1; end if;
  if v_local is null then return; end if;

  -- Tope diario por local: si algo se rompe en bucle, que no se coma la base.
  -- Se cuenta sobre incidencias DISTINTAS, no sobre repeticiones (esas se
  -- agrupan solas), así que 200 al día ya es una mañana muy mala.
  select count(*) into v_hoy from incidencias
   where local_id = v_local and ultima > now() - interval '1 day';
  if v_hoy >= 200 then return; end if;

  insert into incidencias (local_id, clase, mensaje, pantalla, version)
  values (v_local, p_clase, left(btrim(p_mensaje), 300), left(p_pantalla, 80), left(p_version, 20))
  on conflict (local_id, clase, mensaje, coalesce(pantalla, ''))
  do update set veces = incidencias.veces + 1, ultima = now();
end $$;

revoke all on function registrar_incidencia(text, text, text, text) from public;
grant execute on function registrar_incidencia(text, text, text, text) to anon, authenticated;
