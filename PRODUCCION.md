# De demo a producto de mercado — hoja de ruta

**META: salir al mercado lo antes posible.** Este documento es la fuente de
verdad de lo que queda. Última actualización: 2026-07-03 (**v0.25.0**).

## Estado a 2026-07-03

**✅ Hecho y desplegado** (además de lo básico: QR, KDS, Mostrador, PDA,
reservas, caja, PINs): alérgenos 14 UE · PWA instalable · grupos de mesas con
cuenta única (arrastre + táctil) · marchar por tiempos · informes de ventas ·
RGPD reservas · tests+CI · carta genérica (formatos/extras/etiquetas) · editar
pedidos enviados · pagos mixtos + descuento registrado · auditoría de
anulaciones · cliente en inglés · identidad del local configurable.

**🔜 Pendiente sin bloqueo** (puro código): onboarding del local ("configúralo
en 15 min"), modo claro, fotos de productos.

**⛔ Bloqueado en decisiones/cuentas del dueño (~30 min):**
1. Proyecto **Supabase** de producción + token → aplicar migración multi-tenant
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
- ✅ **Diseño y esquema listos**: `supabase/migrations/20260626T01_multitenant.sql`
  (12 tablas, RLS, numeración fiscal de tickets) + plan completo en
  `supabase/BACKEND.md`. Falta aplicarlo en un proyecto de producción (requiere
  credenciales) e implementar las RPC (migración 02) y la capa de datos del front.

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
7. **Resiliencia/offline**: PWA instalable ✅ (v0.15.0) + **cola offline** de
   operaciones y reconexión (pendiente; depende del backend de Fase 0).
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
