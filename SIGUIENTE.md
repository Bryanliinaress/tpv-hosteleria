# Punto de partida para la siguiente sesión

**Estado: v0.100.0 · 665 tests JS + 37 pruebas de SQL en verde · CI y deploy en
verde · repo limpio.** Última sesión: 2026-08-26.

Roadmap: [PRODUCCION.md](PRODUCCION.md) · Los 71 fallos de la auditoría:
[docs/AUDITORIA.md](docs/AUDITORIA.md)

---

## ⭐ EMPIEZA POR AQUÍ

### 1. Comprueba que sigue todo en pie

```bash
npm run salud
```

Dice cómo está el bar en diez segundos: ventas, tickets sin registrar en
Hacienda, cobros sin cuenta, comandas atascadas, dispositivos con acceso y lo
que se haya roto en las pantallas. Si el proyecto no responde, casi seguro es
que **Supabase lo pausó por inactividad** (plan gratuito, ~1 semana): se
arregla entrando al panel y pulsando *Resume project*.

### 2. El repaso visual: hecho en la v0.99.1, y lo que quedó fuera

**Ya están vistas renderizadas** (móvil 375 px y tableta): portada, Reservar,
Onboarding, Informes, Tickets, el selector de IVA del producto, el diálogo de
Devolver (Todo y Una parte), el «devuelto X · quedan Y», el ticket con su
desglose de IVA y QR, las **dos** pantallas de error, Mostrador, KDS Cocina y
KDS Barra. Salieron cinco fallos, los cinco arreglados y desplegados.

**Lo que sigue sin verse, y por qué:**

1. **Los KDS con comandas dentro.** Están a cero y llenarlos exige mandar
   pedidos: eso escribe en la demo compartida y **saca papel de verdad** por las
   dos térmicas. Hay que parar la tarea de Windows antes, devolverla después y
   limpiar los pedidos. Un KDS vacío no prueba lo que hay que probar: el cuadre
   de las tarjetas de comanda.
2. **La PDA** y **la carta del cliente por QR**.
3. **La interacción táctil de todo.** En la sesión del repaso los clics y el
   scroll con ratón del panel se agotaban a los 30 s y hubo que navegar por JS,
   así que lo visto está mirado pero **no tocado**.

---

## Qué queda — una sola lista

### De Bryan (no es código)

1. **Declaración responsable del fabricante** — obligación desde el 29-7-2025
   por comercializar software de facturación. Es el único bloqueo legal que
   queda.
2. **Rellenar teléfono y dirección** en Admin → Local. El CIF ya está puesto
   (B75777847) y la pantalla avisa de lo que falta. Salen en el ticket, en el
   recibo del cliente y en «Llámanos» de reservas. No lo relleno yo: un número
   inventado en una página pública acaba haciendo que alguien llame a un
   desconocido.
3. **Supabase Pro (~23 €/mes)** — quita las pausas por inactividad y trae los
   backups. Enseñar la demo a un bar y que no cargue es el peor momento para
   descubrirlo.
4. **Comprobar el papel** (corte, acentos, QR) — aplazado a propósito.
5. **Pasar a producción**: NIF real en Verifacti (solo cambia el secreto
   `VERIFACTI_API_KEY`, de `vf_test_…` a `vf_prod_…`; la URL es la misma). Con
   Stripe en `sk_live_` hay que **rehacer el webhook** —otro endpoint y otro
   secreto de firma—: `node scripts/configurar-stripe.mjs marchando`.
6. **Probar el alta de un bar nuevo** de punta a punta una vez: aprovisionar el
   proyecto, autorizar el primer dispositivo desde el terminal y entrar.

### ⚠️ Aclarar con Verifacti antes de producción

Al reintentar un envío, Verifacti responde **«el campo `fecha_expedicion` debe
ser la fecha actual»**: un ticket solo se puede registrar **el día que se
emitió**. Los que fallen y no se reintenten ese mismo día no entran nunca (en
la demo hay cuatro así, del 12 y 13 de agosto).

La norma permite registrar fuera de plazo, así que puede ser una restricción de
su entorno de pruebas o de su API — pero **define qué pasa si la AEAT no
responde durante un día entero**. Mientras no esté claro: si `npm run salud`
dice «tickets sin registrar», hay que atenderlo **ese mismo día**.

### De pantalla

1. **Los KDS con carga, la PDA y la carta del QR** (arriba, punto 2).
2. **Probar tocando**, no solo mirando (arriba, punto 3).

### De código

1. **Tests de pantalla que faltan**: PDA (482 líneas) y Mostrador (543), que son
   las que usa el personal a diario; Reservar (360) y Onboarding (261).
2. **La cola offline en una caída de red real** — está probada la RPC, no el
   comportamiento con la conexión cayéndose de verdad.
3. **Realtime entre dispositivos**: sin cubrir.
4. **Admin → Tickets** marca en el aviso cuáles faltan por registrar, pero no en
   la lista: la pantalla saca el ticket del store y el estado fiscal vive en la
   RPC. Si molesta, hay que juntar las dos fuentes.
5. **Actualizar N instancias** de una vez: con un bar por instalación, cada
   mejora hay que desplegarla a cada uno.
6. **Dominio propio para cada bar.**

### Dato, no código

- En Ajustes → Tipo de pan hay un «Con Gluten» junto a «Sin gluten +1,20 €».
  Suena a resto de la carta de ejemplo, y sale en la hoja del cliente.
- En la demo, la rectificativa nº 7 quedó apuntada como efectivo cuando el
  original era online (dato anterior al arreglo). Se deja: un documento fiscal
  emitido no se reescribe.

---

## Comandos

```bash
npm test                           # 665 tests, pantallas incluidas
npm run test:sql                   # 37 pruebas del dinero, contra la base real
npm run lint
npm run permisos                   # ¿se ha abierto algo sin querer?
npm run migraciones -- --estado    # ¿en qué esquema está este bar?
npm run migraciones -- --todas     # aplica solo lo que falte
npm run salud                      # ¿cómo está este bar?
```

Los tres últimos aceptan `PROJECT_REF=<ref>` delante, para apuntar a otro bar.

**Los tests, con `grep`, nunca con `tail`:**
`npm test 2>&1 | grep -E "Test Files|Tests |FAIL"`. Con `tail -3` se oculta el
resultado y ya se subió una vez con CI en rojo.

---

## Cómo se trabaja aquí (leer antes de tocar)

1. **Mirando la pantalla, y en móvil** (`resize_window` → `mobile`, 375 px). Es
   donde se usa. Para el KDS, `tablet`: una cocina no usa un teléfono.
2. **Comprueba qué bundle corre.** El service worker sirve el anterior y ya hizo
   dar por bueno un arreglo que no estaba cargado: `curl` a la página y comparar
   con el `<script src>` de la pestaña.
3. **Nada de diagnosticar leyendo `innerText`.** Así se inventaron tres fallos
   que no existían (la hoja de unirse sí es un panel fijo, la carta sí carga, la
   PDA sí ocupa el ancho). Si no hay panel de navegador, **pídelo**.
4. **Si tocas `src/lib/` , usa la extensión `.js` en los imports.** El servicio
   de impresión importa de ahí y corre en **Node puro**: Vite resuelve
   `./dinero`, Node no. Un import sin extensión compila, pasa el lint y pasa los
   tests… y deja al bar sin imprimir. Hay un test que lo vigila
   (`scripts/lib/node-puro.test.mjs`).
5. **Si tocas SQL**: `npm run permisos` antes de darlo por bueno. Supabase
   concede EXECUTE a `anon` y `authenticated` **en cuanto se crea una función**,
   y eso ya ha mordido tres veces.
6. **Limpia lo que ensucies**: `scripts/limpiar-servicio.sql`, y revoca los
   dispositivos de prueba al terminar.
7. **La impresión está activa**: si envías un pedido de prueba **sale papel de
   verdad**. Párala antes y devuélvela después:

   ```powershell
   Disable-ScheduledTask -TaskName 'TPV Marchando - Impresion'
   Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
     Where-Object { $_.CommandLine -like '*impresion-automatica*' } |
     ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
   # y para devolverla:
   Enable-ScheduledTask -TaskName 'TPV Marchando - Impresion'
   Start-ScheduledTask  -TaskName 'TPV Marchando - Impresion'
   ```

   Limpia las comandas **antes** de reactivarla: al arrancar recupera lo
   pendiente, así que si no, las saca todas en papel.

8. **Un fallo de impresión ya se ve** (v0.100.0). Si una impresora no saca el
   trabajo, se cancela y queda anotado como incidencia `impresora`, que
   `npm run salud` enseña. Si `salud` dice que una impresora no imprime, es que
   no imprime: durante 16 días el sistema dijo lo contrario y no salió nada.

### Para ver las pantallas de personal (ahorra media hora)

`npm run dev` **sin perfil** enseña la pantalla vieja de email+contraseña, no el
código de 6 dígitos: el flujo sin contraseñas depende del perfil del local. Hay
que **compilar con perfil y servir el bundle**:

```bash
LOCAL=marchando VITE_BASE=/ VITE_PAGOS_ONLINE=1 npm run build
cd dist && python -m http.server 5186
```

Ojo con `LOCAL` en Windows: `set LOCAL=marchando && …` mete el espacio dentro de
la variable y vite muere con «No existe el local "marchando "». Va
`set "LOCAL=marchando"&& …`.

⚠️ **Y ojo con `VITE_BASE=/` en Git Bash**: convierte la barra en una ruta de
Windows y la build sale apuntando a `/Program Files/Git/assets/…`. La página
queda **en negro** y solo se ve en la consola, como cuatro 404. Delante va
`MSYS_NO_PATHCONV=1`:

```bash
MSYS_NO_PATHCONV=1 LOCAL=marchando VITE_BASE=/ VITE_PAGOS_ONLINE=1 npm run build
```

### Probar sin ensuciar nada

`npm run dev -- --mode pruebas` levanta la app **sin backend**: todo a
localStorage, sin tocar la demo compartida ni el bar.

Para **enseñar** los informes con datos delante de un cliente:
`scripts/sembrar-ventas.sql` crea un día de servicio creíble y
`scripts/limpiar-ventas-ejemplo.sql` lo quita. **Solo para la demo**: en un bar
de verdad inventaría ventas en su contabilidad.

---

## El papel — lo que ya se sabe y lo que falta (31/08)

**Del lado del software está comprobado**, volcando los bytes reales a una
impresora de fichero y decodificándolos:

- **Corte**: sale `GS V B` (corte parcial) al final del tique. ✔
- **Acentos**: se selecciona `ESC t 0x13` (PC858) y las tildes van codificadas
  para esa tabla — «JAMÓN» → `4a 41 4d **e0** 4e`, «BOTELLÍN» → `4c 4c **d6**
  4e`, que en PC858 son `Ó` e `Í`. ✔
- **QR**: se emiten los **cinco** `GS ( k` completos (modelo, tamaño,
  corrección, datos con la URL de la AEAT y orden de impresión). ✔

**Lo que sigue faltando es papel de verdad**, y ya solo por una razón: si la
impresora **no implementa** PC858 o el QR nativo (`GS ( k`), saldrá mal aunque
los bytes sean correctos. Eso no se puede saber sin verlo. Si el tique sale bien
pero **sin QR**, hay que mandarlo como imagen.

⚠️ **Y las impresoras llevan desde el 12/08 sin conectarse.** Antes de la
prueba, mira lo que hay encallado en la cola o saldrá una montaña de tiques
viejos:

```powershell
Get-PrintJob -PrinterName TPV-Cocina; Get-PrintJob -PrinterName TPV-Barra
# para vaciarla:
Get-PrintJob -PrinterName TPV-Cocina | Remove-PrintJob
```

## La impresión arranca sola

Está instalada como **tarea de Windows** y se levanta 20 s después de iniciar
sesión. No hay que hacer nada al empezar el día.

```powershell
powershell -ExecutionPolicy Bypass -File scripts\instalar-impresion.ps1 -Estado
```

Dice si la tarea está, si el proceso vive y las últimas líneas del log. Cada
pedido sale en papel: comida por 🍳 `TPV-Cocina` y bebida por 🍺 `TPV-Barra`,
**sin navegador**. Si el PC estuvo apagado, al arrancar saca lo pendiente sin
repetir lo ya impreso.

**Al montar un bar nuevo**, una sola vez, el mismo comando sin `-Estado`. No
pide administrador a propósito: es una tarea del usuario del TPV, que arranca al
iniciar sesión. Corre oculta (`scripts\impresion-oculta.vbs`) para no dejar una
consola negra en la pantalla del bar, y todo va a `logs\impresion.log` — que se
lee con `Get-Content … -Encoding UTF8`, o los acentos salen como basura. Si el
proceso se cae, Windows lo reintenta 3 veces. Se quita con `-Quitar`.

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

**Sin confirmar, visto de pasada en el repaso de la v0.99.1**: tras revocar el
dispositivo de prueba, la pestaña que ya estaba abierta **seguía entrando en
Admin** y pintando los datos. Lo más probable es que sea el estado que quedó en
`localStorage` —la pantalla se protege con la sesión local, y el servidor
rechazaría cualquier escritura por RLS—, o sea que sería cosmético y no una
fuga. Pero no está comprobado: merece un rato.

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


## El modelo: un bar, una instalación

Cada bar tendrá **su proyecto Supabase, su despliegue, su dominio y su marca**.
No es un SaaS compartido. Lo que evita acabar con ocho copias divergentes:
**un repo con el producto + un perfil por bar** (`locales/<slug>/perfil.json`),
con módulos opcionales por local. Nunca copiar el repo.

Coste a tener en cuenta: **Supabase Pro ~23 €/mes por bar**. Con 10 bares son
~230 €/mes; cobrando 25-40 €/bar el margen baja del ~95% al ~30-40%. Sigue
saliendo, pero conviene fijar el precio sabiéndolo.


## Qué está hecho y verificado de verdad

- **Backend multi-tenant**: 34 migraciones aplicadas (con registro: `npm run
  migraciones -- --estado` dice en cuál va cada bar), RLS en las 17 tablas, RPC
  transaccionales.
- **⚠️ Los `grant` no bastan: hay que MIRAR los permisos en la BBDD.** Supabase
  tiene `alter default privileges` que conceden EXECUTE a `anon` y
  `authenticated` **en cuanto se crea una función**. Ha mordido cuatro veces:
  `_debe_por_comensal` (fuga), `registrar_pago_online` (grave: cerrar la cuenta
  **sin pagar**), `marchar_siguiente_idem` y `_congelar_iva_linea`. Su migración
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
- **Numeración fiscal sin carrera**: contador por local en su propia tabla. Con
  el trigger viejo, 12 cobros simultáneos hacían fallar 2 con `duplicate key`.
- **IVA por producto**, congelado en la línea al pedir, con desglose por tipo en
  pantalla, papel, recibo del cliente y AEAT.
- **Devoluciones (rectificativas R5)** por diferencias, enteras o parciales,
  probadas contra la AEAT de pruebas — y el dinero **vuelve de verdad a la
  tarjeta** por Stripe, con reintento si falla.
- **Informes** calculados en el servidor por rango de fechas (Hoy / Ayer /
  7 días / Este mes / Mes pasado), con CSV y las devoluciones restando.
- **Monitorización**: el bar deja constancia de lo que se rompe en su propia
  base y `npm run salud` lo lee. Encontró sola dos fallos de producción.
- **655 tests JS** (incluidas seis pantallas) **+ 37 pruebas de SQL** contra la
  base real, lint limpio, CI y deploy en verde.


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
