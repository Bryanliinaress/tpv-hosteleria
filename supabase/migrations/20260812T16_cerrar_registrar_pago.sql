-- ────────────────────────────────────────────────────────────────────────────
-- 16. `registrar_pago_online` NO puede ser llamable por el cliente.
--
-- La migración 10 ya lo decía en un comentario: «La llama el webhook con
-- service_role (por eso no se concede a anon ni a authenticated)». Pero no
-- basta con no concederlo: Supabase tiene `alter default privileges` que dan
-- EXECUTE a `anon` y `authenticated` en cuanto se crea la función. Comprobado
-- en la BBDD real: `has_function_privilege('anon', …)` daba TRUE.
--
-- Es la función que marca comensales como pagados y cierra la mesa. Con ella
-- al alcance del cliente anónimo, cualquiera con la carta abierta podía
-- cerrar su propia cuenta sin pagar: se inventa la referencia, manda el
-- importe que quiera y la mesa queda saldada.
--
-- El webhook de Stripe usa la service_role key, que se salta los permisos
-- (BYPASSRLS y superusuario de la API), así que sigue funcionando igual.
-- ────────────────────────────────────────────────────────────────────────────
revoke all on function registrar_pago_online(uuid, uuid, numeric, numeric, text, uuid)
  from public, anon, authenticated;

-- Misma revisión para el resto de funciones que solo son del servidor.
-- `pendiente_de_pago` SÍ se queda accesible: la llama `crear-checkout`, que va
-- con la anon key, y solo dice cuánto se debe en una mesa que ya está abierta.
revoke all on function _cerrar_grupo(uuid[], numeric, jsonb, text, text, numeric)
  from public, anon;
