-- ────────────────────────────────────────────────────────────────────────────
-- 21. Cerrar de verdad las funciones internas.
--
-- La revisión de permisos encontró 8 funciones llamables por `anon` que nadie
-- había declarado. Tres de ellas —los cálculos de suplemento— YA tenían su
-- revoke escrito en la migración 11:
--
--     revoke execute on function sup_extras(uuid, jsonb) from anon, authenticated;
--
-- …y no servía de nada. El permiso no lo tenían `anon` ni `authenticated`
-- directamente: lo heredaban de **PUBLIC**, a quien Supabase se lo concede al
-- crear la función. Quitárselo a un rol que lo hereda no le quita nada. Es
-- peor que olvidarse, porque parece hecho y pasa la revisión de código.
--
-- Regla: en un `revoke` sobre una función va SIEMPRE `public` el primero.
--
-- Qué se cierra aquí y por qué:
--   · sup_*                     → cálculo interno del precio. Las llama
--     `qr_agregar_linea`, que es `security definer` y corre como su dueño, así
--     que no necesita que el cliente pueda llamarlas. Sueltas, dejan sondear
--     los suplementos de cualquier local.
--   · ticket_para_fiscal        → vuelca una factura entera para la AEAT.
--   · fiscal_resultado          → escribe el resultado del registro fiscal.
--     Las dos las llama la Edge Function `registrar-fiscal` con la service
--     key. Abiertas, cualquiera leía facturas y marcaba tickets como
--     registrados.
--   · registrar_local           → CREA un local. Abierta a `anon`, cualquiera
--     podía dar de alta locales en el proyecto.
--   · mi_local                  → el local de la sesión; sin sesión no
--     devuelve nada útil, pero no pinta nada abierta.
--   · tickets_fiscal_pendientes → lista de tickets sin registrar; es del
--     panel de administración.
-- ────────────────────────────────────────────────────────────────────────────

-- Internas: nadie las llama desde fuera
revoke all on function sup_tipo_pan(uuid, text)  from public, anon, authenticated;
revoke all on function sup_extras(uuid, jsonb)   from public, anon, authenticated;
revoke all on function sup_menu(uuid, jsonb)     from public, anon, authenticated;

-- Fiscal: solo el servidor (Edge Function con service_role)
revoke all on function ticket_para_fiscal(uuid) from public, anon, authenticated;
revoke all on function fiscal_resultado(uuid, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function ticket_para_fiscal(uuid) to service_role;
grant execute on function fiscal_resultado(uuid, text, text, text, text, text) to service_role;

-- Del personal con sesión, nunca del cliente
revoke all on function mi_local()                   from public, anon;
revoke all on function registrar_local(text, text)  from public, anon;
revoke all on function tickets_fiscal_pendientes()  from public, anon;
grant execute on function mi_local()                  to authenticated;
grant execute on function registrar_local(text, text) to authenticated;
grant execute on function tickets_fiscal_pendientes() to authenticated;
-- `registrar-fiscal` llama a mi_local() con el token del usuario, pero el
-- service_role también entra ahí en algunos caminos.
grant execute on function mi_local() to service_role;
