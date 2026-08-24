-- ────────────────────────────────────────────────────────────────────────────
-- La numeración de tickets tenía una carrera.
--
-- El trigger hacía `select max(numero) + 1 from tickets where local_id = …`
-- SIN bloquear nada. Dos cobros a la vez en el mismo local leen el mismo
-- máximo, los dos intentan insertar ese número y `unique (local_id, numero)`
-- tumba a uno: **un cobro que falla**. En un bar, dos mesas cerrando a la vez
-- a las 14:30 es lo normal; y si el que pierde es el webhook de Stripe,
-- devuelve 500, Stripe reintenta y la mesa se queda abierta mientras tanto.
--
-- El número de una factura simplificada tiene que ser correlativo y sin
-- huecos, así que no vale una `sequence` global. Lo que sí vale: un contador
-- POR LOCAL, tomado con `update … returning`, que bloquea esa fila. El segundo
-- cobro espera al primero unos milisegundos y se lleva el siguiente número; los
-- cobros de OTROS locales no se enteran. Y si una transacción se deshace, el
-- contador se deshace con ella: tampoco quedan huecos.
--
-- El contador va en su propia tabla y no en `locales.config` a propósito: la
-- config la escribe el personal desde Admin → Local, y un contador de
-- numeración fiscal al alcance de un `update` es un contador que se puede
-- rebobinar. Aquí se hace como con `intentos_pin`: RLS activo y CERO políticas
-- —nadie de fuera lo lee ni lo toca— y quien lo mueve es el trigger, que corre
-- como dueño.
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists contadores_ticket (
  local_id uuid primary key references locales on delete cascade,
  ultimo   bigint not null default 0
);

alter table contadores_ticket enable row level security;
-- sin políticas: ni anon ni authenticated pueden verlo ni escribirlo
revoke all on table contadores_ticket from anon, authenticated;

-- Arranca el contador donde esté hoy la numeración de cada local, para que la
-- serie siga donde iba y no repita ningún número ya emitido.
insert into contadores_ticket (local_id, ultimo)
select l.id, coalesce((select max(t.numero) from tickets t where t.local_id = l.id), 0)
from locales l
on conflict (local_id) do update
  set ultimo = greatest(contadores_ticket.ultimo, excluded.ultimo);

create or replace function asignar_numero_ticket() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Toma el número bloqueando la fila del contador. Un local nuevo puede no
  -- tener fila todavía: se crea aquí y se numera desde 1.
  insert into contadores_ticket (local_id, ultimo)
  values (new.local_id, 1)
  on conflict (local_id) do update
    set ultimo = contadores_ticket.ultimo + 1
  returning ultimo into new.numero;

  return new;
end $$;

-- El trigger sigue igual: solo numera si no viene número puesto.
drop trigger if exists trg_ticket_numero on tickets;
create trigger trg_ticket_numero before insert on tickets
  for each row when (new.numero is null) execute function asignar_numero_ticket();

-- Es interna: la llama el trigger, nadie más.
revoke all on function asignar_numero_ticket() from public, anon, authenticated;

-- La sequence `tickets_numero_seq` de la migración 01 nunca se usó (el trigger
-- jamás hizo `nextval`). Se deja por si alguna instalación la referencia.
