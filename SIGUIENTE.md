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
- **Stripe Connect**: que cada bar cobre en **su** cuenta (hoy iría a una sola).
  Es lo que falta para vender el pago online como SaaS. Ver [docs/PAGOS.md](docs/PAGOS.md).
- Informes más ricos (por producto/camarero/hora), backups y monitorización.
- Reservas por franja con auto-asignación de mesa.

## Lo más valioso ahora (opinión)

No es más código: es **poner esto en un bar real una tarde**, aunque sea de un
amigo. Un servicio de verdad dirá en dos horas qué chirría, y eso vale más que
cualquier lista de tareas. Lo único que hace falta antes es la impresora.

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
