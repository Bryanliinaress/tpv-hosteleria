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

El estado se mantiene en memoria con un store de **Zustand** (`src/store/useStore.js`). No hay backend todavía: los datos de carta y mesas son de demostración.

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

## Estado del proyecto

`v0.1.0` · En desarrollo. La edición de carta y la persistencia con backend están planificadas para la siguiente versión.
