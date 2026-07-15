# De demo a producto de mercado — hoja de ruta

**META: salir al mercado lo antes posible.** Este documento es la fuente de
verdad de lo que queda. Última actualización: 2026-07-14 (**v0.33.0**).

## Estado a 2026-07-03

**✅ Hecho y desplegado** (además de lo básico: QR, KDS, Mostrador, PDA,
reservas, caja, PINs): alérgenos 14 UE · PWA instalable · grupos de mesas con
cuenta única (arrastre + táctil) · marchar por tiempos · informes de ventas ·
RGPD reservas · tests+CI · carta genérica (formatos/extras/etiquetas) · editar
pedidos enviados · pagos mixtos + descuento registrado · auditoría de
anulaciones · cliente en inglés · identidad del local configurable.

Añadido desde v0.25: **onboarding del local** (`/setup`, v0.26) · **fichajes de
jornada** con export CSV (v0.27) · **fotos de productos** (v0.28) · fix de
sincronización que fusiona los logs solo-añadir para no perder fichajes/tickets
entre dispositivos (v0.28.1) · **modo claro/oscuro** conmutable y persistente
por dispositivo (v0.29.0) · **code-splitting por ruta** (v0.30.0): cada pantalla
es su chunk (React.lazy); el cliente por QR baja ~527 KB en vez de 734 KB, y
Admin/KDS/PDA se cargan bajo demanda · **resiliencia de sync** (v0.31.0):
reintento con backoff de escrituras fallidas, aviso "sin conexión" visible y
reenvío al reconectar — un pedido no se pierde por un parpadeo de wifi · **pulido UX/a11y** (v0.32.0):
+8 tests (40), contraste de pills de estado, sin `background-attachment:fixed`
(scroll fluido en móvil) y `role="dialog"`/`aria-modal` en los diálogos ·
**terreno preparado para el backend** (v0.33.0): migración 02 con las RPC
transaccionales escrita y parseada, capa de datos `lib/repo.js` tras flag
`VITE_BACKEND=v2` con tests de contrato (48), y borrador RGPD en `docs/RGPD.md`.

**Modo claro (v0.29.0)**: sistema de tokens CSS ampliado (superficies, textos,
bordes y "pozos" de estado success/danger/warning/info) con override
`:root[data-theme="light"]`; barrido de los hex hardcodeados a variables en las
9 pantallas; toggle ☀️/🌙 en Home y cabecera de Admin (preferencia en
`localStorage`, no en el estado sincronizado). Decisión de diseño: las pantallas
de **producción (cocina/barra)** van siempre en oscuro (clase `.force-dark`) por
lectura a distancia y menor reflejo en el pase. Verificado por auditoría de
contraste: sin texto ilegible en ninguna pantalla.

**🔜 Pendiente sin bloqueo** (puro código): la subida de fotos como archivo
llegará con el backend (Storage).

**⛔ Bloqueado en decisiones/cuentas del dueño (~30 min):**
1. ~~Proyecto **Supabase** de producción~~ ✅ **CREADO Y MIGRADO** (2026-07-14):
   migraciones 01+02 aplicadas, smoke test E2E por RPC en verde (pedido QR →
   cobro atómico → ticket nº1 → aforo), RLS verificado (anon no lee ni escribe
   tablas de servicio, ni llama RPC de personal). **2026-07-15: TERMINADO** —
   migración 03 (realtime + `estado_mesa` para el QR), seed de Casa Loli
   (3 categorías, 56 productos, 12 mesas, 3 empleados con PIN bcrypt) y usuario
   admin con `local_id` en el JWT, login verificado. Siguiente (solo front):
   pantalla de login + cablear el store a `lib/repo.js` (`VITE_BACKEND=v2`).
2. Cuenta **Verifacti** (gratis) → fiscal Verifactu
3. Cuenta **Stripe** real → webhook de pagos
4. **Impresora térmica** 80mm (~80€) → fase ESC/POS

Documentos hermanos: [COSTES.md](COSTES.md) (qué cuesta operar) ·
[supabase/BACKEND.md](supabase/BACKEND.md) (diseño backend) ·
[docs/IMPRESION.md](docs/IMPRESION.md) (probar impresión hoy).

---

## 🔴 Fase 0 — Bloqueantes críticos (sin esto NO se puede implantar)

### 1. Backend multi-local con datos aislados y autenticación real
- Hoy: **una fila JSONB compartida** en Supabase con **RLS abierto** — cualquiera
  con la anon key (pública, va en el front) puede leer/escribir todo. El acceso
  por PIN es de demostración (vive en ese mismo estado, sin cifrado).
- Necesita: Supabase Auth (o equivalente) + tablas normalizadas + **RLS por
  `local_id`** + roles verificados en servidor. Un local por negocio.
- ✅ **Diseño, esquema y RPC listos**: `supabase/migrations/20260626T01_multitenant.sql`
  (12 tablas, RLS, numeración fiscal) + `20260714T02_rpc_servicio.sql` (RPC
  transaccionales: pedido QR con precio en servidor, cobro atómico, grupos,
  marchar, reservas con aforo en servidor, PIN por hash) + capa de datos del
  front (`src/lib/repo.js`, flag `VITE_BACKEND=v2`) con tests de contrato.
  **Solo falta**: crear el proyecto de producción (gratis, ~10 min del dueño),
  aplicar las 2 migraciones y cablear el store al repo (probar contra el real).

### 2. Concurrencia real
- Hoy: "último que escribe gana" sobre el blob → con 2-3 camareros simultáneos
  se pueden pisar pedidos.
- Necesita: operaciones atómicas por entidad (pedido, línea, mesa) sobre las
  tablas normalizadas del punto 1.

### 3. Cumplimiento fiscal (España)
- **Verifactu** (RD 1007/2023) o **TicketBAI** (País Vasco) según territorio:
  registros de facturación verificables, encadenados y (en su caso) remitidos a
  la AEAT; numeración correlativa; datos fiscales completos; IVA por tipo;
  factura simplificada y completa; exportación.
- ✅ **Proveedor elegido: [Verifacti](https://www.verifacti.com)** (2,90€/NIF/mes,
  API Verifactu + TicketBAI, NIF de prueba gratis — ver COSTES.md §D). Plan:
  Edge Function que registra cada ticket al cerrarse y devuelve el QR
  verificable para imprimirlo. ⚠️ Sigue haciendo falta validar el calendario
  con la asesoría del local.

### 4. Pagos de verdad
- [x] ~~Bug returnUrl (el retorno de Stripe caía en la Home y el pago no se
  marcaba)~~ — arreglado en v0.13.1.
- [ ] **Webhook de Stripe**: confirmar el pago en servidor; no fiarse del
  retorno del navegador.
- [ ] **Stripe Connect** para que el dinero llegue a la cuenta del restaurante
  (⚠️ requiere alta/onboarding del negocio en Stripe).
- [ ] Devoluciones/anulaciones de pago. Conciliación con datáfono físico.

### 5. RGPD
- Se guardan nombres, emails y teléfonos (reservas): hace falta base legal,
  política de privacidad visible, consentimiento y borrado/retención.
- ⚠️ Textos definitivos a validar por asesoría.

## 🟠 Fase 0.5 — Imprescindible para operar el día a día

6. **Impresión térmica real (ESC/POS)** fiable y sin diálogo (hoy:
   `window.print()` + Chrome kiosko). Valorar un puente local (Node/agent) o
   impresoras de red con cola.
7. **Resiliencia/offline**: PWA instalable ✅ (v0.15.0) + reintento de escrituras
   con backoff, aviso de conexión y reenvío al reconectar ✅ (v0.31.0). La **cola
   offline** completa (operar sin red y encolar) sigue pendiente del backend Fase 0.
8. **Alérgenos por plato** (14 UE) — obligatorio informarlos. ✅ v0.14.0.
9. **Hardware**: tablets/PDAs, pantallas cocina, cajón portamonedas, TPV
   físico. ⚠️ Compra/instalación en el local.
10. **Errores y casos límite**: reintentos, anulación con motivo, doble envío,
    permisos finos por rol, recuperación de estados raros.
11. **Backups y monitorización** de datos y caja.

## 🟡 Fase 1 — Para que personal y dueño estén contentos

12. **Carta genérica**: variantes (tamaños) y modificadores configurables, no
    solo el modelo pan Pitufo/Viena. Menú del día, combos, medias raciones.
13. **Marchar por tiempos** (entrantes/principales/postres) y modificar pedidos
    ya enviados.
14. **Informes**: ventas por producto/camarero/hora/método, ticket medio.
15. **Reservas por franja horaria real** con auto-asignación de mesa (ver
    ROADMAP.md §1).
16. Fichajes/turnos, descuentos con motivo, pagos mixtos en un ticket.

## 🟢 Fase 2 — Producto y negocio

17. **Onboarding guiado** del local (alta, carta, sala, impresoras) en minutos.
18. **Entorno de pruebas separado** del de producción (hoy el dev escribe en el
    mismo Supabase que la demo pública).
19. **Tests + CI** (base creada; ampliar cobertura).
20. Soporte/formación, actualizaciones, SLA, modelo de precio. Integraciones:
    Reserve with Google, delivery, contabilidad.

---

## Qué puede hacerse desde este repo vs. qué requiere terceros

| Puede hacerse aquí | Requiere terceros / decisión del negocio |
|---|---|
| Migraciones SQL + RLS + auth | Certificación Verifactu/TicketBAI |
| Webhook Stripe (Edge Function) | Alta en Stripe Connect del restaurante |
| PWA, alérgenos, informes, carta genérica | Hardware (impresoras, tablets, cajón) |
| Tests, CI, onboarding, textos RGPD borrador | Validación legal (RGPD/fiscal) por asesoría |

## Orden de ataque recomendado
1. Backend multi-tenant + auth + RLS (habilita casi todo lo demás)
2. Webhook de pagos + impresión térmica
3. Fiscal (con asesoría) → piloto en 1 local amigo
4. Offline, informes, carta genérica → producción estable
