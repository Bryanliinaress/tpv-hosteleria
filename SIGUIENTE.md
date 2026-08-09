# Punto de partida para la siguiente sesión

**Estado: v0.64.0, todo desplegado, repo limpio y sincronizado.**
Última sesión: 2026-08-08. Fuente de verdad del roadmap: [PRODUCCION.md](PRODUCCION.md).

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

**347 tests**, lint limpio, CI y deploy en verde.

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

## Segunda pasada de auditoría (v0.52.0)

Cuatro fallos más, fuera del cobro:

5. **Overbooking en reservas.** Quien reservaba «sin preferencia de zona» no
   contaba en el aforo al comprobar una zona concreta: con 46 de 48 plazas
   reservadas sin preferencia, el bar seguía aceptando una mesa de 4 en terraza
   (50 personas en un local de 48). Ahora se comprueba **siempre el aforo total**
   y además el de la zona si se pide una.
6. **Fichajes en el mes equivocado.** El filtro cortaba el texto ISO (UTC) y el
   selector usaba hora local: un turno que entra a la 01:00 del día 1 caía en la
   nómina del mes anterior. Fechas del negocio ya centralizadas en
   `src/lib/fechas.js`, siempre en hora local.
7. **Regresión propia del arreglo de ids (v0.51.0).** La fusión al sincronizar
   deducía la antigüedad del id; con el sufijo aleatorio dejó de poder, y un
   ticket o fichaje recién creado podía perderse al llegar el estado de otro
   dispositivo. Los registros «solo-añadir» llevan ya `_ts` propio.
8. **El pago por QR se registraba como EFECTIVO.** Al volver de Stripe se
   llamaba a `pagarParte` pasando solo la propina, así que el método caía al
   valor por defecto: el arqueo esperaba en el cajón un dinero que había
   entrado por tarjeta. Con el pago online activo, descuadre garantizado.

## Tercera pasada: robustez y pulido (v0.53.0)

9. **Precios negativos aceptados.** Teclear «-5» en un producto restaba del
   ticket. Los precios se sanean: nunca negativos, nunca NaN, siempre a
   céntimos.
10. **Los céntimos no cuadraban al repartir.** 20 € entre tres daba tres partes
    de 6,67 = 20,01: el desglose no coincidía con el total y el arqueo se iba un
    céntimo en cada mesa compartida. Ahora el reparto es exacto (se redondea el
    acumulado), probado con 0,01 € entre 2 y 7,77 € entre 6.
11. **24 textos sin traducir** en la pantalla del cliente (las pestañas, el
    recibo, «otra ronda»): un turista en inglés los veía en español. Traducidos,
    y hay un **test que falla si alguien añade un texto sin traducción**.

### Zonas que quedan probadas (no tenían test)
- **Tiempos de cocina**: el 2º plato y el postre esperan a que sala los marche;
  marchar saca solo el siguiente tiempo y no toca otras mesas.
- **Control de acceso**: un rol falseado en el dispositivo NO da permisos (manda
  el padrón), y un empleado desactivado pierde el acceso al instante.
  Verificado también en la app: sesión de camarero con `rol:'admin'` → bloqueado.
- **Robustez**: mesas ocupadas no se borran, siempre queda un admin, no se
  reconfigura la sala con gente sentada, PIN de 4 dígitos y único.
- **Descuentos e invitaciones**: ticket a 0 sin dinero en caja, y un descuento
  mayor que la cuenta no genera importes negativos.

## Impresión con varias impresoras (v0.54.0)

El montaje real de un bar: comandas de comida a la impresora de **cocina**, las
de bebida a la de **barra**, y el ticket del cliente a la de **caja**. Antes la
impresora era una por DISPOSITIVO, así que hacía falta un PC por estación.

- La app manda el **destino** en cada impresión; el puente elige la máquina.
- `IMPRESORA_COCINA`, `IMPRESORA_BARRA`, `IMPRESORA_CAJA` en el puente. Un
  destino sin declarar cae en la de defecto: nunca se pierde una comanda.
- **Dos impresoras USB en el mismo PC**: se comparten en Windows
  (`\\localhost\Cocina`) y el puente les manda los bytes en crudo (`copy /b`),
  sin pasar por el driver, que convertiría el ESC/POS en basura.
- Manual completo con los tres montajes: [docs/IMPRESION.md](docs/IMPRESION.md).

## Auditoría del ESC/POS antes de tener la impresora (v0.55.0)

Repaso byte a byte contra la especificación, para no perder la sesión de
pruebas con la impresora depurando lo evidente. Dos fallos:

12. **El TOTAL se partía en dos líneas.** `fila()` rellenaba a 48 columnas
    estando en tamaño DOBLE, donde solo caben 24: la línea más importante del
    ticket habría salido rota y descuadrada. El generador conoce ya la escala.
13. **El cajón portamonedas no se abría nunca.** `abrirCajon()` estaba escrito
    y probado, pero **no lo llamaba nadie**: era código muerto y la función
    figuraba como hecha. Ahora se abre al cobrar en **efectivo o mixto** (nunca
    con tarjeta), después de cortar, y hay un botón manual en Ajustes.

**Comprobado y correcto** (no tocado): página de códigos CP858 (`ESC t 19`),
comandos de QR nativo, corte parcial `GS V 66`, pulso del cajón, y que cada
acento ocupa un byte — si no, las columnas se descuadrarían.

Hay un simulador de papel en el scratchpad que dibuja el ticket como saldría;
útil si hay que volver a tocar el formato.

## Reservas, alta del local y capa v2 (v0.56.0)

14. **Se podía reservar sobre un hueco ya lleno.** La pantalla solo ofrece
    huecos libres, pero entre que se pinta y se confirma pueden pasar minutos
    (o reservar otro cliente a la vez): `crearReserva` no comprobaba nada.
    Ahora valida aforo y día cerrado al **crear y al editar**, y devuelve null
    con el motivo — igual que ya hacía el backend real.
15. **«Crear carta de ejemplo» mentía en la demo.** La acción solo existía en el
    backend v2; en v1 no hacía nada y el mensaje decía que sí. Ahora la carta de
    ejemplo se guarda como plantilla (`CARTA_EJEMPLO`) y se puede **restaurar**:
    útil si el dueño vacía la carta y se arrepiente.
16. **Rehacer la sala invalidaba los QR en silencio.** `configurarSala` renumera
    las mesas, así que los QR ya pegados dejan de apuntar a su mesa. El
    asistente ahora avisa cuando es una reconfiguración, no una alta nueva.

**Capa v2 verificada**: se compararon las **29 llamadas RPC** del cliente y de
las Edge Functions contra las firmas del SQL (nombres y parámetros). Sin
discrepancias: el contrato cliente↔servidor es correcto.

## El navegador se llenaba en mes y medio (v0.57.0)

17. **El estado guardado crecía sin límite.** Medido: **1.800 tickets (un mes a
    60/día) = 4,1 MB** y el navegador corta en ~5 MB. Al pasarse, zustand deja
    de guardar **en silencio**: se sigue trabajando y al recargar falta el día.
    Un año llegaba a 13,5 MB.
    Ahora se guarda solo la ventana útil (45 días de tickets, 550 de fichajes
    porque son nómina) y los tickets de más de una semana se **adelgazan**:
    se quitan pan, extras, notas e ids de línea, que solo importan el día del
    servicio. Los informes siguen viendo el mes completo. **Un año: 2,6 MB.**
    Y si aun así el navegador se llena, **se avisa en pantalla** en vez de
    perder datos callando.
18. **Los descuentos dejaban medios céntimos.** Un 5% sobre 13,70 € guardaba el
    ticket con `13.014999999999999 €`: ni cuadraba con los pagos ni se puede
    imprimir. Todo el cobro se redondea ya en el store, dé igual quién llame.
19. **Al asignar mesa a una reserva, la zona pesaba más que la capacidad**: a un
    grupo de 6 se le ofrecía antes una mesa de 2 en su zona preferida que una de
    6 en otra. Ahora manda el tamaño (la zona es preferencia) y, entre las que
    caben, la más justa.

## Aviso de versión nueva (v0.58.0)

20. **Un TPV abierto toda la semana no se enteraba de las actualizaciones.** El
    service worker solo comprobaba si había versión nueva al CARGAR la página,
    así que un arreglo desplegado el martes podía no llegar nunca al bar.
    Ahora se pregunta **cada 30 minutos** y, cuando hay versión, sale un aviso
    «✨ Hay una versión nueva · Actualizar».
    Se cambió a modo `prompt` a propósito: **recargar solo en mitad de una
    comanda es peor que esperar**, así que decide el personal cuándo.

## El menú del día ya se puede pedir desde la PDA (v0.59.0)

21. **El camarero no podía tomar un menú del día.** La hoja de la PDA decidía
    qué enseñar con `!!prod.precios`, y un menú **también** los tiene
    (`{ base: 12 }`): salían pan y formatos en vez de primero, segundo y
    postre, y la comanda llegaba a cocina **sin las elecciones**. En un bar con
    menú al mediodía, eso es el grueso del servicio.
    Ahora la PDA pinta los grupos del menú, cobra los suplementos y **no deja
    enviarlo a medias** («Elige Segundo» hasta que esté completo).

Para que no vuelvan a divergir la PDA y la carta del cliente, la decisión y la
línea del pedido viven **en un solo sitio** (`src/lib/menuDia.js`):
`conFormatos()`, `conOpciones()` y `lineaDeMenu()`. Las dos pantallas las usan.
Probado también en el navegador: menú con solomillo → cocina recibe
«Primero: Sopa · Segundo: Solomillo · Postre: Flan» y 14,00 €.

## En la app REAL, pedir un café pasaba por la hoja del pan (v0.60.0)

22. **Todo producto de precio único parecía un producto con formatos.** La
    columna `precios` del backend v2 es un mapa, así que un café se guarda como
    `{ base: 1.30 }` y volvía tal cual al store. Las pantallas lo tomaban por un
    producto **con formatos**: al pedirlo se abría la hoja del pan —vacía,
    porque ningún formato casa con «base»— con el botón **«Añadir · 0,00 €»**, y
    la línea salía con un pan inventado en la comanda («Pitufo · Normal» en un
    café). En Admin, editar ese producto abría el formulario en modo formatos.
    Ojo al alcance: **el ticket no se cobraba mal**, porque en v2 el precio lo
    pone el servidor (ver fallo 23); lo que estaba mal era la pantalla, la
    comanda y el formulario. Solo en `/app/`; en la demo (v1) no pasa.
    Arreglado en el **borde** (`preciosDeProducto` en `src/lib/v2/estado.js`):
    `base` → `precio`, que es el shape que documenta el store. De paso, editar
    solo el nombre de un café ya no le borra el precio.

## 🔴 PENDIENTE DE APLICAR: los suplementos no se cobran en la app real

23. **`qr_agregar_linea` cobraba solo el precio del producto.** Todo lo que la
    app suma por encima se perdía en el backend real: el **tipo de pan** (sin
    gluten, +1,20 €), los **extras** (+0,20 € cada uno) y el **suplemento del
    menú** (solomillo, +2 €). El cliente ve 3,70 € en pantalla y el bar cobra
    2,50 €. Con extras en media docena de comandas por servicio, es dinero
    perdido todos los días — y en la demo (v1) no se ve, porque ahí el precio
    lo calcula la propia app.

    Está escrito en `supabase/migrations/20260808T11_suplementos.sql`: el precio
    lo sigue calculando **el servidor** (si lo mandara el cliente, cualquiera
    podría pedirse el menú a 0 €), pero ahora mira también la personalización y
    contrasta cada suplemento con la carta del local y con los grupos del propio
    producto. El cliente ya manda las `elecciones` del menú, que hacían falta
    para cobrar el suplemento.

    ⚠️ **Falta aplicarla** (necesita el token de Supabase, igual que la 10) y
    comprobar contra la BBDD: bocadillo sin gluten con queso, y menú con
    solomillo. Hasta entonces, el fallo sigue vivo en `/app/`.

## Cosas de la app real que «se deshacían solas» (v0.62.0)

El backend v2 sustituye las acciones del store **una por una**; la que no está
en la lista se queda con la versión de la demo, que solo hace `setState`. Como
la sala se rehidrata del servidor en cada evento, el cambio duraba segundos y
luego volvía atrás, sin ningún error. Comparadas las 81 acciones del store con
las 61 implementadas en v2, aparecieron cuatro huecos con pantalla propia:

24. **Juntar mesas desde el Mostrador no llegaba al servidor.** Desde la PDA sí
    (`fusionarMesa` → RPC), desde el Mostrador no (`agruparMesas`): la misma
    operación, dos nombres, uno de ellos sin backend. Juntar dos mesas de 4 para
    un grupo de 8 es de todos los días.
25. **Mover un cliente de mesa** (`transferirComensal`) tampoco. Ahora se lleva
    sus líneas y **sus comandas** —que cuelgan de la mesa: sin eso, cocina
    seguiría cantando la mesa vieja— y libera la de origen si se queda vacía.
26. **La zona y la capacidad de una mesa**, en Admin, se perdían. Además se
    guardaban **en cada tecla**: en la app real eso era una escritura en la
    BBDD por pulsación y el cursor saltaba al valor viejo al recargar la sala.
    Ahora se guardan al salir del campo.
27. **Los rótulos de la carta** (Pan / Tipo de pan / Extras, lo que una pizzería
    llamaría Tamaño / Masa / Ingredientes) no se guardaban.

Y dos más, del mismo repaso:

28. **Un tipo de pan creado en la app real no cobraba su suplemento.** `addTipoPan`
    guardaba la clave `suplemento` y toda la app (y el servidor al cobrar) lee
    `sup`: el «sin gluten +1,20 €» ni se enseñaba ni se cobraba. Los que vienen
    en la carta de ejemplo sí funcionan; solo fallaban los creados a mano.
29. **«↺ Reiniciar datos» borraba el día sin preguntar.** Un clic de más en la
    cabecera de Admin se llevaba mesas abiertas, tickets, fichajes y arqueo, sin
    diálogo. Ahora confirma, y en la app real dice la verdad: allí solo vacía la
    copia de **este dispositivo** y la vuelve a bajar del servidor.

### ⚠️ Queda uno igual, y necesita servidor: compartir plato

`toggleCompartir` (el cliente marca «este plato lo compartimos con Luis») **no
existe en v2**. La columna `lineas_pedido.compartido_con` está creada pero no la
escribe ni la lee nadie: en la app real el botón no hace nada y el reparto de la
cuenta sale como si el plato fuera de uno solo — justo el fallo 1 de la auditoría
del dinero, que en la demo sí está resuelto. Lo pide el **cliente anónimo**, así
que hace falta un RPC (migración 12), no vale escribir la tabla desde el móvil.
Mientras no esté: o se implementa, o ese botón no debería salir en `/app/`.

## 🔴 Privacidad: los datos de las reservas los veía cualquiera (v0.63.0)

30. **El móvil de un cliente se bajaba el nombre y el teléfono de las reservas.**
    `mesas` es de lectura pública —el QR y la página de reservas necesitan
    número, zona y estado— pero la tabla tiene una columna `reserva` con
    `{nombre, teléfono, hora, personas}`. La hidratación pedía **todas** las
    columnas también sin sesión, así que la agenda del día acababa en el estado
    (y en el `localStorage`) de cualquiera que abriese la carta. Con la clave
    anon, que es pública por diseño, se sacaba de una sola petición.
    - **Cliente (ya desplegado)**: sin sesión se piden solo las columnas
      públicas; `abierta_desde` y `camarero_id` tampoco bajan.
    - **Servidor**: `20260808T12_privacidad_anon.sql` corta por privilegios de
      columna (RLS filtra filas, no columnas). ⚠️ **Pendiente de aplicar.**
31. **Los datos del local se guardaban letra a letra.** Cada tecla en Admin →
    Local era, en la app real, un leer-modificar-escribir entero de la config:
    escribir la dirección eran ~30 escrituras y dos campos seguidos podían
    pisarse entre sí. Ahora se guarda al salir del campo (mismo componente que
    las mesas).

## Cola offline y marca en el ticket (v0.64.0)

32. **Los avisos de la cola offline no decían qué se había perdido.** Las claves
    de los textos (`agregar_linea`…) no son los nombres reales de los RPC
    (`qr_agregar_linea`…), así que **ninguna** casaba: cuando una operación
    guardada sin conexión no se podía aplicar, el camarero leía «no se pudo
    aplicar una operación», sin más. Los tests usaban los mismos nombres
    inventados, así que el fallo estaba consolidado. Hay ahora un test que
    compara la lista de encolables con la de textos: si se añade una operación y
    nadie escribe su aviso, falla.
33. **El ticket ponía «Mi Local»** hasta que el dueño rellenaba Admin → Local,
    aunque la instalación fuera la suya y ya llevara su marca en la portada, la
    pestaña y la carta QR. El nombre de arranque sale ya del perfil
    (`nombreDeLocalPorDefecto`); la demo genérica sigue con el neutro, que no
    debe apropiarse de un ticket. Era el punto 3 del trabajo de marca blanca.

### ⚠️ Riesgo conocido de la cola: reenviar puede duplicar un producto

Si la petición **llega al servidor pero la respuesta se pierde** (timeout con la
línea ya insertada), la cola la reenvía y `qr_agregar_linea` fusiona con la
línea pendiente idéntica **sumando cantidad**: el cliente acaba con dos cafés
donde pidió uno. No es frecuente, pero el wifi de un bar es justo el escenario.
Se arregla con una **clave de idempotencia** (`p_idem uuid` + tabla de
operaciones ya aplicadas): el id de la operación en cola ya existe y serviría.
No lo he implementado porque toca el servidor y hay tres migraciones sin
aplicar; se probaría contra la BBDD en la misma sesión.

## 🖨 EL LUNES: llegan las impresoras (dos, 80 mm)

Todo el código está escrito y probado sin papel. Plan de la sesión:

1. **Enchufar** las dos al router (o al PC si son USB).
2. **Sacar su IP**: apagar, mantener FEED y encender → imprime un auto-test con
   la dirección.
3. **Levantar el puente** con una impresora por destino:
   ```bash
   IMPRESORA_COCINA=192.168.1.50 IMPRESORA_BARRA=192.168.1.51      node scripts/puente-impresion.mjs
   ```
   (si son USB en el mismo PC: compartirlas en Windows y usar
   `IMPRESORA_COCINA="\\localhost\Cocina"`)
4. **Admin → Ajustes → Impresión** → «Puente de red» + la dirección que imprime
   el script.
5. **Comprobar, en este orden**:
   - `🧾 Imprimir ticket de prueba` → sale, corta y **el TOTAL cabe en su línea**
   - `💶 Abrir cajón` → el cajón salta
   - Pedido de comida desde la PDA → sale por **cocina**
   - Pedido de bebida → sale por **barra**
   - Cobrar en efectivo → ticket con **QR** y cajón abierto
   - Mirar acentos y el € en el papel (CP858): «Café», «Ñ», «12 €»

**Lo único que puede fallar y no he podido probar**: que la impresora genérica
no implemente el QR nativo (`GS ( k`). Si el ticket sale perfecto pero **sin
QR**, no es un fallo de formato: hay que dibujar el QR como imagen y mandarlo en
mapa de bits. Está identificado y es un rato de trabajo.

## Pendiente — y de quién depende

### De Bryan (sin esto no se avanza)
1. **Aplicar las migraciones 10, 11 y 12** (`20260804T10_pagos_online.sql` y
   `20260808T11_suplementos.sql` **cobra los suplementos** (fallo 23) y
   `20260808T12_privacidad_anon.sql` **tapa los datos de las reservas**
   (fallo 30)): hace falta un token nuevo de Supabase. Es 1 minuto.
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
3. ~~**Marca blanca**~~ ✅ portada, pestaña, PWA, carta QR y **ticket**: el
   nombre de arranque del local sale del perfil (v0.64.0). Si el dueño escribe
   otro en Admin → Local, manda el suyo, que es el dato fiscal.
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
