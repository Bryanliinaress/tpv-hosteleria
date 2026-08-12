# Punto de partida para la siguiente sesión

**Estado: v0.85.0 · 460 tests en verde · repo limpio y desplegado.**
Última sesión: 2026-08-11. Roadmap: [PRODUCCION.md](PRODUCCION.md) ·
Historia de los 71 fallos encontrados: [docs/AUDITORIA.md](docs/AUDITORIA.md).

---

## ⭐ EMPIEZA POR AQUÍ

### 1. Levantar la impresión (muere al cerrar la sesión anterior)

Las dos térmicas están montadas y funcionando, pero el servicio que las
alimenta **no arranca solo todavía**:

```bash
node scripts/impresion-automatica.mjs
```

Con eso, cada pedido que entre sale en papel: comida por 🍳 `TPV-Cocina` y
bebida por 🍺 `TPV-Barra`. **Sin navegador de por medio.** Si el PC estuvo
apagado, al arrancar saca lo que quedó pendiente y no repite lo ya impreso.

> **Pendiente concreto**: dejarlo como **tarea programada de Windows** para que
> arranque al encender el PC. Es lo único que separa el montaje actual de uno
> de verdad.

### 2. Lo que queda por comprobar EN PAPEL

Nadie lo ha mirado aún con las impresoras delante:

- ¿**cortan** el papel? (si no, quitar `GS V` para que no salga basura)
- ¿los **acentos** salen bien? («Salchichón», «Café», «Menú del día»)
- ⚠️ **el QR del ticket de cuenta**: es el único riesgo que sigue sin
  descartar. Si el ticket sale bien **pero sin QR**, la impresora no
  implementa el QR nativo (`GS ( k`) y hay que mandarlo como imagen.

### 3. Cerrar el pago con tarjeta

Stripe ya está configurado en Casa Loli (claves y webhook, verificado desde
fuera: responde `400 · firma inválida` a un aviso sin firmar, que es lo
correcto). Falta:

- **probar un cobro real** con la tarjeta de test `4242 4242 4242 4242` y
  comprobar tres cosas: que la parte se marca pagada, que sale el ticket, y
  que en Admin → Caja aparece como **📱 Pago online** (no como efectivo);
- **pasar a producción**: con `sk_live_` hay que **rehacer el webhook**, porque
  el secreto de test no vale. Mismo comando:
  `node scripts/configurar-stripe.mjs casa-loli`.

---

## Cómo está montado el bar hoy

| Pieza | Estado |
|---|---|
| 🍳 `TPV-Cocina` | cola de Windows en **USB001** · comandas de comida |
| 🍺 `TPV-Barra` | cola de Windows en **USB002** · comandas de bebida |
| Servicio de impresión | `scripts/impresion-automatica.mjs` (escucha la BBDD) |
| Puente HTTP | `scripts/puente-impresion.mjs` (si la app pide imprimir un ticket) |
| Configuración | `.env.puente` — **fuera del repo**, lleva la clave de servicio |

**Sin drivers del fabricante**: se usa el «Generic / Text Only» de Windows y se
mandan los bytes en **RAW** (`scripts/imprimir-raw.ps1`). El driver del disco
convertiría el ESC/POS en texto y saldría basura. Compartir la impresora, que
era lo documentado antes, **exige ser administrador**; así no.

⚠️ Las dos impresoras son el mismo modelo: Windows las distingue **por el
puerto**, que asigna según el orden de conexión. Están etiquetadas; si algún
día se reconectan en otro orden, pueden intercambiarse.

## Los dos entornos (ojo, se confunden)

| | URL | Qué es |
|---|---|---|
| **Demo** | `bryanliinaress.github.io/tpv-hosteleria/` | datos de juguete, proyecto Supabase viejo |
| **Casa Loli** | `bryanliinaress.github.io/tpv-hosteleria/app/` | **el bar de verdad**, proyecto `tesilntyomnovjcuieho` |

Desde la v0.84.0 la demo lleva **banda naranja en todas las pantallas** y la
pestaña dice `DEMO · …`. Casa Loli no lleva nada y su pestaña pone su nombre.
Pasó de verdad: se hacían pedidos en la demo esperando que salieran por la
impresora del bar.

Al abrir, **Ctrl+Shift+R**: es una PWA y el service worker sirve la versión
vieja hasta que avisa (cada 30 min).

## Cómo probar sin ensuciar nada

`npm run dev -- --mode pruebas` levanta la app **sin backend**: todo a
localStorage, sin tocar la demo compartida ni el bar.
Para ver un local concreto: `LOCAL=casa-loli npm run dev`.

## Si algo no conecta

⚠️ **El plan gratuito de Supabase pausa el proyecto tras ~1 semana sin
actividad.** Síntoma: el subdominio no resuelve y todo da «Failed to fetch».
No es el código: entra al dashboard y pulsa **Resume project**. Ya pasó (18
días parados). Por eso **Supabase Pro es requisito de producción**.

---

## Qué está hecho y verificado de verdad

- **Backend multi-tenant**: 13 migraciones aplicadas, RLS por local, RPC
  transaccionales. Las 10-13 se aplicaron el 11/08 contra la BBDD real.
- **Suplementos**: comprobado en vivo con la carta de Casa Loli — sin gluten
  +1,20 €, queso+huevo +0,40 €. Antes se regalaban.
- **Privacidad**: `anon` ya no puede leer el nombre ni el teléfono de las
  reservas (solo `id, numero, zona, capacidad, estado, unida_a`).
- **Fiscal Veri*Factu**: ticket registrado en la AEAT de pruebas con su UUID.
  Edge Function desplegada (v3) con el arreglo de reintentos y autorización.
- **Pagos**: `crear-checkout` y `stripe-webhook` desplegadas; el importe lo
  calcula **el servidor**, nunca el navegador.
- **Impresión**: dos impresoras por destino, automática y sin navegador.
- **Cola offline**, menú del día desde la PDA, grupos de mesas, arqueo con
  propinas en efectivo, carta e interfaz **en inglés** (incluidos los platos).
- **460 tests**, lint limpio, CI y deploy en verde.

## Pendiente — y de quién depende

### De Bryan
1. **Probar el cobro con tarjeta** de punta a punta (arriba, punto 3).
2. **Comprobar el papel** (corte, acentos, QR).
3. **NIF real en Verifacti** y pasar a producción: solo cambia el secreto
   `VERIFACTI_API_KEY` (`vf_test_…` → `vf_prod_…`), la URL es la misma.
4. **Probar el alta de un bar nuevo** en `/app/` (necesita login con
   contraseña, no puedo hacerlo yo). El fallo 39 dejaba el local **sin mesas**;
   está arreglado y con tests, pero conviene verlo una vez.

### Bloqueos antes de facturar de verdad
1. **Facturas rectificativas (R1-R5)**: si un ticket registrado en la AEAT
   necesita devolución, hoy no hay salida. En un bar pasa: se cobra de más y el
   cliente reclama al día siguiente.
2. **Declaración responsable del fabricante**: obligación de Bryan desde el
   29-7-2025 por comercializar software de facturación. No es código.

### ⏳ Esperando a que apliques la migración 14
La rama **`feature/v2-al-nivel-de-v1`** cierra los huecos de v2 contra la demo
(compartir plato, retención de reservas, resetDatos) y trae
`supabase/migrations/20260812T14_compartir_plato.sql`.

**No está mergeada a propósito**: sin aplicar la migración, el botón de
compartir llamaría a un RPC que no existe. Para cerrarlo:

```bash
SUPABASE_ACCESS_TOKEN=sbp_… node scripts/aplicar-migracion.mjs 14
```

…y después merge a `main` + deploy. Revoca el token al terminar.

### De código (sin depender de nadie)
2. **La cola offline puede duplicar un producto**: si la petición llega pero se
   pierde la respuesta, al reintentar suma otra unidad. Se arregla con una clave
   de idempotencia (el id de la operación en cola ya vale).
3. **Dominio propio para cada bar** — separa de verdad la demo del local, mejor
   que cualquier aviso.
4. Informes más ricos (por producto/camarero/hora), backups y monitorización.
5. **Actualizar N instancias** de una vez: con un bar por instalación, sin esto
   cada mejora hay que desplegarla a mano en cada uno.

## El modelo: un bar, una instalación

Cada bar tendrá **su proyecto Supabase, su despliegue, su dominio y su marca**.
No es un SaaS compartido. Lo que evita acabar con ocho copias divergentes:
**un repo con el producto + un perfil por bar** (`locales/<slug>/perfil.json`),
con módulos opcionales por local. Nunca copiar el repo.

Coste a tener en cuenta: **Supabase Pro ~23 €/mes por bar**. Con 10 bares son
~230 €/mes; cobrando 25-40 €/bar el margen baja del ~95% al ~30-40%. Sigue
saliendo, pero conviene fijar el precio sabiéndolo.

## Detalles que ahorran tiempo

- **Credenciales**: no puedo teclear contraseñas ni manejar claves que muevan
  dinero (la `sk_` de Stripe). Los tokens `sbp_` se usan y **se revocan**.
- **Migraciones**: Management API
  (`POST https://api.supabase.com/v1/projects/<ref>/database/query`). Sin Docker.
  Ojo: **Cloudflare bloquea al cliente de Python**; con `curl` pasa.
- **Edge Functions**: `npx supabase functions deploy <nombre> --project-ref <ref>`
  (con `--no-verify-jwt` para el webhook de Stripe). Tampoco necesita Docker.
- **Calendario Veri*Factu** (RDL 15/2025): sociedades **1-1-2027**, autónomos
  **1-7-2027**. No se vende como «o multa», se vende como «ya resuelto». Al
  **fabricante** sí le aplica desde el 29-7-2025.
- **Gotcha de Verifacti**: en factura simplificada (F2) **no** se envían
  `nif`/`nombre`: son del destinatario y la AEAT lo rechaza.
- **Gotcha de supabase-js**: no lanza excepción en fallos de red, los devuelve
  en `error`.
- **Apagar `npm run dev` antes de pruebas largas**: si queda vivo, reenvía su
  estado y ensucia la demo compartida.
- **Dónde mirar cuando algo «no funciona»**: los logs de la app real se
  consultan con la Management API
  (`/v1/projects/<ref>/analytics/endpoints/logs.all?sql=…`). Ahí se ve si la
  petición llegó siquiera al servidor — resolvió dos falsos misterios.

## Cómo se buscan fallos aquí (lo que funciona)

La veta más rica es la **divergencia demo (v1) ↔ app real (v2)**: la demo se usa
a diario y la app real casi no, así que los fallos se esconden ahí. Patrones que
han aparecido una y otra vez:

- **acciones del store que v2 no parchea** → hacen `setState` y la
  rehidratación las deshace sin error;
- **el mismo dato con otra forma** a cada lado (`precios:{base}` vs `precio`,
  `sup` vs `suplemento`, `{mesas}` vs `{n}`);
- **respuestas que la pantalla usa sin esperarlas** (`async` donde se lee
  `r.ok` en el acto) → hay un test que lee el código y lo impide;
- **listas escritas a mano** que se quedan cortas al aparecer un valor nuevo;
- **reglas escritas dos veces**: cuando pasa, una de las dos no funciona.
