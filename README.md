# TPV Hostelería

![version](https://img.shields.io/badge/version-0.3.4-blue)
![license](https://img.shields.io/badge/license-Proprietary-red)
![stack](https://img.shields.io/badge/React%2019-Vite-646cff)
[![demo](https://img.shields.io/badge/demo-online-brightgreen)](https://bryanliinaress.github.io/tpv-hosteleria/)

**TPV (Terminal Punto de Venta) genérico para hostelería**, configurable para cualquier
bar o restaurante. Cubre el flujo completo —carta, sala, comandas, cobro, caja y
reservas— con una vista distinta por rol y **sincronización en tiempo real entre
dispositivos**.

🔗 **Demo en vivo:** https://bryanliinaress.github.io/tpv-hosteleria/

> Es una **demo**: usa la carta de ejemplo **"Casa Loli"** (desayunos/montaditos,
> cafés y bebidas) solo como datos realistas de referencia. La carta, la sala y el
> resto de ajustes son **editables** desde el Panel Admin para adaptarlo a cualquier local.

---

## ✨ Funcionalidades

**Operativa de sala**
- Carta y sala (mesas, zonas, capacidades) **editables y sincronizadas**.
- Comandas a **cocina (KDS)** y **barra** con estados (recibido → preparando → listo).
- Mover/juntar mesas y transferir comensales.
- **Estación de impresión** automática de comandas (Chrome `--kiosk-printing`).

**Cliente (QR por mesa)**
- Se identifica por nombre; varios móviles = varios comensales en la misma cuenta.
- Pide por persona, personaliza platos (quitar/añadir, notas), **divide platos** y
  **paga su parte** con propina; seguimiento en vivo del estado de cada plato.

**Cobro y caja** · *(v0.2.0)*
- **Métodos de pago** al cobrar: efectivo / tarjeta / Bizum (por comensal o mesa entera).
- **Cierre de caja / arqueo (Z)**: ventas del día, desglose por método y por camarero,
  efectivo contado y **descuadre**.
- Cada comanda y cobro queda **asociado al camarero** que lo hizo.

**Reservas online** · *(v0.2.0)*
- Página pública **`/reservar`** estilo CoverManager: día, hora, nº de personas y
  **zona preferida**, con confirmación inmediata.
- **Gestión** desde Admin y Camarero: asignar mesa, sentar, cancelar y no-show.

**Pagos online** *(modo prueba)*
- Pago con tarjeta/Bizum vía **Stripe Checkout** (Edge Function de Supabase).

## 🗺️ Roles / pantallas

| Ruta | Pantalla | Descripción |
|------|----------|-------------|
| `/` | Home | Selector de rol |
| `/mesa/:mesaId` | Carta Cliente | Vista del cliente (QR): carta, pedido por persona y cuenta |
| `/camarero` | Panel Camarero | Mesas, cobro con método, reservas y cierre |
| `/pda` | PDA Camarero | Móvil de mano: avisos, mesas, cobro y reservas |
| `/cocina` | KDS Cocina | Cola de pedidos de comida |
| `/barra` | KDS Barra | Cola de pedidos de bebida |
| `/admin` | Panel Admin | Carta, mesas, **caja/arqueo**, **reservas**, tickets y QR |
| `/print` | Estación de impresión | Imprime comandas automáticamente |
| `/reservar` | Reservas (cliente) | Reserva online pública estilo CoverManager |

## 🧱 Stack

- **React 19** + **Vite** + **React Router** (HashRouter)
- **Zustand** (estado global, persistencia en `localStorage`)
- **Tailwind CSS**
- **Supabase** (sincronización en tiempo real vía Realtime)
- **Stripe** (pago online, modo prueba)
- Despliegue: **GitHub Pages** vía GitHub Actions

### Sincronización (Supabase)
- El estado compartido se guarda en una fila JSONB y se propaga con **Realtime**
  (`src/lib/sync.js`). Un pedido hecho en un móvil aparece al instante en
  cocina/barra/camarero en cualquier otro dispositivo.
- Se configura por variables de entorno (`.env`, ver `.env.example`):
  `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
- Sin credenciales, la app funciona en **modo local** (solo `localStorage`).

## 🚀 Desarrollo

```bash
npm install
npm run dev      # arranca Vite en modo desarrollo
npm run build    # build de producción
npm run preview  # previsualiza el build
npm run lint     # ESLint
```

## 📁 Estructura

```
src/
  App.jsx               # Rutas
  main.jsx              # Punto de entrada + arranque de la sincronización
  store/useStore.js     # Estado global (carta, mesas, pedidos, caja, reservas)
  lib/
    sync.js             # Sincronización Supabase Realtime
    pagos.js            # Pago online con Stripe
  components/
    Ticket.jsx          # Tickets imprimibles (comanda / cuenta)
    MetodoPago.jsx      # Selector de método de pago
    ReservasManager.jsx # Agenda y gestión de reservas
  pages/
    Home.jsx
    cliente/CartaCliente.jsx
    camarero/PanelCamarero.jsx
    pda/PdaCamarero.jsx
    cocina/PantallaKDS.jsx
    barra/PantallaBarra.jsx
    admin/PanelAdmin.jsx
    print/PrintStation.jsx
    reservar/Reservar.jsx
```

## 🌳 Ramas y versiones

Modelo **GitFlow** + **SemVer**:

- `main` — producción (cada push despliega la demo).
- `develop` — integración del trabajo en curso.
- `feature/*` — funcionalidades nuevas (salen de `develop`).
- `release/*` — cierre de versión.

Las versiones se etiquetan (`v0.1.0`, `v0.2.0`, …) y se documentan en
[CHANGELOG.md](CHANGELOG.md).

## 🛣️ Roadmap

- [x] Métodos de pago, arqueo de caja y atribución por camarero *(v0.2.0)*
- [x] Reservas online estilo CoverManager *(v0.2.0)*
- [ ] Identidad del local configurable (nombre, IVA, CIF, pie de ticket)
- [ ] Modelo de carta genérico (variantes/modificadores para cualquier tipo de bar)
- [ ] Multi-tenant real (un local por negocio) con backend y autenticación serios
- [ ] Webhook de Stripe para confirmar el pago de forma segura

## 📄 Licencia

**Propietaria — todos los derechos reservados.** Ver [LICENSE](LICENSE).
El código se publica con fines de demostración y portafolio; no se concede licencia de uso.

---

© 2026 Bryan Linares · `v0.3.4`
