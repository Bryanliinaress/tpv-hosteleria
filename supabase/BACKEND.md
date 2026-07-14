# Backend multi-local — diseño y plan de migración

Diseño del backend serio (Fase 0 de [PRODUCCION.md](../PRODUCCION.md)): un local
por negocio, datos aislados con RLS y operaciones por entidad en lugar del blob
JSONB único de la demo.

## Esquema

Ver [`migrations/20260626T01_multitenant.sql`](migrations/20260626T01_multitenant.sql):

| Tabla | Qué guarda |
|---|---|
| `locales` | El negocio (tenant): nombre, slug, config (identidad, reservas) |
| `empleados` | Personal por local, con `user_id` (Supabase Auth) y `pin_hash` |
| `mesas` | Sala: zona, capacidad, estado, grupos (`unida_a`) |
| `categorias` / `productos` | Carta con `precios` (variantes), `modificadores` y `alergenos` |
| `comensales` / `lineas_pedido` | Servicio en curso, por entidad (adiós al blob) |
| `comandas` | Cola cocina/barra con estados `espera→recibido→preparando→listo` |
| `avisos` | Llamadas al camarero |
| `reservas` | Agenda con token de autogestión |
| `tickets` | Historial con **numeración correlativa por local** (base fiscal) |
| `cierres_caja` | Arqueos Z |

## Seguridad (modelo de acceso)

- **Personal**: inicia sesión con Supabase Auth; su JWT lleva
  `app_metadata.local_id`. Las policies (`tenant_all`) le limitan a su local.
  El **PIN** pasa a ser cambio rápido de usuario en dispositivos ya
  autenticados (hash en `empleados.pin_hash`, verificado por RPC, nunca en claro).
- **Cliente anónimo (QR/reservas)**: solo lectura de carta/sala; las acciones
  (unirse a mesa, pedir, reservar, llamar camarero) van por **funciones RPC
  `security definer`** que validan cada operación (migración 02, pendiente).
- **Roles**: `admin` (todo), `camarero` (servicio), `cocina` (KDS). La config
  del local solo la actualiza un admin (policy `local_update`).

## Concurrencia

Cada acción muta su entidad (una línea, una comanda, una mesa) → dos camareros
ya no se pisan. Las transiciones sensibles (cobrar, agrupar mesas, marchar) se
implementan como RPC transaccionales.

## Realtime

Suscripciones por tabla filtradas por `local_id` (en vez de una fila global):
`comandas` para KDS, `mesas`+`comensales`+`lineas_pedido` para sala/cliente,
`avisos` para la PDA, `reservas` para la agenda.

## Plan de migración desde la demo

1. **Aplicar las migraciones 01 y 02** en un proyecto de Supabase
   **nuevo/limpio** (separar demo de producción, punto 18 de PRODUCCION.md).
2. ✅ **Migración 02 ESCRITA** (`migrations/20260714T02_rpc_servicio.sql`):
   RPC transaccionales de servicio — cliente QR (`qr_*`: unirse, pedir con
   precio resuelto EN SERVIDOR, confirmar, llamar, cuenta), reservas online con
   validación de aforo en servidor + autogestión por token, y personal
   (`pagar_parte`/`cobrar_mesa` con cierre atómico y ticket fiscal,
   agrupar/separar, marchar, anular con auditoría, PIN por hash bcrypt).
   GRANTs mínimos: `anon` solo sus RPC. Sintaxis validada con libpg_query.
3. **Capa de datos en el front**: ✅ base creada en `src/lib/repo.js`
   (repositorio por entidad que mapea 1:1 a las RPC + realtime por tabla
   filtrado por `local_id`), tras el flag `VITE_BACKEND=v2` — la demo sigue
   con el blob. Tests de contrato repo↔RPC en `src/lib/repo.test.js`.
   Falta: cablear el store a este repo + optimistic updates (necesita el
   proyecto real para probar).
4. **Auth**: pantalla de login del local (email+contraseña del encargado) que
   fija el dispositivo al local; el PIN sigue siendo el cambio de usuario.
5. **Seed**: script que vuelca el estado JSONB actual a las tablas (carta,
   mesas, empleados, reservas) para no reconfigurar a mano.
6. Corte: activar el front nuevo local a local. La demo pública puede seguir
   con el blob para no requerir login.

> ⚠️ Aplicarlo requiere un token de Supabase (`supabase db push`) o pegar el
> SQL en el editor del panel — no se puede hacer desde este repo sin
> credenciales. Los pasos 2-6 son trabajo de código normal una vez exista el
> proyecto de producción.
