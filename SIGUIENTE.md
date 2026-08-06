# Punto de partida para la siguiente sesión

**Estado: v0.51.0, todo desplegado, repo limpio y sincronizado.**
Última sesión: 2026-08-05. Fuente de verdad del roadmap: [PRODUCCION.md](PRODUCCION.md).

## Cómo probar la UI sin ensuciar la demo

`npm run dev -- --mode pruebas` levanta la app **sin backend** (`.env.pruebas`
deja las claves vacías): todo va a localStorage y el blob compartido de la demo
no se toca. Es la forma segura de trastear pantallas.

## Lo primero, si algo no conecta

⚠️ **El plan gratuito de Supabase pausa el proyecto tras ~1 semana sin
actividad.** Síntoma: el subdominio no resuelve y todo da "Failed to fetch".
No es un fallo del código: entra en [supabase.com/dashboard](https://supabase.com/dashboard)
y pulsa **Resume project**. Los datos se conservan. Ya pasó una vez (18 días
parados). Por eso **Supabase Pro es requisito de producción**, no un extra.

## Los dos entornos

| | URL | Backend |
|---|---|---|
| **Demo pública** | https://bryanliinaress.github.io/tpv-hosteleria/ | Blob JSONB (proyecto viejo) |
| **App real** | https://bryanliinaress.github.io/tpv-hosteleria/app/ | Multi-tenant `tesilntyomnovjcuieho` |

Ambas salen del mismo código; el workflow hace **dos builds** y la app real
lleva `VITE_BACKEND=v2` y `VITE_FISCAL=verifactu`.

Desarrollo: `npm run dev` (demo) · `npm run dev:v2` (app real, usa `.env.v2`,
que está gitignorado y solo existe en el PC de Bryan).

## Qué está hecho (y verificado de verdad)

- **Backend multi-tenant**: 10 migraciones, RLS por local, RPC transaccionales.
  Probado contra la BBDD real: 27/27 comprobaciones.
- **Fiscal Veri*Factu**: ticket registrado en la **AEAT de pruebas** con su
  UUID y URL de cotejo. QR impreso en el ticket. Reintentos en Admin → Tickets.
- **Alta de negocios**: cualquier bar se registra y tiene su local aislado,
  con carta de ejemplo de un clic.
- **Cola offline**: los pedidos hechos sin wifi se guardan y se envían solos.
  Los cobros **nunca** se encolan (evita duplicar tickets).
- **Impresión ESC/POS**: comandas sin diálogo, corte, QR nativo y cajón.
  USB, puente de red o navegador, elegible por dispositivo.
- **Webhook de Stripe**: el cobro lo confirma el servidor con firma verificada.
- **Menú del día y combos**, pagos mixtos, grupos de mesas, reservas con
  aforo en servidor, fichajes, arqueo de caja, modo claro, inglés.

- **Perfiles de local**: un producto, una instalación por bar. Ver `locales/`.
- **Repaso de usabilidad en móvil (v0.46-0.48)**, medido a 375 px:
  - Cliente: ve la carta **antes** de dar su nombre; el botón de añadir de la
    hoja ya no queda fuera de pantalla; categorías pegadas; cantidad en la
    tarjeta; búsqueda sin tildes y por ingredientes.
  - Personal: buscador en la PDA (tomar pedido y marcar agotados); botones de
    cantidad de 24 px → 36-44 px; el mostrador ya no desborda a lo ancho.
  - Admin: la página ya no mide 1034 px de ancho en un móvil de 375; buscador
    en la carta; acciones de fila de 29×23 px → 40×40 con «borrar» separado.

**183 tests**, lint limpio, CI y deploy en verde.

## Auditoría del dinero (v0.51.0)

Repaso a fondo de la lógica de cobro. Cuatro fallos reales, los cuatro con test
de regresión en `src/store/dinero.test.js`:

1. **Los platos compartidos falseaban el desglose por método.** El ticket
   cargaba el importe a quien pidió el plato, no a quien lo pagó: Ana paga 10 €
   con tarjeta y Luis 10 € en efectivo → el ticket anotaba «tarjeta 20» y el
   efectivo de Luis no aparecía. **El cajón cuadraba mal cada vez que alguien
   compartía plato y pagaban por separado.**
2. **El arqueo ignoraba las propinas en efectivo**, que sí están en el cajón:
   cantaba un sobrante falso. Ahora el panel enseña «ventas en efectivo +
   propinas en efectivo = esperado en el cajón».
3. **Ids por `Date.now()`**: dos comensales que se unían en el mismo
   milisegundo salían con el MISMO id, y lo que pedía uno se le cargaba también
   al otro (y el cobro se duplicaba). Ahora todos los ids llevan sufijo
   aleatorio.
4. **«Otra ronda» en el backend real repetía el servicio entero**: v2 no tiene
   sello de envío. Ahora agrupa por la fecha de creación de la línea, y sin
   ninguna fecha repite solo la última línea (nunca todo).

## Pendiente — y de quién depende

### De Bryan (sin esto no se avanza)
1. **Aplicar la migración 10** (`20260804T10_pagos_online.sql`): hace falta un
   token nuevo de Supabase. Es 1 minuto.
2. **Impresora térmica 80 mm** (~60-100 €) para probar ESC/POS de verdad.
3. **Cuenta de Stripe** real (+ activar Bizum) para el pago por QR.
4. **NIF real en Verifacti** y pasar a su entorno de producción, cuando haya
   un local de verdad. Pasar a producción **no toca código**: es cambiar el
   secreto `VERIFACTI_API_KEY` (`vf_test_…` → `vf_prod_…`); la URL es la misma.
5. **Probar el alta de un bar nuevo end-to-end** en `/app/`: yo no puedo
   autenticarme con contraseñas, así que ese login lo tiene que hacer él.

### ⚠️ Bloqueos del PRIMER BAR REAL (no de hoy, pero antes de facturar)
1. **Facturas rectificativas (R1-R5)**: hoy, si un ticket ya emitido y
   registrado en la AEAT necesita devolución o corrección, no hay salida —
   borrar no se puede (y está bien que no se pueda). Falta emitir la
   rectificativa contra Verifacti y enlazarla al ticket original. En un bar
   pasa: se cobra de más, el cliente reclama al día siguiente.
2. **Declaración responsable del fabricante**: obligación de Bryan desde el
   29-7-2025 por comercializar software de facturación. No es código;
   confirmar con asesor qué formato exige.

### De código (se puede hacer sin nadie)
Ver la sección siguiente: la prioridad ha cambiado.
- Informes más ricos (por producto/camarero/hora), backups y monitorización.
- Reservas por franja con auto-asignación de mesa.
- ~~Stripe Connect~~: **ya no es prioritario** — con una instancia por bar,
  cada local pone directamente SUS claves de Stripe.

## ⚠️ CAMBIO DE MODELO (2026-08-05)

**Cada bar tendrá su propia instalación**, no un SaaS multi-tenant compartido.
Decisión de Bryan. Cada local llevará **su proyecto Supabase, su despliegue, su
dominio, su marca y sus funciones a medida** si las necesita.

### Lo que NO se tira
El backend multi-tenant sigue valiendo: el aislamiento por `local_id`,
`registrar_local()` y `scripts/provisionar-produccion.mjs` son la base para dar
de alta un bar nuevo rápido, aunque cada uno viva en su sitio.

### Cómo hacerlo sin acabar con 8 copias divergentes
Copiar el repo por bar parece cómodo y es una trampa: a los meses, arreglar un
bug son N arreglos. El modelo acordado es **producto base + perfiles**:

- **Un repo con el producto** (este), que evoluciona para todos.
- **Un perfil por bar**: marca, dominio, claves y configuración.
- **Funciones a medida como módulos opcionales**, cargados solo en ese bar
  mediante puntos de extensión, sin ensuciar el núcleo.
- **Una instancia desplegada por bar**.

### Trabajo que esto implica (nueva prioridad)
1. ~~**Perfiles de local**~~ ✅ **hecho (v0.45.0)**: `locales/<slug>/perfil.json`
   con marca, dominio, claves y módulos. `npm run locales -- build <slug>` (o
   `LOCAL=<slug> npm run build`). La demo y la app real ya salen de sus perfiles
   (`locales/demo/` y `locales/casa-loli/`) y el deploy compila todos de golpe.
   Manual: [locales/README.md](locales/README.md).
2. **Alta industrializada**: un solo comando que cree el proyecto Supabase,
   aplique las 10 migraciones, siembre la carta, registre el local y despliegue.
   Base ya existente: `scripts/provisionar-produccion.mjs`.
3. **Marca blanca**: ya sale en la **portada, la pestaña, la PWA** y la
   **cabecera de la carta QR**. Falta el **ticket**, que sigue usando el nombre
   guardado en el estado del local.
4. **Puntos de extensión** para las funciones a medida por cliente.
5. **Actualizar N instancias**: un comando que redespliegue todos los bares.

### Lo que Bryan debe tener presente
- Supabase Pro son **~23 €/mes por bar** (el free se pausa). Con 10 bares,
  ~230 €/mes de infraestructura. Cobrando 25-40 €/bar el margen pasa de ~95%
  a ~30-40%: sigue saliendo a cuenta, pero conviene fijar el precio sabiéndolo.
- Cada mejora hay que desplegarla en cada bar: por eso el punto 5 no es opcional.

## Lo más valioso ahora (opinión)

Aun con el cambio de modelo, sigue siendo **poner esto en un bar real una
tarde**, aunque sea de un amigo. Un servicio de verdad dirá en dos horas qué
chirría, y eso vale más que cualquier lista de tareas. Lo único que hace falta
antes es la impresora. El primer bar además sirve para estrenar el proceso de
alta y ver cuánto cuesta de verdad montar uno.

## Detalles que ahorran tiempo

- **Credenciales**: yo no puedo teclear contraseñas en formularios de login ni
  guardar tokens en ficheros. Los tokens `sbp_` se usan y se revocan.
- **Migraciones**: se aplican con la Management API
  (`POST https://api.supabase.com/v1/projects/<ref>/database/query`) o con el
  runner `scripts/provisionar-produccion.mjs`. No hace falta Docker.
- **Edge Functions**: `npx supabase functions deploy <nombre> --project-ref <ref>`
  (con `--no-verify-jwt` para el webhook de Stripe). Tampoco necesita Docker.
- **Calendario de Veri*Factu** (verificado el 05/08/2026, RDL 15/2025 lo aplazó
  un año): obligatorio para **sociedades el 1-1-2027** y para **autónomos el
  1-7-2027**. Ojo al argumentario de venta: a un bar autónomo aún le quedan
  meses, así que **no se vende como «o multa»**, se vende como «ya resuelto».
  Lo que **sí** aplica ya es al **fabricante de software**: lo comercializado
  desde el 29-7-2025 debe ser conforme. Pendiente de confirmar con asesor la
  **declaración responsable** que exige el reglamento al fabricante.
- **Entornos de Verifacti**: misma URL para pruebas y producción; lo que cambia
  es la API key (`vf_test_…` / `vf_prod_…`).
- **Gotcha de Verifacti**: en factura simplificada (F2) **no** se envían
  `nif`/`nombre` — son del destinatario y la AEAT lo rechaza.
- **Gotcha de supabase-js**: no lanza excepción en fallos de red, los devuelve
  en `error`. Ojo al tratar reintentos.
- **Apagar el `npm run dev` antes de pruebas largas**: si queda vivo y vuelve
  la conexión, reenvía su estado al blob compartido y ensucia la demo.

## Deuda de usabilidad: hecha en v0.49.0

Todo lo que quedaba medido de la ronda anterior ya está:

- ~~Repetir pedido~~ ✅ «🔁 Otra ronda» en la carta del cliente y en la PDA, y
  repetir línea suelta. Mantiene pan, extras y notas.
- ~~KDS por mesa~~ ✅ cocina y barra agrupan por mesa (`ColaKDS`), la más vieja
  arriba, y un botón mueve la mesa entera.
- ~~Informes en móvil~~ ✅ tarjeta «Hoy» y gráficos rotulados para 375 px.
- ~~Alta de producto~~ ✅ nombre y precio; el resto en «Más opciones».
- **Además**: el cliente tiene barra de pestañas fija (Carta · Mi pedido ·
  Pagar) con el importe a la vista, y seguimiento de cómo va lo suyo.
- **Recibo del cliente (v0.50.0)**: al cerrar la mesa ya no sale solo «gracias»,
  sale el detalle de lo que ha pagado y se lo puede **descargar** (fichero
  independiente, se abre sin conexión) o imprimir/guardar como PDF. La foto del
  consumo se guarda en su móvil ANTES de que la mesa se libere.
  ⚠️ Es la **copia del cliente**, no la factura simplificada: esa la emite el
  local con Veri*Factu, y así se dice en el propio recibo.

### Lo siguiente que yo miraría (sin medir aún)
- **Repetir para toda la mesa desde el cliente** («lo mismo para todos»).
- **Aviso al cliente cuando su plato está listo** sin tener que mirar la app
  (hoy solo se ve el punto verde al abrirla).
- **Buscar en tickets/caja** igual que en la carta.
