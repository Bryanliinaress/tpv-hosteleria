# TPV Hostelería

Aplicación de TPV (Terminal Punto de Venta) para hostelería construida con **React + Vite + Zustand + Tailwind CSS**. Permite gestionar el flujo completo de un bar/restaurante con varias vistas según el rol.

## Roles / pantallas

| Ruta | Pantalla | Descripción |
|------|----------|-------------|
| `/` | Home | Selector de rol para acceder a cada pantalla |
| `/mesa/:mesaId` | Carta Cliente | Vista del cliente (QR por mesa): carta, pedido por persona y cuenta |
| `/camarero` | Panel Camarero | Estado de mesas, detalle de pedidos y cobro/cierre |
| `/cocina` | Pantalla KDS Cocina | Cola de pedidos de comida con estados (recibido → preparando → listo) |
| `/barra` | Pantalla Barra | Cola de pedidos de bebida con estados |
| `/admin` | Panel Admin | Carta, mesas, QR codes y estadísticas básicas |

El estado se mantiene en un store de **Zustand** (`src/store/useStore.js`) con **persistencia en `localStorage`** y **sincronización en vivo entre pestañas/pantallas del mismo navegador** (vía evento `storage`). Así, un pedido hecho en la pantalla del cliente aparece al instante en cocina/barra/camarero y nada se pierde al recargar.

> Nota: la sincronización es **por navegador**. Para multi-dispositivo real (varias tablets/móviles) hace falta un backend — ver _Roadmap_.

### Funciones del Panel Admin
- **Carta editable:** añadir, editar, borrar productos y marcarlos como agotados/disponibles.
- **QR Codes:** generación de códigos QR reales por mesa (`qrcode.react`) listos para imprimir.

## Estructura

```
src/
  App.jsx            # Rutas (react-router-dom)
  main.jsx           # Punto de entrada
  index.css          # Variables de tema + Tailwind
  store/useStore.js  # Estado global (carta, mesas, pedidos)
  pages/
    Home.jsx
    cliente/CartaCliente.jsx
    camarero/PanelCamarero.jsx
    cocina/PantallaKDS.jsx
    barra/PantallaBarra.jsx
    admin/PanelAdmin.jsx
```

## Desarrollo

```bash
npm install
npm run dev      # arranca Vite en modo desarrollo
npm run build    # build de producción
npm run preview  # previsualiza el build
npm run lint     # ESLint
```

## Roadmap

- [x] Persistencia local (`localStorage`)
- [x] Sincronización en vivo entre pantallas del mismo navegador
- [x] Edición de carta en el Panel Admin
- [x] Generación de QR reales por mesa
- [ ] Backend (Supabase) para sincronización multi-dispositivo en tiempo real
- [ ] Autenticación de personal (roles)

## Estado del proyecto

`v0.1.0` · En desarrollo.
