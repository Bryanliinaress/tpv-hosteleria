# Punto de partida para la siguiente sesión

**Estado: v0.44.0, todo desplegado, repo limpio y sincronizado.**
Última sesión: 2026-08-04. Fuente de verdad del roadmap: [PRODUCCION.md](PRODUCCION.md).

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

**98 tests**, lint limpio, CI y deploy en verde.

## Pendiente — y de quién depende

### De Bryan (sin esto no se avanza)
1. **Aplicar la migración 10** (`20260804T10_pagos_online.sql`): hace falta un
   token nuevo de Supabase. Es 1 minuto.
2. **Impresora térmica 80 mm** (~60-100 €) para probar ESC/POS de verdad.
3. **Cuenta de Stripe** real (+ activar Bizum) para el pago por QR.
4. **NIF real en Verifacti** y pasar a su entorno de producción, cuando haya
   un local de verdad.
5. **Probar el alta de un bar nuevo end-to-end** en `/app/`: yo no puedo
   autenticarme con contraseñas, así que ese login lo tiene que hacer él.

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
1. **Perfiles de local**: `locales/<slug>/` con marca (logo, colores, nombre),
   dominio y claves. Build parametrizado: `LOCAL=bar-manolo npm run build`.
2. **Alta industrializada**: un solo comando que cree el proyecto Supabase,
   aplique las 10 migraciones, siembre la carta, registre el local y despliegue.
   Base ya existente: `scripts/provisionar-produccion.mjs`.
3. **Marca blanca**: que el logo y los colores del bar salgan en la carta QR,
   el ticket y la PWA.
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
- **Gotcha de Verifacti**: en factura simplificada (F2) **no** se envían
  `nif`/`nombre` — son del destinatario y la AEAT lo rechaza.
- **Gotcha de supabase-js**: no lanza excepción en fallos de red, los devuelve
  en `error`. Ojo al tratar reintentos.
- **Apagar el `npm run dev` antes de pruebas largas**: si queda vivo y vuelve
  la conexión, reenvía su estado al blob compartido y ensucia la demo.
