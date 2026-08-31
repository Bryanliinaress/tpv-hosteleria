# Auditoría: los fallos encontrados, uno a uno

Cada entrada dice **qué pasaba en un bar de verdad**, no qué línea estaba mal.
Están por versión; el arreglo de cada una lleva su test de regresión.

Esto es historia: para saber en qué punto está el proyecto, mira
[SIGUIENTE.md](../SIGUIENTE.md).

## ✅ RESUELTO: los suplementos no se cobraban en la app real

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

    ✅ **Aplicada y comprobada en vivo** con la carta de ejemplo: sin gluten
    +1,20 € y queso+huevo +0,40 €. Antes se regalaban. La migración
    `20260808T11_suplementos.sql` está entre las aplicadas (`npm run
    migraciones -- --estado` lo confirma).

    Esta entrada estuvo encabezando el fichero como 🔴 PENDIENTE mucho después
    de estar resuelta, que es peor que no documentarlo: quien abría la auditoría
    para saber cómo estaba el proyecto se encontraba de primeras un fallo de
    dinero que ya no existía.

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

## Repaso del registro fiscal (v0.65.0)

34. **El botón «Reintentar» no reintentaba los tickets en ERROR.** El filtro del
    lote en la Edge Function hacía, cuando no venía `localId` —que es como lo
    llama el panel—, `.in(estado, [pendiente, error])` **y además**
    `.eq(estado, 'pendiente')`: los tickets en error quedaban fuera para
    siempre. Y en error es justo donde caen los del primer día, los que
    fallaron por **«Falta el CIF/NIF del local»**: el dueño lo configura, pulsa
    reintentar… y no pasa nada.
35. **La función fiscal no comprobaba de quién era el ticket.** Trabaja con
    `service_role` (se salta RLS) y aceptaba cualquier `localId` en el cuerpo:
    con la clave anon —que es pública por diseño— se podía disparar el reintento
    en lote **de otro local** y recibir sus UUID y sus QR de la AEAT. Ahora el
    local sale del JWT, nunca del cuerpo, y un ticket suelto pedido con sesión
    tiene que ser del local de esa sesión.
36. **«Base imponible + IVA» podía no sumar el total.** Se calculaban por
    separado y cada uno se redondeaba al imprimir. Ahora la cuota se saca de la
    base **ya redondeada**, en el recibo del cliente y en la factura que se
    manda a Verifacti. Hay un test que recorre los 6.000 importes de 0,01 € a
    60 € con los tres tipos de IVA (4, 10 y 21) y exige que cuadren.

⚠️ Los puntos 34 y 35 son de la **Edge Function**: están en el repo pero
**falta desplegarla** (`npx supabase functions deploy registrar-fiscal
--project-ref <ref>`), y eso necesita token. Hasta entonces siguen vivos.

## 🔴 El cliente elegía cuánto pagaba (v0.66.0)

37. **El importe del pago por QR lo ponía el navegador.** `crear-checkout`
    aceptaba `importe` del cuerpo de la petición y `registrar_pago_online`
    marcaba al comensal como **pagado** sin comprobar que ese dinero cubriera su
    consumo. Con la cuenta en 45 €, una llamada con `importe: 0.50` daba un
    cobro legítimo y firmado por Stripe: el webhook marcaba pagado y, si era el
    último, **cerraba la mesa y emitía el ticket**. La cuenta entera perdida.
    - El importe lo calcula ahora **el servidor** (`pendiente_de_pago`), y del
      cliente solo se acepta la **propina**, que es un extra voluntario.
    - Y aunque llegue un pago corto, `registrar_pago_online` **no da la cuenta
      por saldada**: registra el cobro (el dinero ha entrado) y devuelve
      `insuficiente` con lo que falta.
    - De paso: el `returnUrl` venía del cuerpo, así que se podía devolver al
      cliente a otro dominio tras pagar. Ahora tiene que coincidir con el
      `Origin` de la petición.

    Todavía no había pasado en la calle porque el pago online **no está
    activo** (falta la migración 10 y Stripe). Justo por eso conviene que quede
    cerrado **antes** de encenderlo. El arreglo va en la propia migración 10,
    que aún no se ha aplicado, y en `crear-checkout` (falta desplegarla).

## El desglose de caja se dejaba fuera el pago por QR (v0.67.0)

38. **Un cobro online no aparecía en «Desglose por método».** La pantalla de
    Caja recorría una lista escrita a mano —`efectivo`, `tarjeta`, `bizum`,
    `sincobrar`— y el pago por QR se guarda como `online`: ese dinero estaba en
    la caja pero **no se pintaba**, así que el desglose no sumaba lo cobrado.
    Y con el método a medio pintar, la etiqueta salía como `undefined`.
    Ahora se recorre lo que hay (`metodosDe`), en orden estable, y un método
    que nadie haya previsto también sale. El arqueo **no** estaba afectado:
    solo cuenta lo etiquetado como efectivo, que es lo que hay en el cajón.

## 🔴 El alta de un bar dejaba el local SIN MESAS (v0.68.0)

39. **«Configurar sala», en la app real, borraba la sala y no creaba nada.** El
    asistente de alta manda las zonas como `{nombre, mesas, capacidad}` y la
    capa v2 leía `z.n`, que no existe: `Array.from({length: undefined})` da una
    lista vacía, así que se ejecutaba el `delete` de las mesas y el `insert` se
    saltaba. El aviso remataba con **«Sala configurada: undefined mesas»** y el
    dueño se quedaba con un TPV sin una sola mesa, en su primer minuto de uso.
    Es justo el camino que no se había podido probar entero (el alta necesita
    login con contraseña).
    Ahora se acepta la forma del asistente (y `n` por compatibilidad), se
    valida que haya al menos una mesa **antes de borrar nada**, y se devuelve el
    total de verdad. Tres tests nuevos.

## El arqueo de la app real cantaba un sobrante falso (v0.69.0)

40. **El fallo 2 seguía vivo en el backend real.** En la demo se arregló hace
    tiempo que el arqueo espere en el cajón las propinas dejadas **en metálico**;
    la implementación v2 se escribió con la fórmula vieja:
    `descuadre = contado − pagos.efectivo`. Cada día con propinas en efectivo,
    el TPV decía que sobraba dinero. Para un dueño que cuadra caja, un TPV que
    «se equivoca» todas las noches deja de ser de fiar.
    La tabla de tickets solo guarda el TOTAL de propina, pero el detalle del
    ticket lleva la propina y el método **de cada comensal**: `propinasPorMetodoDe()`
    las agrupa desde ahí y la usan el cierre, el arqueo en vivo y v2. Cinco
    tests nuevos (comprobado que fallan con la fórmula vieja).

## Grupos de mesas en la app real (v0.70.0)

Juntar dos mesas para un grupo de ocho es de todos los días, y en el backend
real está montado distinto que en la demo: lo que une las mesas es la columna
`unida_a` y **los comensales se quedan en su mesa** (al cobrar, el servidor
recoge el grupo entero). Todo lo que tocaba una mesa unida se olvidaba del
grupo, y siempre en la misma dirección: dinero sin cobrar.

41. **Separar mesas dejaba la cuenta en el aire.** El RPC marca las secundarias
    como **libres**… con su gente sentada y sus líneas dentro. En la sala esa
    mesa aparecía libre, así que nadie la cobraba, y el siguiente cliente que
    escaneara ese QR se encontraba la cuenta del anterior. Ahora la cuenta se
    lleva a la cabeza del grupo **antes** de separar, que es lo que ya hacía la
    demo.
42. **«Cerrar mesa sin cobrar» solo cerraba una del grupo.** Las demás se
    quedaban colgando de una mesa ya libre: mesas fantasma con consumo vivo.
    Ahora se cierra el grupo entero.
43. **Juntar dos grupos fallaba, y la pantalla decía que había ido bien.** El
    RPC rechaza una secundaria que ya sea cabeza de otro grupo (mesa 8 = 4+4, y
    luego llega otra pareja). Se resuelve aquí, moviendo el grupo entero, y el
    aviso ya no se adelanta al resultado.
44. **La PDA y el Mostrador usaban caminos distintos** para lo mismo
    (`fusionarMesa` y `agruparMesas`): ahora son literalmente la misma función.

`src/lib/v2/grupos.js` concentra «quién es la cabeza» y «qué mesas forman el
grupo», con sus tests. 19 tests nuevos en total.

## Un servicio entero, probado de punta a punta (v0.71.0)

Los tests miraban una pieza cada uno. Ahora hay uno que recorre **el camino
completo de un servicio** (`src/store/servicio.test.js`): dos clientes se
sientan, piden comida y bebida, la comida va a cocina y la bebida a barra, piden
otra ronda, comparten un plato, uno paga en efectivo con propina y el otro con
tarjeta, se cierra la mesa, cuadra el ticket y cuadra el cajón. Si se rompe
cualquier eslabón salta, aunque la pieza suelta siga pasando su test.

Comprobado además **en el navegador**, con el camino público entero: carta por
QR → dar el nombre → añadir → confirmar → la comanda aparece en barra; y el
asistente de reservas de principio a fin.

## La reserva online estaba entera en español (v0.72.0)

45. **La página de reservas no llamaba a `t()` ni una vez.** La carta por QR sí
    está traducida desde la v0.53.0, pero la reserva —que se abre desde fuera
    del local, la comparte el propio bar y la ve cualquiera— estaba solo en
    español, sin selector de idioma. Un turista que quiere reservar mesa se
    encontraba «¿Dónde prefieres sentarte?» y «Alergias, trona, celebración…».
    Traducida entera (60 textos), con su botón 🇬🇧/🇪🇸, incluidos el mini
    calendario (los meses y las iniciales de los días) y los diálogos de
    cancelar.
46. **El test que debía impedirlo tenía dos agujeros.** Solo miraba lo que ya
    pasaba por `t()`, así que una pantalla sin traducir *ninguna* frase pasaba
    limpia; y su extractor no entendía `t('texto con {hueco}', { … })`. Ahora
    además **busca texto en español escrito directamente en el JSX** —textos
    entre etiquetas y `placeholder` / `aria-label` / `title`— y falla si
    aparece. Con eso saltaron cuatro que quedaban en la carta del cliente.

`tr()` acepta ya huecos con nombre (`t('para {n} personas', { n: 4 })`), para
que cada idioma pueda ordenar la frase a su manera.

## La carta también habla inglés (v0.73.0)

47. **Cambiar de idioma traducía la interfaz, no la comida.** El cliente leía
    «Add» encima de «Jamón york, Mantequilla»: los platos, los ingredientes, los
    panes, los extras y las categorías los escribe el local, así que se
    quedaban en español. La mitad de la pantalla de un turista es justo eso.

Cómo se resuelve, sin darle trabajo al bar y sin inventar traducciones
(`src/lib/cartaI18n.js`):

1. **Si el dueño ha escrito la traducción**, manda la suya. Hay dos campos
   nuevos por producto en Admin → Carta → Más opciones: «🇬🇧 Nombre en inglés» y
   «🇬🇧 Descripción en inglés». Es lo que ningún diccionario puede adivinar
   («Croquetas de la abuela»).
2. **Si no**, se busca en un diccionario de términos de bar español —unos 90:
   ingredientes, panes, extras, categorías y los nombres de bocadillo que
   significan lo mismo en cualquier barra (mixto, catalana, serranito…)—. Los
   nombres compuestos se parten: «Jamón york y mantequilla» → «Cooked ham and
   butter».
3. **Si tampoco**, se deja tal cual. Nunca se inventa.

Además:
- **Los 14 alérgenos** son de la app (Reglamento UE 1169/2011), no los escribe
  el bar: ahora se traducen (Lácteos → Milk, Frutos de cáscara → Tree nuts).
- **La comanda de cocina sigue en español**, que es quien la lee; lo que se
  traduce es lo que ve el cliente, incluido lo que ya tiene pedido.
- **Buscar «cheese» encuentra el queso**: la búsqueda mira también la
  traducción. Antes, con la carta en inglés, no salía nada.

19 tests nuevos. La traducción se guarda igual en la demo y en el backend real.

## El recibo del cliente y la estación de impresión (v0.74.0)

48. **El recibo que el cliente se descarga estaba entero en español**, aunque
    tuviera la app en inglés: es un fichero aparte que se genera con otro
    código (`recibo.js`) y se quedó fuera de la traducción. Ahora sale en su
    idioma —etiquetas, fecha y **los platos**— y el `lang` del HTML acompaña.
49. **El método de pago salía en crudo en el papel**: «efectivo» en minúscula,
    tal cual el identificador interno. Ahora va la etiqueta («Efectivo» /
    «Cash»). Un recibo viejo sin etiqueta sigue enseñando lo que tenía.
50. 🖨 **En modo «Ambas», la estación de impresión mandaba las bebidas a la
    impresora de COCINA.** El destino se decidía por la estación elegida y no
    por la comanda, así que con las dos impresoras montadas —justo el plan del
    lunes— la barra no recibía nada y a cocina le salía todo. Ahora cada
    comanda lleva su destino, y la comida y la bebida de una misma mesa son
    **dos papeles**, uno para cada máquina. La lógica está en
    `src/lib/estacion.js`, con 8 tests: era código de pantalla que no se podía
    probar.

## Cocina y barra: que nunca se queden en blanco (v0.75.0)

51. **Una bebida en «espera» dejaba la pantalla de barra en blanco.** Cocina
    declara los cuatro estados (espera, recibido, preparando, listo) y la barra
    solo tres: al pintar una comanda en un estado que esa pantalla no conoce,
    la tarjeta se construía con `undefined` y **se caía la pantalla entera**.
    En mitad de un servicio, eso es lo peor que puede pasar. Ahora un estado
    desconocido se pinta como una tarjeta neutra que **se puede marchar a
    mano**, y la barra sabe qué hacer con una bebida de segundo tiempo.
52. **Una comanda sin hora de entrada se colaba la primera y en rojo.** Las
    vistas del cliente construyen comandas «de mentira» sin hora; si una se
    colaba en la cola, `new Date(null)` la fechaba en **1970**, así que salía la
    primera de todas y marcada como urgente para siempre. Ahora va al final
    —no se sabe cuándo entró—, no parpadea, y el reloj de la tarjeta enseña un
    guion en vez de «29000000 min».

## El papel decía una cosa y la caja cobraba otra (v0.76.0)

53. **El ticket de UNA persona con plato compartido no cuadraba con su cobro.**
    El papel sumaba sus líneas propias, así que el plato compartido se le
    cargaba entero a quien lo pidió: el ticket decía 15 € y la caja cobraba
    12,50 (el cobro sí reparte desde la v0.51.0). Ahora el ticket usa el mismo
    reparto que el cobro y marca la línea como «compartido» — y lo mismo el
    ticket **impreso** en la térmica.
54. **«Base + IVA» tampoco cuadraba en el ticket impreso**, igual que pasaba en
    el recibo del cliente: se calculaban por separado y cada uno se redondeaba
    al imprimir. La cuota sale ya de la base redondeada.
55. **La demo no sincronizaba la configuración de reservas.** La lista de datos
    que se comparten y la de los que se vigilan estaban duplicadas y se habían
    desincronizado: `reservasConfig` se enviaba pero no se vigilaba, así que
    cambiar los turnos o los días de cierre no llegaba a los demás dispositivos
    hasta que se tocara cualquier otra cosa. Ahora la lista está en un solo
    sitio, con un test que recorre todas las claves.

## 🖨 El puente de impresión, repasado antes de estrenarlo (v0.77.0)

Tres cosas que habrían aparecido justo el día de las pruebas, con las dos
impresoras delante y sin saber a qué achacarlas:

56. **El socket se cerraba sin esperar a que salieran los bytes.** Se escribía y
    se destruía la conexión en el mismo suspiro; el callback de `write` dice que
    el sistema aceptó los datos, no que la impresora los tenga. Un ticket largo
    podía salir **a medias**. Ahora se cierra con `end` y se espera al `close`.
57. **Dos comandas a la vez a la misma impresora se mezclaban.** En hora punta
    entran pedidos de varias mesas a la vez: por el mismo socket, los bytes de
    dos comandas se entrelazan en el papel. Ahora cada impresora atiende de una
    en una, sin que las demás se esperen.
58. **No había reintentos.** Si la térmica estaba un segundo ocupada, la comanda
    se perdía con un 502. Ahora insiste tres veces (0,4 s y 0,8 s) antes de
    rendirse: perder una comanda es un plato que no sale.

6 tests nuevos sobre el puente.

## Fichajes y timeout del puente (v0.78.0)

59. **Corregir un fichaje en la app real avisaba de un error… que no existía.**
    La pantalla lee el resultado en el acto (`if (!r.ok)`) y la versión v2 era
    `async`: devolvía una promesa, así que el admin veía un aviso de error
    **vacío** aunque la corrección se hubiera guardado bien. Ahora responde en
    el acto y escribe por detrás.
60. **Y no validaba nada.** La demo impide guardar una salida anterior a la
    entrada; la app real lo aceptaba: **horas negativas en la nómina**. La
    validación vive ya en `src/lib/fichajes.js`, que usan las dos, y además
    rechaza fechas imposibles. 7 tests.
61. **Si el PC del puente estaba apagado, el TPV se quedaba esperando.** `fetch`
    sin plazo puede tardar minutos en rendirse: el camarero mira la pantalla
    creyendo que ha impreso. Ahora se rinde a los 8 segundos con un aviso claro
    («¿está encendido el PC?») y salta el plan B.

## El personal, en la app real, no tenía reglas (v0.79.0)

Buscando si el fallo 59 se repetía, apareció la misma clase de problema en las
acciones de personal: **la pantalla lee el resultado en el acto** (`if (!r.ok)`)
y las versiones v2 eran `async`, así que devolvían una promesa.

62. **Dar de alta a un empleado avisaba de un error falso.** Y es de lo primero
    que hace un dueño en el asistente de alta: crea a su gente, ve «error» y no
    sabe que en realidad se ha creado. Igual al **cambiar un PIN** y al **borrar**.
63. **Y no se validaba nada de nada.** La demo impide dos empleados con el
    MISMO PIN —si no, el TPV no sabe cuál de los dos está fichando— y no deja
    quedarse sin administrador. En la app real ambas cosas pasaban sin avisar:
    borrar al último admin dejaba el local **sin acceso a Admin**, y ahora
    tampoco se puede desactivar ni bajar a camarero al último que queda.

Las reglas viven en `src/lib/personal.js`, que usan la demo y la app real, con
12 tests. Antes estaban escritas dos veces… y solo funcionaban en una.

## Lo que se pide sin esperar respuesta (v0.80.0)

Persiguiendo la misma clase de fallo (la pantalla usa un resultado que en la
app real todavía no existe) aparecieron tres más:

64. **Añadir un comensal desde la PDA se lo cargaba al cliente equivocado.**
    `unirseAMesa` en el backend real es una llamada al servidor: sin esperar el
    id se guardaba **una promesa** como comensal elegido, el nuevo no quedaba
    seleccionado y todo lo que pidiera el camarero a continuación se le cargaba
    **al primero de la mesa**. Silencioso y con dinero de por medio.
65. **Fichar la salida no confirmaba nada.** La PDA mira `r.accion` para decir
    «salida fichada»; al ser una promesa, el empleado pulsaba y no veía
    respuesta. Se guardaba, pero él no lo sabía — y es su nómina.
66. **Sentar una reserva desde la agenda se daba por buena siempre**: una
    promesa siempre parece «verdadera», así que se marcaba la mesa como sentada
    aunque hubiera fallado.

Y para que no vuelva a pasar, un **test que lee el código**
(`src/lib/v2/contrato.test.js`): coge las acciones de la demo que responden
`{ ok, error }` en el acto y falla si su versión del backend real está
declarada `async`. Ese test encontró el fallo 65 él solo, después de escribirlo.

## «Mover mesa a…» dejaba la cuenta en la mesa vieja (v0.81.0)

67. **En la app real, juntar mesas desde la PDA se hacía al revés.** La pantalla
    dice «Mover / juntar **a**…» y el camarero elige la mesa de destino, que es
    quien debe quedarse la cuenta —así funciona la demo—. Pero la versión v2
    pasaba los argumentos tal cual a `agruparMesas`, donde el **primero** es la
    cabeza del grupo: la cuenta se quedaba en la mesa de origen y la elegida
    colgaba de ella. Si unos clientes se cambian de la 3 a la 8, la sala seguía
    enseñando la cuenta en la 3.
    Se comparó la **firma de cada acción** de la demo con la de la app real
    para encontrarlo: ocho diferían en el nombre de los parámetros y solo esta
    cambiaba el significado del orden.

## 🎭 La demo y el bar de verdad ya no se confunden (v0.84.0)

69. **Dos enlaces casi idénticos, uno de mentira y otro con dinero de verdad.**

    | Enlace | Qué es |
    |---|---|
    | `bryanliinaress.github.io/tpv-hosteleria/` | la **demo** (blob del proyecto viejo, datos de juguete) |
    | `bryanliinaress.github.io/tpv-hosteleria/app/` | **Casa Loli** (proyecto real) |

    Los dos salen del mismo `main` y se parecen en todo. Pedir en la demo
    creyendo que es el bar significa que **ese pedido no existe para nadie**: ni
    llega a cocina, ni se cobra, ni sale en la caja. Pasó de verdad probando la
    impresión: los pedidos se hacían en la demo y el papel nunca salía, porque
    el servicio escucha la base del bar.

    Ahora una instalación puede declararse demo (`"demo": true` en su perfil) y
    entonces:
    - **banda naranja a rayas arriba del todo**, en todas las pantallas y sin
      posibilidad de cerrarla: «🎭 DEMOSTRACIÓN · los pedidos y cobros de aquí
      no son reales»;
    - **la pestaña del navegador lo dice**: `DEMO · TPV Hostelería` frente a
      `Casa Loli`. Es donde uno se confunde cuando tiene seis pestañas abiertas.

    Comprobado compilando los dos perfiles: en la demo sale en la portada, en la
    carta del cliente y en reservas; en Casa Loli **no aparece** y la pestaña
    lleva su nombre.

### Lo siguiente para separarlos del todo
Un **dominio propio para cada bar** (era el plan del modelo «una instalación por
local»): `casaloli.es` no se confunde con nada. Mientras tanto, el aviso y el
nombre de la pestaña hacen el trabajo.

## 💳 Pago con Stripe en Casa Loli (v0.85.0)

70. **En la demo se podía pagar con el móvil y en Casa Loli no salía la opción.**
    Dos motivos, y ninguno era un fallo de código:
    - el perfil de Casa Loli tenía `"modulos": { "pagosOnline": false }` — ya
      está en `true`;
    - **la demo y Casa Loli son proyectos de Supabase distintos**, y las claves
      de Stripe estaban solo en el de la demo. El de Casa Loli
      (`tesilntyomnovjcuieho`) solo tiene los secretos de Veri*Factu.

71. **Y si no hay pasarela, la pantalla no decía nada.** El cliente pulsaba
    «Pagar» y no aparecía ninguna opción: se quedaba mirando. Ahora sale
    «🧾 Se paga al camarero · pide la cuenta y págala en la mesa o en la barra»
    con el botón de pedirla. Traducido también al inglés.

### Lo que falta para cobrar de verdad (es de Bryan)

1. **Claves de Stripe como secretos del proyecto de Casa Loli** — no pasan por
   el chat, se ponen desde el panel o con la CLI:
   ```bash
   npx supabase secrets set STRIPE_SECRET_KEY=sk_live_... --project-ref tesilntyomnovjcuieho
   npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_... --project-ref tesilntyomnovjcuieho
   ```
2. **Desplegar el webhook** (falta en este proyecto; solo están `registrar-fiscal`
   y `crear-checkout`):
   ```bash
   npx supabase functions deploy stripe-webhook --project-ref tesilntyomnovjcuieho --no-verify-jwt
   ```
3. **Dar de alta el endpoint en Stripe** → evento `checkout.session.completed`
   apuntando a
   `https://tesilntyomnovjcuieho.supabase.co/functions/v1/stripe-webhook`,
   y de ahí sale el `whsec_` del paso 1.

⚠️ Sin el **webhook** el cliente pagaría y **la mesa no se marcaría como
pagada**: el webhook es quien confirma el cobro (el navegador no decide).
