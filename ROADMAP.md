# Roadmap — pendiente para la versión final

Lista de trabajo pendiente para llevar la demo a un producto "de verdad".
Ordenado por prioridad/impacto. Última actualización: 2026-06-25 (v0.3.4).

---

## 1. Reservas — gestión de mesas seria ⭐ (lo más importante)

El sistema actual controla el **aforo total** (no deja sobrepasar plazas) y el
formulario está muy optimizado, **pero la gestión de mesas tiene una limitación
de fondo**: una mesa tiene un estado binario (`libre`/`reservada`/`ocupada`), no
una agenda por horas. Falta:

- [ ] **Modelo de reserva de mesa basado en tiempo**: cada reserva ocupa una mesa
  concreta **solo durante su ventana horaria** (no bloquea la mesa todo el día).
  Una mesa puede tener **varios turnos** en el mismo día.
- [ ] **Disponibilidad de mesa por hora**: al asignar, ofrecer las mesas libres
  *a esa hora*, no las libres *ahora*.
- [ ] **Auto-asignación**: elegir automáticamente la mejor mesa que encaje
  (capacidad mínima suficiente + zona preferida).
- [ ] **Juntar mesas** para grupos grandes (combinar 2+ mesas y tratarlas como una).
- [ ] **Aforo por mesas reales (table-fit)**: hoy el aforo cuenta plazas totales;
  debe comprobar que **cada grupo quepa en una mesa real** (p. ej. un grupo de 3
  no cabe si solo hay mesas de 2, aunque el aforo total lo permita).

> Esto es lo que evita de verdad las "reservas dobles" de mesa y los líos de sala.
> Es la pieza que convierte esto en un CoverManager real.

### Reservas — otras mejoras
- [ ] **Recordatorio automático** por email el día antes (necesita backend con
  tareas programadas: Supabase Edge Function + pg_cron, o similar). Hoy el
  recordatorio es un botón manual del personal.
- [ ] **Entrada manual de reservas por el personal** (reservas de teléfono / walk-in)
  desde el panel, con buscador por nombre/email.
- [ ] **Políticas**: tamaño máximo de grupo, **depósito/prepago** para grupos
  grandes, tiempo de cortesía (no-show automático tras X min).
- [ ] **Ficha de cliente**: historial de visitas y de no-shows (cliente habitual).

---

## 2. Configurable para CUALQUIER bar

- [ ] **Identidad del local configurable**: nombre, subtítulo, dirección, CIF,
  **% de IVA** (hoy 10% fijo en el ticket), moneda y pie de ticket. Quitar el
  "CASA LOLI" hardcodeado del ticket. (Haría que los correos y tickets lleven el
  nombre real del bar.)
- [ ] **Modelo de carta genérico**: hoy un producto obliga a tener "pan"
  (Pitufo/Viena + tipo de pan + extras a +0,20 € fijos). Generalizar a
  **variantes** (tamaños) y **modificadores** opcionales configurables, para que
  sirva a una pizzería, sushi, cafetería, etc. Casa Loli pasaría a ser un ejemplo.

---

## 3. Backend / producción seria (cuando se implante en un local real)

- [ ] **Multi-tenant real**: un local por negocio, datos aislados, con backend y
  seguridad serios (Supabase con `local_id` + **RLS** por local). Hoy es una sola
  fila JSONB compartida para la demo.
- [ ] **Autenticación de personal** (roles: admin / camarero / cocina).
- [ ] Separar un **Supabase de pruebas** del de producción (hoy el dev local
  escribe en el mismo proyecto que la demo pública → cualquier prueba la ensucia).
- [ ] Botón de **reset remoto** del estado (hoy "Reiniciar datos" solo borra el
  localStorage, no el estado sincronizado).

---

## 4. Pagos (Stripe)

- [ ] **Webhook de Stripe** para confirmar el pago de forma segura (en vez de
  fiarse del retorno del navegador).
- [ ] **Bug conocido**: la `returnUrl` de Stripe no lleva el hash de la ruta
  (`src/lib/pagos.js`), así que al volver el cliente cae en la Home y el pago no
  se marca como pagado. Revisar al retomar Stripe.
- [ ] Pago del cliente con **Stripe Connect** (el dinero va al restaurante, comisión
  para la plataforma) si se monta como SaaS.

---

## 5. Integraciones (futuro)

- [ ] **"Reserve with Google"** como partner oficial (botón de reserva nativo en el
  perfil de Google Business). Requiere alta B2B con Google; mientras tanto se usa
  el enlace a la página `/reservar` en el perfil.
