# Punto de partida para la siguiente sesión

**Estado: v0.96.0 · 565 tests JS + 31 pruebas de SQL en verde · repo limpio y desplegado.**
Última sesión: 2026-08-19. Roadmap: [PRODUCCION.md](PRODUCCION.md) ·
Historia de los 71 fallos encontrados: [docs/AUDITORIA.md](docs/AUDITORIA.md).

---

## 🩺 Revisión de arquitectura (19/08) — lo arreglado y lo que queda

Repaso completo de `src`, el SQL, las Edge Functions, los scripts y el CI.
**Seis fallos reales**, todos demostrados contra la base de datos antes de
tocar nada, y todos ya arreglados:

1. **La numeración fiscal se pisaba.** El trigger hacía `max(numero)+1` sin
   bloquear. Con 12 cobros en paralelo fallaban **2**: `duplicate key ...
   tickets_local_id_numero_key`. Ahora hay un contador por local en su propia
   tabla (RLS sin políticas, como `intentos_pin`): 12 de 12 y sin huecos.
2. **El historial se bajaba entero** —todos los tickets con su `detalle`— en
   cada arranque y **cada vez que la tablet vuelve del segundo plano**. A 100
   tickets/día son decenas de MB por despertar y por aparato. Ahora va por
   ventana (mes anterior, estirada hasta el último cierre de caja).
3. **La sesión de PIN no caducaba nunca.** El encargado dejaba la tablet en la
   barra y quien la cogiera tenía Admin. Ahora caduca por inactividad: 5 min
   admin, 12 h camarero (al camarero no se le puede pedir el PIN cada diez
   minutos: acabaría poniéndose 0000). El plazo sale del **padrón**, no del
   dispositivo, o bastaba escribirse `rol: camarero` para durar 12 h.
4. **Un fallo de render dejaba la tablet en blanco.** No había `ErrorBoundary`.
   Ahora hay pantalla con Recargar / Volver al inicio, y distingue el caso de
   «trozo de la app que no llega» (pestaña vieja tras un despliegue).
5. **El papel imprimía mal el IVA.** El desglose estaba escrito **cuatro
   veces** y `escpos.js` no redondeaba la base: al 4 % (pan, leche) imprimía
   «base + IVA» un céntimo por encima del total en 3.976 importes de 199.951.
   Todo pasa ya por `src/lib/dinero.js` (también los 13 sitios que calculaban
   el total de un comensal).
6. **La cola offline duplicaba productos** cuando la petición llegaba y se
   perdía la respuesta. Clave de idempotencia desde el primer intento:
   probado, 3 reenvíos sin clave = 3 unidades, con clave = 1.

Y **Admin → Caja avisa de los cobros sin cuenta** (4 en la demo, 13,25 €):
dinero cobrado que no está en ningún ticket y hay que devolver por Stripe.

### Lo que quedaba pendiente — ya está TODO hecho (24/08)

1. **Tests del SQL del dinero** → `npm run test:sql`, 15 pruebas contra la base
   de verdad y sin dejar rastro (cada una en una transacción que se deshace, y
   el runner compara una foto de antes y después). Comprobado que SIRVEN:
   metiendo a propósito el reparto ingenuo, canta «esperaba 20.00, obtuve
   20.01».
2. **Registro de migraciones** → `npm run migraciones -- --estado` dice en qué
   esquema está un proyecto sin tocar nada; `--todas` aplica solo lo que falta.
   Guarda la huella del contenido: una migración editada DESPUÉS de aplicarse
   sale como «cambiada», que es un bar cuyo esquema ya no es el del repo.
3. **Monitorización** → el bar deja constancia de lo que se rompe en su propia
   base (nada sale a servicios de terceros) y `npm run salud` responde «cómo
   está este bar». Se pagó sola: encontró que **editar un producto con tamaños
   guardaba los precios como texto y reventaba la carta del cliente**.
4. **IVA por producto** → `productos.iva_pct`, congelado en la línea al pedir, y
   desglose por tipo en pantalla, papel, recibo y AEAT.
5. **Fichajes por mes** → se pide el mes que se mira, con margen de un día a
   cada lado (un turno de madrugada del día 1 se guarda en UTC como el último
   día del mes anterior).
6. **Segundo bar publicable** → probado compilando dos a la vez; hay tests que
   impiden los fallos silenciosos (un bar fuera de `dist` no se sube y nadie se
   entera). Ver `locales/README.md`.
7. **Tope a `solicitar_dispositivo`** → 20 esperando y 5 por minuto, por local.
8. **`npm audit` limpio** → react-router-dom 7.18.2.

### Comandos nuevos

```bash
npm run salud                      # ¿cómo está este bar?
npm run migraciones -- --estado    # ¿en qué esquema está?
npm run test:sql                   # el dinero, contra la base real
PROJECT_REF=<otro> npm run salud   # cualquier otro bar
```

### Devoluciones (rectificativas) — HECHO (24/08)

Era el bloqueo fiscal de verdad y ya está cerrado, de punta a punta y
**probado contra la AEAT de pruebas**: la devolución de 4,00 € del ticket nº 6
salió con UUID `50eccb10-…`, su QR y su URL de verificación en `prewww2.aeat.es`.

Cómo funciona, y por qué así:

- **Siempre R5.** El original es una factura simplificada (F2), así que su
  rectificativa es R5 sea cual sea el motivo; R1-R4 son para facturas completas.
- **Por diferencias, no por sustitución.** Las dos son válidas. Se eligió «I»
  porque en un bar la devolución es dinero que sale del cajón: así la caja, los
  informes y lo que consta en Hacienda dicen **el mismo número**. Por
  sustitución el documento diría «esto eran 8 € y no 11 €» y el movimiento del
  cajón habría que deducirlo, que es como se descuadra un arqueo.
- **Una rectificativa es un ticket más**, negativo y apuntando al que corrige.
  Entra sola por donde ya pasa todo: se numera con el mismo contador (serie
  correlativa y sin huecos, que es lo que pide Verifactu), se registra en la
  AEAT por la misma vía con sus reintentos, resta en el arqueo y sale en los
  informes. Nada de un circuito paralelo.
- **El original NO se toca nunca**: es un documento ya emitido.
- Devolución **entera o parcial**; la parcial se reparte entre los tipos de IVA
  en proporción y con los céntimos cuadrados. No se puede devolver dos veces lo
  mismo (el servidor bloquea el ticket), ni más de lo pendiente, ni sin motivo,
  ni una rectificativa, ni el ticket de otro local. Las siete cosas, con test.
- Se usa desde **Admin → Tickets → ↩ Devolver**. El motivo es obligatorio
  porque va al registro fiscal, y el método importa: en efectivo sale del cajón
  y el arqueo de la noche lo cuenta.

Queda apuntado en la auditoría de anulaciones, que es donde el encargado ya
mira cuando algo no cuadra.

### Informes — rehechos en el servidor (24/08)

Ya tenían producto, camarero y hora, pero se calculaban **en el navegador**
sobre el historial descargado, y eso traía dos cosas:

- **Solo se veía el mes en curso** —y desde que el historial va por ventana, ni
  eso: el día 1 de mes la pantalla salía vacía—.
- **Las devoluciones los ensuciaban.** Una rectificativa es un ticket con líneas
  sintéticas, así que aparecía en el ranking como un producto llamado
  «Devolución (IVA 10%)», sumaba un comensal que nunca existió y contaba como
  ticket hundiendo el medio. Fallo introducido al añadir las rectificativas.

Ahora los calcula el servidor (`informe_ventas`, por rango de fechas), así que
valen para **cualquier periodo** sin depender de lo que el aparato tenga bajado.
Selector de Hoy / Ayer / 7 días / Este mes / Mes pasado, y **CSV** con `;` y BOM
(Excel en español lo abre bien; con comas mete todo en una columna).

Tres cosas que se arreglaron por el camino:

- **Las devoluciones restan y se enseñan aparte** («↩ 2 devoluciones · −14,40 €
  · vendido 253,10 € antes de devolver»), y no salen en ningún ranking.
- **La hora, en la zona del local** (`config.zonaHoraria`, Europe/Madrid por
  defecto). Agrupar en UTC daba las horas punta desplazadas dos horas en verano
  — y con eso se contrata personal para la hora equivocada.
- **Quién atendió y quién cobró son cosas distintas** y ya no se mezclan: en un
  bar cobra quien está en la caja, no quien sirvió la mesa.

Para enseñarlo: `scripts/sembrar-ventas.sql` crea un día de servicio creíble
(desayunos, comidas, cenas, dos camareros y una devolución) y
`scripts/limpiar-ventas-ejemplo.sql` lo quita. **Solo para la demo**: en un bar
de verdad inventaría ventas en su contabilidad.

### Pendiente

1. **Declaración responsable del fabricante** — obligación tuya, no es código.
2. **Los tres de siempre de Bryan**: teléfono y dirección del local, Supabase
   Pro, y la prueba del papel (corte, acentos, QR).
3. **Backups** (vienen con Supabase Pro).
4. **KDS y Barra en tableta** — no vueltos a mirar desde los últimos cambios.
5. **Mostrador**: la rejilla pierde el cuadre al abrir el panel lateral.

### Lo que se revisó y está BIEN

RLS activo en las 17 tablas (`intentos_pin` con deny-all). `npm run permisos`
limpio. El webhook de Stripe verifica firma, calcula el importe en el servidor
y es idempotente. `crear-checkout` valida el retorno contra el `Origin`. Los
dispositivos usan secreto de 256 bits con bcrypt y cuenta propia por aparato.
Los secretos están fuera del repo. Y `contrato.test.js` —el test que impide
que una acción del store se quede sin implementar en v2— es de lo mejor que
hay aquí.

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

### 2. El papel — APLAZADO a propósito (13/08)

No es que se haya olvidado: Bryan decidió dejarlo para más adelante. **No lo
retomes por tu cuenta**, pregúntale antes. Cuando toque, hay que mirarlo con
las impresoras delante:

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

## 🎨 Estética y facilidad de uso — en curso

Encargo abierto de Bryan: que **un cliente que nunca ha visto esto sepa pedir a
la primera**, y que la PDA y el resto de pantallas sean fáciles e intuitivas.

### Cómo se hace esto (leer antes de tocar)

1. **Mirando la pantalla, y en móvil** (`resize_window` → `mobile`, 375 px).
   Es donde se usa. Para el KDS, `tablet`: una cocina no usa un teléfono.
2. **Comprueba qué bundle corre.** El service worker sirve el anterior y ya me
   hizo dar por bueno un arreglo que no estaba cargado: `curl` a la página y
   comparar con el `<script src>` de la pestaña.
3. **Nada de diagnosticar leyendo `innerText`.** Así me inventé tres fallos que
   no existían (la hoja de unirse sí es un panel fijo, la carta sí carga, la PDA
   sí ocupa el ancho). Si no hay panel de navegador, **pídelo**.
4. Los tests: `npm test 2>&1 | grep -E "Test Files|Tests |FAIL"`. Con `tail -3`
   se oculta el resultado y ya subí una vez con CI en rojo.

### Arreglado (todo verificado en pantalla)

- La carta ya no dice «No hay nada» al escanear el QR (bandera `hidratado`).
- **Frase de bienvenida** que explica cómo funciona, solo hasta que se une.
- El aviso de «versión nueva» ya no tapa el nombre del bar, y no se le enseña
  al cliente: es del personal.
- Fuera el punto suelto tras el precio: era un alérgeno nulo, en 18 de 58
  productos (venía de `array[null]` en el script de siembra).
- Tocar una categoría mientras carga ya no la deja vacía.
- Tras unirse y pedir, las pestañas aparecen al instante (antes hasta 4 s sin
  poder llegar a «Mi pedido» ni a «Pagar»).
- La banda de demostración ya cabe en una línea en móvil.
- PDA: «1 comensal» (concordancia) y arranca en **Mesas**, no en Avisos.
- Barra: «4 bebidas» en vez de «4 platos».
- Reservas: «Llámanos» ahora marca el teléfono de un toque, si está puesto.
- **Pagar (cliente)**: tu tarjeta va primero y con borde de acento —llegando
  el segundo, el primer botón grande de la pantalla era «pagar lo de otro»—;
  cada botón dice cuánto cobra; la propina, en euros además de en porcentaje;
  «Pagar toda la cuenta» solo si queda más de uno por pagar, y nunca a la vez
  que estás pagando tu parte; «Total mesa» solo cuando dice algo distinto de
  «Pendiente de pago»; y quien se une sin pedir ya no ve «Pagar mi parte ·
  0.00 €», que abría la pasarela por cero euros.
- **Mostrador**: «Cerrar mesa sin cobrar» ahora confirma, en rojo y diciendo
  cuánto se queda sin cobrar. Se iba de un toque con la cuenta encima.
- **Admin → Carta**: el precio va debajo del nombre y con el formato al lado
  («Viena 2.50 € · Pitufo 1.50 €»). Eran dos números sueltos, y el formato
  solo estaba en un `title` que en una tablet no se ve nunca.
- **Admin → Tickets**: los días salían desordenados (4/8, 13/8, 12/8) porque
  se agrupaba por «4/8/2026» y se ordenaba **como texto**. Y el aviso fiscal
  decía «4 tickets sin registrar» sin decir cuáles; ahora los lista.
- **Admin → Personal**: el hueco del PIN sale vacío siempre —en v2 el PIN se
  guarda cifrado y no vuelve al navegador— y no lo decía; parecía perdido.
- **Admin → Local**: avisa de qué dato falta y dónde se va a ver.
- **Admin → Mesas**: doce botones rojos «Borrar mesa» a ancho completo
  mandaban más que las mesas; ahora borrar es discreto, como en Carta.

### Revisado y BIEN — no tocar

Carta del cliente, hoja del nombre, hoja de personalización, «Mi pedido» y su
confirmación antes de enviar, «Enviar pedido» (destaca de sobra), rejilla de
mesas de la PDA, cola de cocina y barra, y el asistente de reservas.

### Revisado y BIEN — no tocar (Admin)

Reservas, Ajustes, Informes, QR Codes y Dispositivos. Fichajes está correcto,
solo que su «Sin fichajes este mes» es texto pelado mientras Reservas tiene
un vacío con icono; si se retoca, que sea por consistencia, no por fallo.

### Pendiente

1. **KDS y Barra en tableta** — dados por buenos, pero no vueltos a mirar
   desde los últimos cambios.
2. **Mostrador, el resto**: la rejilla de mesas pierde el cuadre al abrir el
   panel lateral (queda una mesa huérfana por zona). Cosmético, pero se ve.
3. **Admin → Tickets** marca cuáles faltan por registrar en el aviso, pero
   **no en la lista**: el ticket de la lista no lleva su estado fiscal porque
   la pantalla lo saca del store y el estado vive en la RPC. Si molesta, hay
   que juntar las dos fuentes.
4. **Dato**, no código: en Ajustes → Tipo de pan hay un «Con Gluten» junto a
   «Sin gluten +1.20 €». Suena a resto de la carta de ejemplo.

### Cómo se llegó a las pantallas de personal (ahorra media hora)

`npm run dev` **sin perfil** enseña la pantalla vieja de email+contraseña, no
el código de 6 dígitos: el flujo sin contraseñas depende del perfil del local.
Para revisar personal hay que **compilar con perfil y servir el bundle**:

```bash
LOCAL=marchando VITE_BASE=/ VITE_PAGOS_ONLINE=1 npm run build
cd dist && python -m http.server 5186
```

Y ojo con `LOCAL` en Windows: `set LOCAL=marchando && …` mete el espacio
dentro de la variable y vite muere con «No existe el local "marchando "».
Va `set "LOCAL=marchando"&& …`.

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
1. **Rellenar los datos del local** en Admin → Local: **faltan el teléfono y
   la dirección** (el CIF ya está puesto: B75777847). La pantalla ya avisa. Salen en el ticket, en el recibo del cliente y en la
   pantalla de reservas («Llámanos» sin número al que llamar). Un hostelero que
   ve un ticket sin dirección piensa que el software no lo contempla. No lo
   relleno yo: un número inventado en una página pública acaba haciendo que
   alguien llame a un desconocido.
2. **Supabase Pro (~23 €/mes)**. El plan gratuito **pausa el proyecto tras ~1
   semana sin actividad** y todo da «Failed to fetch». Ya pasó, 18 días parado.
   Enseñar la demo a un bar y que no cargue es el peor momento para descubrirlo.
3. **Comprobar el papel** (corte, acentos, QR) — aplazado a propósito.
4. **NIF real en Verifacti** y pasar a producción: solo cambia el secreto
   `VERIFACTI_API_KEY` (`vf_test_…` → `vf_prod_…`), la URL es la misma.
5. **Probar el alta de un bar nuevo** de punta a punta: aprovisionar el
   proyecto, autorizar el primer dispositivo desde el terminal y entrar. El
   fallo 39 dejaba el local **sin mesas**; está arreglado y con tests, pero
   conviene verlo una vez entero.

### Bloqueos antes de facturar de verdad
1. **Facturas rectificativas (R1-R5)**: si un ticket registrado en la AEAT
   necesita devolución, hoy no hay salida. En un bar pasa: se cobra de más y el
   cliente reclama al día siguiente.
2. **Declaración responsable del fabricante**: obligación de Bryan desde el
   29-7-2025 por comercializar software de facturación. No es código.

### De código (sin depender de nadie)
1. **Dominio propio para cada bar**.
2. Backups (vienen con Supabase Pro).
3. **Actualizar N instancias** de una vez: con un bar por instalación, sin esto
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
