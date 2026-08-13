# Punto de partida para la siguiente sesión

**Estado: v0.89.0 · 478 tests en verde · repo limpio y desplegado.**
Última sesión: 2026-08-12. Roadmap: [PRODUCCION.md](PRODUCCION.md) ·
Historia de los 71 fallos encontrados: [docs/AUDITORIA.md](docs/AUDITORIA.md).

---

## ⭐ EMPIEZA POR AQUÍ

### 1. La impresión ya arranca sola

Está instalada como **tarea de Windows** y se levanta 20 s después de iniciar
sesión. No hay que hacer nada al empezar el día.

```powershell
powershell -ExecutionPolicy Bypass -File scripts\instalar-impresion.ps1 -Estado
```

Dice si la tarea está, si el proceso vive y las últimas líneas del log. Cada
pedido sale en papel: comida por 🍳 `TPV-Cocina` y bebida por 🍺 `TPV-Barra`,
**sin navegador**. Si el PC estuvo apagado, al arrancar saca lo pendiente sin
repetir lo ya impreso.

**Al montar un bar nuevo**, una sola vez:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\instalar-impresion.ps1
```

No pide administrador a propósito: es una tarea del usuario del TPV, que
arranca al iniciar sesión. Corre oculta (`scripts\impresion-oculta.vbs`) para
no dejar una consola negra en la pantalla del bar, y todo va a
`logs\impresion.log` — que se lee con `Get-Content … -Encoding UTF8`, o los
acentos salen como basura. Si el proceso se cae, Windows lo reintenta 3 veces.

Se quita con `-Quitar`.

### 2. Lo que queda por comprobar EN PAPEL

Nadie lo ha mirado aún con las impresoras delante:

- ¿**cortan** el papel? (si no, quitar `GS V` para que no salga basura)
- ¿los **acentos** salen bien? («Salchichón», «Café», «Menú del día»)
- ⚠️ **el QR del ticket de cuenta**: es el único riesgo que sigue sin
  descartar. Si el ticket sale bien **pero sin QR**, la impresora no
  implementa el QR nativo (`GS ( k`) y hay que mandarlo como imagen.

### 3. Pago con tarjeta — HECHO y verificado

Cobro de punta a punta funcionando (12/08): 3 pagos reales entrados, 3 tickets
con desglose `{"online": …}` —no efectivo— y las mesas cerradas solas.

El fallo era que el webhook moría SIEMPRE: los metadatos de Stripe son texto,
así que `localId` llegaba como `""` y `?? null` no lo convierte. A un parámetro
`uuid` le entraba una cadena vacía. Encima `String(e)` lo tapaba con
«[object Object]» en el panel de Stripe.

Queda solo **pasar a producción**: con `sk_live_` hay que **rehacer el
webhook**, porque el endpoint de producción es otro y su secreto de firma
también. Mismo comando: `node scripts/configurar-stripe.mjs marchando`.

---

## Cómo se conecta un aparato (no hay contraseñas)

Nadie se registra y no hay credenciales que custodiar. El aparato pide permiso
y el encargado se lo da.

1. Abres el TPV en el aparato: enseña un **código de 6 dígitos** y espera.
2. El encargado lo autoriza en **Admin → Dispositivos** (le pide su PIN).
3. El aparato entra solo. **Para siempre**, y se le puede quitar cuando sea.

**El primero de todos** no puede autorizarlo nadie —para entrar al panel hay
que estar autorizado— así que lo hace quien monta el bar, que ya tiene la
llave (`.env.puente`):

```bash
node scripts/autorizar-dispositivo.mjs             # lista solicitudes
node scripts/autorizar-dispositivo.mjs 408563 "PC" # autoriza
node scripts/autorizar-dispositivo.mjs --revocar <id>
```

Es también la salida de emergencia si se revocan todos y nadie puede entrar.

Cada aparato tiene **su propia cuenta** (la crea el servidor al autorizarlo):
por eso revocar uno no echa a los demás, y al revocarlo se borra su cuenta —si
solo cambiara el estado, la sesión que ya tiene seguiría valiendo.

El **PIN** sigue siendo quien identifica a la persona, y con dispositivos pesa
más: es lo que autoriza a otros aparatos. Por eso se bloquea 5 minutos tras
**5 fallos seguidos**, contados por dispositivo (por local dejaría al bar sin
cobrar por culpa de una tablet).

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

## Un solo enlace: Marchando

```
https://bryanliinaress.github.io/tpv-hosteleria/
```

Es el producto: build **v2** (multi-tenant con RLS, Verifactu, Stripe,
impresión) sobre el proyecto `tesilntyomnovjcuieho`, con marca **Marchando** y
banda de demostración. Es el que se enseña para vender.

**No hay ningún bar real.** «Casa Loli» era un nombre de ejemplo; se renombró a
Marchando el 12/08, también en la BBDD (`locales.nombre` y `slug`).

### Por qué hubo dos enlaces (y por qué ya no)

El 15/07, en la v0.35.0, se montó un **doble build** a propósito: la demo v1
(blob) siguió en la raíz y el backend v2 nuevo se publicó aparte en `/app/`
para no romper lo que se usaba a diario. Era lo correcto durante la migración
— pero **la migración nunca se cerró**. Tres semanas después seguía habiendo
dos, y el v2, que era el producto, no lo usaba nadie. Ahí se escondieron los 71
fallos de la auditoría, las tres acciones sin implementar y un webhook que
llevaba desde el primer día sin funcionar.

El 12/08 se cerró: `marchando` es el único publicado. La demo v1 se queda en
`locales/demo/` con `publicado: false` — fuera del deploy, resucitable en un
comando si algo falla delante de un cliente:

```bash
npm run locales build demo     # → dist-demo-v1/
```

Al abrir, **Ctrl+Shift+R**: es una PWA y el service worker sirve la versión
vieja hasta que avisa (cada 30 min).

## Cómo probar sin ensuciar nada

`npm run dev -- --mode pruebas` levanta la app **sin backend**: todo a
localStorage, sin tocar la demo compartida ni el bar.
Para ver un local concreto: `LOCAL=marchando npm run dev`.

## Si algo no conecta

⚠️ **El plan gratuito de Supabase pausa el proyecto tras ~1 semana sin
actividad.** Síntoma: el subdominio no resuelve y todo da «Failed to fetch».
No es el código: entra al dashboard y pulsa **Resume project**. Ya pasó (18
días parados). Por eso **Supabase Pro es requisito de producción**.

---

## Qué está hecho y verificado de verdad

- **Backend multi-tenant**: 16 migraciones aplicadas, RLS por local, RPC
  transaccionales. Las 10-13 se aplicaron el 11/08 contra la BBDD real; las
  14-16, el 12/08.
- **⚠️ Los `grant` no bastan: hay que MIRAR los permisos en la BBDD.** Supabase
  tiene `alter default privileges` que conceden EXECUTE a `anon` y
  `authenticated` **en cuanto se crea una función**. Ha mordido dos veces:
  `_debe_por_comensal` (fuga: lo que debe cada comensal de cualquier mesa) y
  `registrar_pago_online` (grave: cerrar la cuenta **sin pagar**). Su migración
  ya decía «no se concede a anon» y aun así estaba concedida. Al crear una
  función de servidor, `revoke … from public, anon, authenticated` y
  comprobarlo con `has_function_privilege`.
- **El cliente del QR no lee las tablas**: todo le llega por `estado_mesa`. Si
  esa función se deja una columna, esa pantalla —y solo esa— se queda sin ella.
  Pasó con `compartido_con`, `elecciones`, `propina` y `metodo_pago`. Hay un
  test que lee el SQL y lo impide.
- **Quién cierra la mesa depende del backend**: en la demo lo apunta el
  navegador; en v2 lo hace el **webhook** de Stripe. Llamar a `pagarParte`
  desde el cliente en v2 daba «permiso denegado» y la mesa se quedaba abierta
  después de cobrar.
- **Compartir plato en la app real** (era el fallo 27): RPC `qr_compartir_linea`
  y, lo que faltaba de verdad, el **reparto del dinero en el servidor**
  (`_debe_por_comensal`), que ahora usan `pendiente_de_pago` (lo que cobra
  Stripe) y `pagar_parte` (el arqueo). Probado contra la BBDD real con
  `rollback`: paella de 20 € a tres → 6,67 / 6,66 / 6,67, **suman 22,50 exactos**;
  al quitar a uno, el reparto se recalcula. Con esto **v2 ya no deja ninguna
  acción de la demo sin implementar** (eran 3 de 65) y hay un test que lo vigila.
- **Suplementos**: comprobado en vivo con la carta de ejemplo — sin gluten
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
- **473 tests**, lint limpio, CI y deploy en verde.

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
