-- ───────────────────────────────────────────────────────────────────────────
-- Admin → Local no podía guardar NADA.
--
-- `locales` era la única tabla del esquema cuya política de escritura exigía
-- que el usuario autenticado estuviera enlazado a una fila de `empleados` con
-- rol admin:
--
--   using (id = local_actual() and exists (
--     select 1 from empleados e
--      where e.local_id = locales.id and e.user_id = auth.uid() and e.rol = 'admin'))
--
-- Eso tenía sentido cuando cada persona entraba con su email y su contraseña y
-- tenía su usuario de Supabase enlazado en `empleados.user_id`. Con el modelo
-- de dispositivos —cada aparato tiene SU cuenta, y quien identifica a la
-- persona es el PIN— la cuenta que llega nunca está en `empleados`, así que la
-- condición no puede cumplirse jamás y toda escritura se iba en un 403.
--
-- En la práctica: el nombre del local, la dirección, el TELÉFONO, el CIF, el
-- IVA, la razón social y el pie del ticket no se podían cambiar desde la app.
-- El CIF que hay puesto lo escribió el script de aprovisionamiento con la clave
-- de servicio, no la pantalla. (Y por eso llevaba semanas en la lista de
-- pendientes «rellenar teléfono y dirección en Admin → Local»: no se podía.)
--
-- Se alinea con el resto del esquema: `tenant_all` para `authenticated`, igual
-- que `mesas`, `productos`, `tickets`, `cierres_caja` y la propia `empleados`.
-- Que sea admin lo sigue exigiendo la pantalla con el PIN, como en las demás
-- pestañas de Admin — y no tendría sentido proteger el pie del ticket MÁS que
-- la tabla de empleados, que ya era `tenant_all`.
-- ───────────────────────────────────────────────────────────────────────────
drop policy if exists local_update on locales;
create policy local_update on locales for update to authenticated
  using (id = local_actual())
  with check (id = local_actual());
