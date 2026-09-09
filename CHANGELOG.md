# Changelog

Todas las versiones relevantes de este proyecto se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/)
y el versionado sigue [SemVer](https://semver.org/lang/es/).

## [0.118.0] - 2026-09-09

### Añadido
- **La carta se gestiona desde la carta.** Los apartados (categorías) solo se podían crear y borrar, y encima desde otra pestaña, «Ajustes» — al lado de la configuración de la impresora, que no tiene nada que ver. Para añadir un formato había que salir de la carta, cambiar de pestaña, volver y buscar el producto otra vez. Ahora todo lo de la carta está **en la pestaña Carta**:
  - **➕ Nuevo apartado** al final de la lista, que es donde estás mirando cuando te das cuenta de que te falta uno.
  - **⚙️ en la cabecera de cada apartado**: renombrar, cambiar su icono (paleta de 34 emojis de bar, o escribe el que quieras) y elegir a dónde van sus comandas.
  - **▲ ▼ para ordenarlos.** Ese orden es el que ve el cliente al escanear el QR, y hasta ahora era el de creación y no había forma de cambiarlo.
  - **Opciones de los productos**, plegable al final: formatos, variedades, añadidos y cómo se llaman esos tres grupos en la carta. Es lo que vivía en «Ajustes», con una línea que explica dónde aparece cada cosa.
- **«comida / bebida» pasa a decir lo que de verdad significa: 🍳 Cocina / 🍺 Barra.** No es una etiqueta: es lo que decide por qué impresora sale la comanda y en qué KDS aparece. Elegirlo mal al crear el apartado **no tenía arreglo** —no se podía cambiar después— y mandaba los platos a la impresora de la barra. Ahora se cambia, y la pantalla dice la consecuencia antes de tocarlo.
- **Renombrar ya no cuesta la carta entera.** Antes, para corregir «Bocadilos» había que borrar el apartado — y borrar se lleva **todos sus productos**. Se corregía volviendo a teclear doce bocadillos.
- **Borrar un apartado dice cuántos productos se lleva por delante**, y ofrece **moverlos a otro** en vez de perderlos.

### Arreglado
- **Un apartado creado desde la app real se quedaba sin icono.** `addCategoria` de v2 no guardaba el emoji (la demo sí), así que en la carta del cliente esa sección salía sin nada delante. El mismo dato con otra forma a cada lado, otra vez.
- **Cambiar el destino de un apartado dejaba sus productos donde estaban.** En la demo cada producto guarda su propia copia del tipo: tocar solo el apartado habría dejado los bocadillos saliendo por la barra. Ahora arrastra a sus productos, y hay un test que lo vigila.

### Cambiado
- La pestaña **«⚙️ Ajustes» pasa a llamarse «🖨 Impresión»**: es lo único que le queda, y es lo que era en realidad.

## [0.117.0] - 2026-09-08

### Cambiado
- **Las tarjetas de arriba de Admin ya miden el negocio, no la base de datos.** Decían «Productos en carta 58» y «Categorías 3»: dos números que solo le importan a quien programa la carta, y que no cambian en una semana. Lo primero que mira un dueño al abrir el panel es **cuánto lleva hecho hoy**.

  Ahora: **Facturado hoy · Tickets hoy · Mesas ocupadas · Sin cobrar en sala**. Las devoluciones son tickets en negativo, así que restan solas. El corte del día es el del **local** (`esDelDia`), no el de UTC: un ticket cobrado a la 01:30 pertenece a ese día para quien cierra la caja — es el mismo desfase que mandó horas de la nómina al mes anterior.

  «Consumo activo» pasa a llamarse **«Sin cobrar en sala»**, que es lo que es: dinero servido y pendiente de cobro. El recuento de la carta sigue donde tiene sentido, en su pestaña.

## [0.116.0] - 2026-09-08

### Añadido
- **Renombrar un dispositivo ya autorizado.** El nombre se ponía una sola vez, al darle acceso, y ahí se quedaba. Con cuatro tablets iguales llamadas «Tablet», el encargado que va a quitarle el acceso a una no sabe cuál es — y quitárselo a la de cocina en mitad de un servicio se nota. Con **PIN de encargado**, como autorizar y revocar, y comprobado en el servidor: que la pantalla pida el PIN no sirve de nada si la RPC se puede llamar por su cuenta.
- **Ver para qué se usa cada aparato.** Un nombre dice lo que alguien *quiso*; lo que de verdad identifica a la tablet de cocina es que lleva semanas abierta en el KDS. Ahora cada aparato **apunta en qué pantalla está** al abrirla, y la lista lo enseña con la misma cara que lleva esa pantalla en su cabecera: «🍳 Se usa en Cocina · última vez hoy 13:40». Nueva columna `dispositivos.ultima_pantalla` y RPC `dispositivo_en_pantalla` (migración `20260908T41`), que solo puede tocar **su propia fila** — se busca por `auth.uid()`, así que un aparato no puede escribir sobre otro aunque llame a la función con lo que quiera.

### Arreglado
- **«Último uso» de una tablet que se usa a diario decía «hace tres semanas».** Solo se apuntaba al canjear el secreto por una sesión, o sea casi nunca — y ese dato es justo el que se mira para decidir a quién se le quita el acceso sin miedo. Ahora se refresca al abrir cualquier pantalla de personal.
- **Los `prompt()` y `confirm()` del navegador, fuera de la pantalla de dispositivos.** Una PWA instalada a pantalla completa en Android puede no enseñarlos: el encargado pulsaba «Autorizar» y no pasaba nada. Ahora usan los diálogos de la app, como el resto.

## [0.115.0] - 2026-09-08

### Añadido
- **Renumerar mesas.** No se podía: el número solo salía del orden en que se crearon, y un bar cambia la sala de sitio. Ahora se edita, y se comprueba: **dos mesas con el mismo número mandan platos a la mesa equivocada** —el número va en el ticket, en la comanda que sale por la impresora de cocina y en el QR de la pegatina—, así que un repetido se rechaza diciendo por qué. La rejilla va ordenada por zona y número, que es el orden de la sala, así se ve el cambio sin recargar.
- **Zonas de verdad, no texto libre.** La zona se escribía a mano en cada mesa: «Terazza» en una de doce creaba una zona fantasma… **que la reserva online le ofrece al cliente como si existiera**. Ahora se elige de la lista (o se crea a propósito, con «➕ Nueva zona…»).
- **Renombrar una zona la cambia en todas sus mesas de una vez.** A mano son doce ocasiones de escribirlo distinto. Una tarjeta nueva en Admin → Mesas enseña las zonas con cuántas mesas tiene cada una —que es lo que delata a la fantasma: la que tiene una sola— y renombra con un toque. No deja fundir dos zonas por descuido.

### Arreglado
- **Un campo que se quedaba escrito con lo que no se había guardado.** Al rechazar un valor, `CampoGuardado` dejaba en el hueco lo tecleado mientras la tarjeta seguía diciendo lo de antes («Mesa 5» arriba, «6» en el campo): parecía guardado. Ahora, si quien guarda dice que no, el campo vuelve a lo que hay de verdad.

## [0.114.0] - 2026-09-08

### Añadido
- **Un tercer rol: Cocina.** Había dos, Administrador y Camarero, y «camarero» era en realidad *«todo lo que no es Admin»*: el mismo PIN abría el **Mostrador** —donde se cobra, se anula y se devuelve— y la pantalla de cocina. En un bar con cocinero eso no vale: su PIN acaba pegado en la pared de la plancha.

  El rol **Cocina** entra en Cocina, Barra e Impresión, y **no** en Mostrador, PDA ni Administración. El camarero conserva todo menos Administración, a propósito: en un bar de dos personas la misma persona sirve y mira la plancha, y quitárselo sería estropear lo que hoy funciona por arreglar lo que falta.

  La tabla `empleados` ya admitía `'cocina'` desde la primera migración — faltaban la regla y poder elegirlo. **No hay migración**: solo aplicación.

- **Quien no tiene permiso ya no ve el teclado del PIN otra vez.** Volver a pedirlo a quien acaba de escribirlo bien es decirle «vuelve a intentarlo»: el cocinero lo teclearía tres veces antes de entender que su PIN no abre el Mostrador. Ahora ve quién es, con qué rol ha entrado, un botón a **la pantalla que sí es suya** y otro para entrar con otro PIN.

- La regla de **qué abre cada rol vive en un solo sitio** (`src/lib/roles.js`), que miran las rutas, el panel de personal y ese aviso. Un control de acceso escrito tres veces es un control de acceso donde alguien entra por donde no debe.

### Arreglado
- **Se podía dejar el local sin administrador.** La regla del último admin comparaba con `'camarero'` —escrita cuando solo había dos roles—, así que bajar al **último** administrador a *Cocina* colaba y nadie volvía a entrar en Administración. Ahora se mira que el rol nuevo sea admin, sea cual sea el otro.
- El alta de empleado en el backend real **forzaba** el rol a admin o camarero (`rol === 'admin' ? 'admin' : 'camarero'`): un empleado dado de alta como cocina se guardaba como camarero. Igual en la demo.

## [0.113.0] - 2026-09-08

### Arreglado
- **El arqueo mezclaba personas con formas de pago.** En «Por camarero» salía **«Pago online 34,20 €» junto a «QA 7,00 €»**, como si el pago online fuera un empleado: cuando el cliente paga desde su móvil no hay nadie detrás, y el servidor lo apunta con ese nombre porque ese hueco se queda vacío. Es un número que se mira para **cuadrar caja** y para saber quién maneja el dinero, y mezclado no sirve para ninguna de las dos cosas.

  Ahora la lista se llama **«Cobrado por cada persona»** y solo lleva personas; lo que pagó el cliente por el móvil va **separado, debajo de una línea**, con su explicación («no lo cobró nadie: no pasó por el cajón»), y lo que no lleva nombre sale como «Sin asignar». Separado, **no escondido**: si no saliera, la lista dejaría de sumar el total de la caja y el descuadre volvería a no significar nada. Hay un test que lo comprueba.

  La regla vive en `src/lib/caja.js` (`cobrosPorPersona`), con las demás cuentas del cajón, y no en la pantalla.
- **El mismo nombre asomaba en Informes → «Cobrado por»**, bajo la columna «Persona», y en el CSV que se lleva el gestor. Ahora dice «Pagó el cliente por el móvil» en los dos.

## [0.112.0] - 2026-09-08

### Añadido
- **Los «cobros sin cuenta» ya se pueden accionar.** El aviso decía que hay dinero que devolver y escupía la referencia de Stripe entera en texto corrido: para devolverla había que **copiar 60 caracteres a mano** de una pantalla táctil. Ahora cada cobro es una fila con su fecha y su importe, un botón **📋 Copiar** y un enlace **Devolver en Stripe ↗** que abre ese cobro en el Dashboard. El modo (pruebas o real) **sale del propio id** (`cs_test_…`), así que el día que el bar pase a producción no hay nada que acordarse de cambiar aquí.
- La referencia se enseña acortada (principio y final, que es lo que se compara de un vistazo) y **se abre entera al tocarla**, seleccionable a mano: es lo que queda cuando el navegador no deja copiar.

### Arreglado
- **«Copiado» que solo significaba «se ha pedido».** El botón de copiar la URL del QR de mesa hacía `navigator.clipboard?.writeText(url)` y cantaba «Dirección copiada» pase lo que pase: sin el `?.` no hay portapapeles fuera de un contexto seguro —el TPV abierto por **http** en la red del bar es uno—, y `writeText` puede fallar por permiso. Se decía copiado sin copiar, y quien pegara en Stripe pegaría lo que hubiera antes en el portapapeles. Ahora se comprueba (`src/lib/portapapeles.js`, con vía de emergencia para contextos no seguros) y **si no se pudo, lo dice**.

## [0.111.0] - 2026-09-08

### Añadido
- **Coger una reserva desde Admin (y desde la agenda del camarero).** Era el hueco funcional más visible del panel: un bar coge reservas **por teléfono todo el día** y `ReservasManager` solo sabía gestionar las que entraban solas por `/reservar`. Desde Mostrador sí se podía, pero eso es otra cosa: bloquea una mesa concreta en el acto, no crea una reserva de la agenda, y el cliente no recibe ni la confirmación ni el enlace para cancelarla o cambiarla.

  El botón **«➕ Nueva reserva (teléfono)»** abre el alta en la propia agenda: día, personas, zona, hora, nombre, teléfono, email y notas. El desplegable de horas enseña **cuánto queda libre en cada franja** («14:00 · 12 libres», «completo»), calculado con las mismas funciones de aforo que la reserva online. Si se deja email, sale la confirmación con su enlace de gestión, igual que la del cliente.

- **El alta del personal NO se bloquea por aforo ni por día cerrado**, al revés que la del cliente: avisa y deja pasar. La reserva online tiene que decir que no —si no, el bar se sobrevende sin enterarse—, pero al teléfono decide quien lo coge, que es justo quien sabe si cabe una mesa más o si ese lunes se abre. Una pantalla que le dice que no al encargado acaba con la reserva apuntada en un papel, que es donde se pierden. Nueva acción `crearReservaPersonal`, con su versión de servidor: va **por la tabla** (RLS del local) y no por la RPC pública, que rechaza los grupos de más de `maxPersonasOnline` — precisamente los que el bar manda llamar por teléfono.

### Arreglado
- **El correo que mandaba la agenda iba sin enlace de gestión.** `cargarReservas` no se traía la columna `token`, así que en la app real el «✉️ Confirmar» de la agenda componía el correo sin el enlace para cancelar o modificar: el cliente recibía una confirmación de la que no podía hacer nada. Solo lo tenía el navegador del cliente que acababa de reservar, en su copia local.

## [0.110.0] - 2026-09-01

### Añadido
- **Recordatorio de reserva automático.** Existían la plantilla y un botón «🔔 Recordar», pero había que pulsarlo reserva por reserva: en un bar eso no pasa, y es la palanca más eficaz contra el no-show. Peor: la nota de privacidad que el cliente acepta al reservar promete «(confirmación, cambios y **recordatorio**)» — se le prometía un correo que no llegaba.

  El vigilante lo manda solo, **4 horas antes** por defecto (`RECORDATORIO_HORAS`). No lo manda si la reserva está cancelada o ya sentada, si no dejó email, si ya se envió, si ya pasó, o **si se reservó dentro de la propia ventana** (reservar a la una para las tres y recibir el recordatorio a la una y media es recordarle lo que acaba de hacer). Nueva columna `reservas.recordatorio_en` (migración `20260901T40`) para no repetirlo en cada pasada.

  Si el envío falla **no se marca**: se reintenta en la siguiente pasada. Marcar un correo que no salió es perderlo.
- El texto de los correos se saca a **`src/lib/textosReserva.js`**, sin `window` ni store, para que lo compartan el navegador y el vigilante en vez de estar escrito dos veces.

### Pendiente de una decisión tuya
- **EmailJS bloquea de fábrica las llamadas fuera del navegador.** Verificado: el vigilante encuentra la reserva y compone el correo, pero EmailJS responde `403 · API access from non-browser environments is currently disabled`. Hay que habilitarlo en su panel (Account → Security). Como al habilitarlo la clave pública sola bastaría para mandar correos desde cualquier sitio, el vigilante manda además la **privada** como `accessToken` si se pone en `EMAILJS_PRIVATE_KEY`.

## [0.109.0] - 2026-09-01

### Añadido
- **El reintento de envío a Hacienda ya no depende de que alguien abra el panel.** Con Verifacti, un ticket solo se registra **el día que se emitió**: si el envío falla un martes por la tarde y nadie mira hasta el jueves, ese ticket no entra nunca. El reintento existía (`reintentarPendientes`) pero solo corría «al abrir Admin o a mano» — dependía de acordarse justo el día que hay que acordarse. En la demo se acumularon cinco así sin que nadie lo provocara.

  Nuevo **vigilante** (`scripts/lib/vigilante.mjs`) que cada 10 minutos reintenta lo del día y, cuando encuentra tickets de jornadas anteriores que ya no pueden entrar, lo **anota como incidencia** para que `npm run salud` lo cante. Nueva clase de incidencia `fiscal` (migración `20260831T39`).

  Vive dentro del proceso de impresión porque es el único que corre desatendido en el PC del bar — y ese PC está encendido exactamente cuando hace falta: mientras se sirve, que es la única ventana en la que un reintento puede funcionar.

  Reintenta **ticket a ticket** y no en lote: el lote saca el local del JWT y exige una sesión de personal que un proceso desatendido no tiene, mientras que la vía por ticket no la necesita. Así no hubo que relajar la seguridad de la Edge Function.

## [0.108.0] - 2026-08-31

Las dos son de las pantallas que **nadie está mirando**: el KDS cuelga de una
pared con el cocinero de espaldas, en la plancha.

### Arreglado
- **🔴 El reloj del KDS y los «hace X min» de cada comanda se congelaban.** Se calculan al pintar, y en una pantalla que nadie toca no hay nada que provoque un repintado: se quedaban clavados en la hora del último cambio. **Medido**: con el KDS abierto y sin actividad, la pantalla marcó 11:48 durante 1 min 41 s de reloj real. Un cocinero usa ese número para decidir a qué plato va primero — que diga «2 min» en uno que lleva veinte es peor que no ponerlo. Nuevo `useReloj`, también en Mostrador y en la PDA, que tienen el mismo cálculo.

### Añadido
- **El KDS avisa cuando entra una comanda**: pitido doble y un **🔔 COMANDA NUEVA** destellando en la cabecera durante 8 segundos, con la cabecera resaltada. Hasta ahora solo avisaba la PDA — la pantalla que ya lleva encima quien puede mirarla. El sonido se puede silenciar por aparato (🔔/🔕, recordado en el navegador): la tablet de cocina puede tenerlo y la de barra no.
- El aviso visual va **aparte** del sonido a propósito: el navegador bloquea el audio hasta que alguien toca la pantalla, y una tablet colgada lleva horas sin que nadie la roce. Si no suena, al menos la pantalla cambia.
- El pitido se saca a **`src/lib/aviso.js`** y lo comparten la PDA y los dos KDS, en vez de estar escrito en la PDA y copiado.

## [0.107.0] - 2026-08-31

### Arreglado
- **🔴 Se podía pagar un pedido que la cocina nunca había recibido.** La cuenta que ve el cliente incluye las líneas sin enviar —`_debe_por_comensal` no mira `lineas_pedido.estado`—, así que se podía añadir un plato, ir directo a Pagar sin pulsar «Enviar pedido», pagar por Stripe y marcharse: **el dinero entra y la comida no existe para nadie**. El flujo de cobro no comprobaba nada, ni enviaba, ni avisaba.

  Ahora se **manda a la cocina antes de cobrar**, nunca después: si el pago se abandona, un pedido pendiente de pagar es el estado normal de cualquier mesa; al revés no hay vuelta atrás. Vale para los tres caminos: pagar mi parte, pagar la cuenta entera y «que cobre el camarero». Si el envío falla, no se sigue cobrando y se avisa. Hay un test que lee el código para que un cuarto camino de cobro no se lo salte.

## [0.106.1] - 2026-08-31

### Arreglado
- **La tira de categorías de la carta del cliente se metía detrás de la cabecera.** Regresión de la v0.103.0: al pegar la cabecera a `var(--alto-aviso)` para que la banda de demostración no la cortara, la tira siguió anclada a la **altura** de la cabecera (85 px) en vez de a dónde termina (117 px), así que sus 32 px de arriba quedaban detrás y los chips salían cortados. El test que vigila las barras pegajosas no la cazó porque no usaba `top: 0`: ahora exige que **todo** lo pegajoso cuente con la banda, no solo lo que se anclaba a cero.

## [0.106.0] - 2026-08-31

El arqueo de caja. Y por el camino salió algo peor de lo que iba a arreglar.

### Arreglado
- **🔴 Admin → Local no podía guardar NADA.** `locales` era la única tabla del esquema cuya política de escritura exigía un `empleados.user_id = auth.uid()` con rol admin. Eso valía cuando cada persona entraba con su email y contraseña; con el modelo de dispositivos —cada aparato tiene su cuenta y quien identifica a la persona es el PIN— esa cuenta **nunca** está en `empleados`, así que la condición no podía cumplirse jamás y toda escritura se iba en un 403. En la práctica: nombre, dirección, **teléfono**, CIF, IVA, razón social y pie del ticket eran de solo lectura desde la app. El CIF que había puesto lo escribió el script de aprovisionamiento con la clave de servicio, no la pantalla — y por eso llevaba semanas en la lista de pendientes «rellenar teléfono y dirección en Admin → Local»: no se podía. Ahora `locales` va como el resto del esquema (`tenant_all` para `authenticated`), y que sea admin lo sigue exigiendo el PIN, igual que en las demás pestañas.
- **El descuadre del cierre Z no significaba nada.** El efectivo esperado era «ventas en efectivo + propinas en metálico», y por un cajón pasa mucho más: el **fondo de cambio** con el que se abre y sigue ahí al contar, lo que se **saca** para pagar al proveedor o llevar al banco, y el que se **mete** cuando se acaba el suelto. Con un fondo de 150 € el arqueo cantaba «sobran 150 €» todos los días, y un descuadre que siempre dice lo mismo se deja de mirar a la semana — que es peor que no tenerlo, porque parece que lo tienes.

### Añadido
- **Fondo de caja** configurable, y **entradas y salidas del cajón** con importe y motivo obligatorio (un movimiento sin motivo es dinero que desapareció sin explicación). Migración `20260831T37`. El cierre guarda el fondo y el saldo de movimientos, para poder releer un arqueo viejo sin recalcular nada.
- La cuenta vive en **`src/lib/caja.js`** y no en cada pantalla: la usan el arqueo que se ve en Admin, el cierre de la demo y el cierre contra el servidor.

## [0.105.0] - 2026-08-31

El registro de jornada, que es obligatorio por ley (RD-ley 8/2019) y hay que
conservar cuatro años.

### Arreglado
- **🔴 Las horas por empleado salían todas mezcladas en un solo total.** En v2 el fichaje solo trae `empleadoId` —el nombre no se hidrata—, y la pantalla agrupaba por `f.nombre`: cada línea decía «👤 undefined» y, peor, **todas caían en la misma clave**, así que el resumen sumaba las horas de toda la plantilla en un único «undefined». Es el número que va a la nómina. `empleados` ya se le pasaba a la pestaña, pero la firma no lo recogía. Ahora el nombre se resuelve contra la plantilla (`nombreDeFichaje`), y un empleado que ya no está sale como «Sin asignar» en vez de `undefined`.

### Añadido
- **Añadir una jornada que nadie fichó.** Se podían corregir fichajes pero no crearlos: si alguien olvidaba fichar la entrada del todo, esa jornada no existía para el registro y no había forma de meterla. Un registro legal en el que no puedes añadir lo que falta es un registro con agujeros.
- **Se distingue lo fichado de lo puesto a mano.** Las jornadas que toca el encargado salen marcadas con «✍️ a mano» en la lista y con una columna **Registro** en el CSV. La tabla ya guardaba `editado_por`; ahora se ve.

## [0.104.0] - 2026-08-31

Salió de repasar el panel de Admin pantalla por pantalla. Las dos son de la
pestaña de QR, que es la que usa el dueño **una vez**, el día que monta el bar —
y si sale mal, se descubre con las pegatinas ya pegadas.

### Arreglado
- **El QR de mesa se construía con la dirección desde la que se abría Admin** (`window.location`). Bastaba con entrar desde una build local o de pruebas para imprimir doce pegatinas apuntando a `localhost`, pegarlas en las mesas y no enterarse hasta que un cliente escanea. Ahora sale de la **dirección propia del local** (`despliegue.url` del perfil), que ya existía pero no llegaba al navegador. La pestaña enseña a qué dirección apuntan, para poder comprobarlo antes de imprimir; y si la instalación no tiene dirección propia lo avisa en vez de callarse.

### Añadido
- **«🖨 Imprimir todos»**: una hoja A4 con todos los QR, tres por fila, cada uno con el nombre del bar, el número de mesa y «Escanea para ver la carta y pedir», recortable por una línea de puntos. Antes había que copiar la dirección de cada mesa a mano — justo en el momento en que el dueño lo que quiere es llevar una hoja a imprimir.

## [0.103.1] - 2026-08-31

### Seguridad
- **Cinco vulnerabilidades altas en dependencias de desarrollo** (`brace-expansion`, `fast-uri`, `js-yaml`, `nanoid`, `postcss`), todas transitivas y todas resueltas sin cambio de API. Las de **producción ya estaban a cero** —que es lo que llega al bar—, pero estas corren en el CI y en la máquina de quien desarrolla. Ahora el árbol entero está a cero.

## [0.103.0] - 2026-08-31

Salió de mirar por fin **los KDS con comandas dentro**, que era lo último que
quedaba del repaso visual. Las pantallas están bien; lo que estaba mal era todo
lo que se les monta encima.

### Arreglado
- **El aviso de «Nueva versión» tapaba el reloj de la cocina.** Era `position: fixed` anclado arriba del centro, y ahí ya están la banda de demostración y la cabecera de cada pantalla. Se baja: cualquier píldora centrada arriba choca con una cabecera de ancho completo, así que bajarla quita el problema de raíz en vez de moverlo unos píxeles.
- **Cuatro cabeceras más seguían pegadas a `top: 0`** y quedaban cortadas por la banda de demostración al bajar: **KDS Cocina, KDS Barra, la carta del cliente y el detalle de mesa de la PDA**. En la v0.99.1 se arreglaron Admin y Mostrador y estas se quedaron fuera. Ahora las seis se pegan a `var(--alto-aviso, 0px)`, y hay un **test que lee el código** y no deja que vuelva a aparecer un `top: 0`.
- **El distintivo de «2º plato · sin marchar» se partía en dos líneas** en la columna estrecha del KDS —«2º» arriba y el resto abajo, encima del nombre del comensal— porque era un `span` inline sin `nowrap`.
- **«1 listos»**, en Cocina y en Barra. La misma falta que ya se corrigió con «1 comensales»: es lo primero que lee un hostelero al que le enseñas el producto.

### De paso quedó comprobado
- **El realtime entre dispositivos funciona**: el KDS estaba abierto y recogió las 7 comandas sin recargar.
- **El recorrido de una comanda**: en cola → Preparando… → Listo, con la columna «Listos» apareciendo al lado y el contador de la cabecera siguiéndolo.

## [0.102.0] - 2026-08-31

### Cambiado
- **Una mesa reservada ya no cuenta como ocupada.** Mostrador y la PDA decían «3 ocupadas de 4» metiendo dentro las reservadas, y la palabra en pantalla era literalmente «ocupadas». Engañaba en las dos direcciones: el bar parecía más lleno de lo que estaba, y no se veía cuántas reservas había encima. Ahora se lee **«2 ocupadas de 4 · 1 reservada»** (y en el encabezado de cada zona, «0/4 ocupadas · 1 reservada»); sin reservas no se añade nada, que sería ruido. El globo de «Mesas» de la PDA tampoco las cuenta: una reservada no necesita nada todavía.
- La regla vive en **`src/lib/sala.js`** (`estaOcupada`, `contarSala`, `resumenSala`) y no en cada pantalla: las dos enseñan el mismo número con las mismas palabras, y escrito dos veces una de las dos acaba diciendo otra cosa. Los estados se cuentan **por su nombre y no por descarte**, para que un estado nuevo no se cuele silenciosamente en «libres» y alguien siente ahí a un cliente.

## [0.101.0] - 2026-08-31

### Añadido
- **Tests de pantalla para las cuatro que faltaban**: PDA del camarero, Mostrador, Reservar y Onboarding. Eran las únicas sin cubrir y entre ellas están las dos que el personal toca a diario. **743 tests** (78 nuevos), 58 ficheros.
  - **PDA**: que abre en Mesas y no en Avisos (decisión que ya costó una corrección), el orden del feed —quien llama, luego lo listo, y la cuenta al final—, el «1 comensal» en singular, los globos de la barra inferior, y que el resumen del turno cuente solo lo de ese camarero y solo lo de hoy.
  - **Mostrador**: el recuento por zona y por estado, que tocar una mesa unida abra la cuenta de la **principal** y no una vacía, que la pista de juntar mesas cambie entre ratón («arrastra») y táctil («mantén pulsada»), y que el diálogo de unir no se ofrezca a sí misma ni a una reservada. Incluye un candado sobre el ancho mínimo de tarjeta (`minmax(132px, 1fr)`) para que no vuelva el descuadre de la v0.99.1.
  - **Reservar**: que una reserva **rechazada por el servidor no se enseñe como confirmada** —ni se mande el email, ni se apunte en el móvil—, la validación de nombre y email, el aviso de retención de datos (RGPD) y que el enlace del email no enseñe la reserva de nadie sin su token.
  - **Onboarding**: que rehacer la sala avise de que **los QR ya impresos dejan de servir**, que no deje pasar sin nombre de local, y que vaciar la carta se pregunte antes.

## [0.100.0] - 2026-08-28

### Añadido
- **La impresión avisa cuando no imprime.** `WritePrinter` solo confirma que el **spooler aceptó** los bytes, no que saliera papel: con la impresora apagada, sin papel o con el USB suelto, Windows los acepta igual y el trabajo se queda encallado en la cola. Así estuvo del **12 al 28 de agosto** — cada comanda marcada como impresa, el log escribiendo su `🖨`, y nueve trabajos muertos en la cola. Ahora `imprimir-raw.ps1` recoge el ID del trabajo (`StartDocPrinter`, que ya lo devolvía y se estaba tirando) y espera a que **desaparezca de la cola**, que es como Windows dice «esto ha salido por el puerto».
- **Un trabajo que no sale se cancela.** Si no se confirma, se quita de la cola: sin esto, cada reintento dejaba otro encallado y al reconectar la impresora salían todos de golpe.
- **Clase de incidencia `impresora`** (migración `20260828T36`): el servicio de impresión anota el fallo en la base y `npm run salud` lo saca junto a lo demás. Antes, una impresora muerta solo se notaba porque no llegaba la comida. Cuando vuelve a imprimir, lo dice en el log.

### Cambiado
- **Los fallos que no se arreglan insistiendo ya no se reintentan.** Un error marcado `noReintentar` —la impresora está apagada— se abandona al primer intento en vez de gastar tres: insistir a los 400 ms no la enciende. Del reintento se sigue encargando el repaso de pendientes, un minuto después.

### Arreglado
- `docs/AUDITORIA.md` abría con un **🔴 PENDIENTE DE APLICAR** sobre los suplementos que llevaba resuelto y verificado desde hacía semanas.

## [0.99.1] - 2026-08-26

### Arreglado
- **Un ticket cobrado en mostrador se reimprimía como «PENDIENTE DE PAGO»**: `cobrar_mesa` cerraba la mesa sin marcar a los comensales, así que el detalle guardado decía `pagado: false` para todos aunque el dinero hubiera entrado (`pagos` y el arqueo sí cuadraban). Al reimprimir desde Admin → Tickets, a un cliente que **ya había pagado** se le daba un papel diciendo que no. Nueva migración `20260826T35`: el comensal se marca antes de cerrar, respetando a quien ya hubiera pagado su parte y deduciendo el método del desglose (uno solo → ese; varios → `mixto`). Los tickets **ya emitidos no se reescriben** —son documentos fiscales—: el ticket los lee por su desglose de cobro, que es el apunte que usa el arqueo.
- **La banda de demostración cortaba la cabecera, y las pestañas desaparecían detrás**: banda, cabecera y tira de pestañas eran las tres `position: sticky; top: 0`, y tres elementos con el mismo `top` no se apilan, se superponen. Ahora cada una se pega debajo de la anterior midiendo el alto real de la de arriba (los altos cambian: la banda se acorta en móvil y la cabecera reparte sus botones en dos líneas). Afecta a Admin y a Mostrador.
- **Las fechas de Informes salían con mayúscula en cada palabra**: «Miércoles, 26 De Agosto», «Últimos 7 Días», «Tickets De Agosto». Era el `text-transform: capitalize` de CSS, que en español no vale: las preposiciones y los meses van en minúscula. Sustituido por `mayusculaInicial()`.
- **La rejilla de mesas de Mostrador perdía el cuadre al abrir el panel lateral**: el panel mide 340 px fijos y **encoge** la rejilla (es un hermano flex, no una hoja superpuesta), que pasaba de 5 columnas a 3 y dejaba una mesa suelta en su propia fila en cada zona. Con el ancho mínimo de tarjeta en 132 px caben 4 columnas con el panel abierto y 6 sin él: fila entera en ambos casos.
- **La portada decía «v0.44.0 · Demo en desarrollo»**, un literal escrito a mano que llevaba 55 releases sin tocarse en la primera pantalla que ve un cliente. Ahora sale de `package.json` (`__VERSION__`, inyectado por Vite) y la coletilla de demostración solo aparece si el local lo es.

## [0.28.1] - 2026-07-09

### Arreglado
- **Los fichajes (y tickets/anulaciones/cierres) ya no se pierden al sincronizar**: si otro dispositivo escribía su copia del estado casi a la vez, podía pisar un fichaje recién hecho (el botón "volvía a como antes"). Ahora esos registros «solo-añadir» se **fusionan** al recibir estado remoto: lo local reciente que el remoto no tiene se conserva. Mitiga el «último-que-escribe-gana» del estado compartido; la solución de raíz sigue siendo el backend por entidades (PRODUCCION.md §1-2).

## [0.28.0] - 2026-07-08

### Añadido
- **Fotos de productos**: cada producto puede tener una imagen (por URL), editable en Admin → Carta con **previsualización** en el formulario y miniatura en la lista. En la **carta del cliente** aparece como miniatura junto al plato y como **foto grande** en la hoja de personalización. Si una URL falla, la imagen se oculta sola. (La subida de archivos llegará con el backend/Storage.)

## [0.27.0] - 2026-07-08

### Añadido
- **Fichajes de jornada** (registro de jornada, RD-ley 8/2019):
  - El personal **ficha entrada/salida** desde su PDA (pestaña «Turno»): un toque abre el turno y otro lo cierra, con aviso del tiempo fichado.
  - Nueva pestaña **Admin → ⏱ Fichajes**: selector de mes, **horas trabajadas por empleado**, detalle por día con turnos abiertos marcados, **corrección de marcajes** por el admin (entrada/salida) y **export CSV** mensual por local. Todo sincronizado entre dispositivos.

## [0.26.0] - 2026-07-04

### Añadido
- **Onboarding del local** (`/setup`, solo admin): asistente de 5 pasos — identidad del local → sala por zonas (reconstruye las mesas con QRs correlativos) → equipo con PINs → carta (mantener la de ejemplo o empezar vacía) → resumen final. Deja un bar operativo en ~15 minutos.
- **Banner «Configura tu local»** en la portada mientras el local no haya completado la configuración inicial; desaparece al terminar (y el asistente sigue accesible en `/setup` para reconfigurar).
- Acciones nuevas del store: `configurarSala(zonas)` (protegida si hay mesas ocupadas) y `vaciarCarta()`. Tests incluidos (26 en total).

## [0.25.0] - 2026-07-03

### Añadido
- **Carta del cliente en inglés**: botón 🇬🇧/🇪🇸 en la vista del cliente que traduce toda la interfaz de pedido (bienvenida, carta, pedido, cuenta, pagos, personalización). La carta en sí queda en el idioma en que la escriba el local. Preferencia recordada por dispositivo.

## [0.24.0] - 2026-07-03

### Añadido
- **Auditoría de anulaciones**: al anular una línea (PDA/Mostrador) se pide el **motivo**, y queda registrado quién anuló qué, cuándo, el importe y si ya estaba enviada a cocina. Nueva tarjeta «Anulaciones» en Admin → Caja con el importe total anulado y las últimas operaciones. Registro sincronizado entre dispositivos.

## [0.23.0] - 2026-07-03

### Añadido
- **Pagos mixtos** al cobrar la mesa (PDA y Mostrador): opción «🧮 Mixto» — indicas la parte en efectivo y el resto va a tarjeta o Bizum. El ticket registra el **desglose real** por método.

### Arreglado
- El **descuento/invitación** del cobro ahora queda **registrado de verdad** en el ticket (importe descontado y total neto); antes solo afectaba a la pantalla y el ticket guardaba el total sin descontar.

## [0.22.0] - 2026-07-03

### Añadido
- **Editar pedidos ya enviados** (PDA y Mostrador): cambiar la cantidad de una línea aunque ya esté en cocina (la comanda se actualiza a la vez; a 0 se elimina) y **mover una línea a otro comensal** de la mesa (botón ⇄), reetiquetando la comanda. Imprescindible para corregir errores sin anular todo el pedido.

## [0.21.0] - 2026-07-03

### Añadido
- **Cancelar la llamada al camarero desde el móvil**: si el cliente ha avisado al camarero (🔔) y ya no lo necesita, puede tocar de nuevo el botón («🔔 Avisado ✕») para retirar el aviso. Con confirmación por toast en ambos sentidos.

## [0.20.0] - 2026-06-26

### Añadido
- **Carta genérica** (paso grande hacia «configurable para cualquier local»):
  - **Formatos editables**: añade/renombra/borra formatos (tamaños, raciones…) desde Ajustes; cada producto «por formatos» tiene un precio por formato (formulario dinámico en el Admin, con conmutador **precio único ↔ por formatos**).
  - **Extras con precio propio**: cada añadido tiene su precio (ya no 0,20 € fijo), editable en Ajustes y visible en la personalización del cliente y la PDA.
  - **Textos de personalización configurables**: «Pan / Tipo de pan / Extras» pueden renombrarse (una pizzería usaría «Tamaño / Masa / Ingredientes»).
- Compatibilidad total con la carta existente (los extras antiguos se normalizan a 0,20 €).

## [0.19.0] - 2026-06-26

### Añadido
- **Marchar platos por tiempos**: al tomar el pedido (PDA/Mostrador) cada plato puede marcarse como **1º (marcha ya), 2º plato o postre**. Los tiempos 2+ entran en cocina como **«en espera · sin marchar»** (atenuados, con etiqueta) y sala los lanza con el botón **«🔥 Marchar»** de la mesa (por orden: primero el 2º, luego el postre). Cocina también puede marchar manualmente una línea.

### Arreglado
- **Sincronización**: se ignora el eco Realtime de las escrituras del propio dispositivo, que podía pisar estado local más nuevo cuando había cambios rápidos seguidos.

## [0.18.0] - 2026-06-26

### Añadido
- **RGPD en reservas**: aviso de consentimiento en el formulario (los datos solo se usan para gestionar la reserva) con detalle desplegable de responsable, finalidad y conservación; y **borrado automático** de las reservas pasadas tras N días (configurable en Horarios y aforo, por defecto 30). Textos como plantilla, a validar por asesoría.

## [0.17.0] - 2026-06-26

### Añadido
- **Informes de ventas** (Panel Admin · pestaña «Informes»): KPIs del mes (facturado, tickets, ticket medio, comensales, propinas) y gráficas de ventas por día, top productos (unidades e importe), ventas por camarero, método de pago y ventas por hora. Sin librerías externas.

## [0.16.1] - 2026-06-26

### Mantenimiento
- **Tests automatizados** (vitest): 16 pruebas del núcleo — fusión de líneas de pedido, reparto de platos compartidos, grupos de mesas (unir/separar/cobrar), pagar toda la cuenta, cierre de caja, disponibilidad de reservas, PIN de empleados y deducción de alérgenos.
- **CI en GitHub Actions**: cada push a `develop`/`main` y cada PR corre tests y build.

## [0.16.0] - 2026-06-26

### Añadido
- **Unir mesas en pantallas táctiles** (tablet): mantén pulsada una mesa ~medio segundo y toca la mesa destino. Aparece un aviso flotante con la mesa en curso y botón de cancelar, y las mesas candidatas se marcan con borde discontinuo. El arrastre con ratón de escritorio se mantiene.

## [0.15.0] - 2026-06-26

### Añadido
- **PWA instalable**: la app se puede añadir a la pantalla de inicio en móvil/tablet (icono propio, pantalla completa, colores de marca) y el "shell" queda precacheado con un service worker de actualización automática — abre al instante incluso sin red (los datos siguen necesitando conexión para sincronizar). Iconos generados por script (`scripts/gen-icons.mjs`).

## [0.14.0] - 2026-06-26

### Añadido
- **Alérgenos por producto** (los 14 de declaración obligatoria en la UE): editables por producto en el Admin (chips en el formulario), visibles como iconos en la carta del cliente y con aviso detallado en la hoja de personalización del plato. La carta demo viene etiquetada automáticamente (gluten en montaditos, lácteos, huevos, pescado, sulfitos…).

## [0.13.1] - 2026-06-26

### Arreglado
- **Pagos**: cerrado el bug histórico del retorno de Stripe (la Edge Function ya devuelve a `#/mesa/:id` y el flujo está verificado de punta a punta); además se limpian las propinas huérfanas que pudieran quedar en el dispositivo.

### Documentación
- **PRODUCCION.md**: hoja de ruta completa de demo → restaurante real (bloqueantes críticos, fases, qué requiere terceros y orden de ataque).

## [0.13.0] - 2026-06-26

### Añadido
- **Pagar la cuenta completa** (un comensal paga por todos) aunque haya varios comensales en la mesa: en la vista de cuenta del cliente hay un botón **"Pagar toda la cuenta"** con selector de propina y pago online, además del pago por persona. Se cierra la mesa con un **único ticket**. (El personal ya podía cobrar la mesa entera desde el Mostrador.)

## [0.12.0] - 2026-06-26

### Añadido
- **Agrupar mesas con cuenta única**: para mesas grandes, varias mesas se pueden **unir en un grupo** que comparte **una sola cuenta**. Las mesas del grupo quedan ocupadas/bloqueadas (no se pueden abrir por separado) y sus **plazas se suman**. Al **cobrar o cerrar** el grupo, las mesas se **separan solas**.
  - En el Mostrador: **arrastra una mesa sobre otra para unirlas**, o usa "🔗 Unir con otra mesa"; "✂️ Separar mesas" para deshacer el grupo. Las fichas muestran el grupo (🔗), las plazas sumadas y "Unida a M#".

### Cambiado
- El gesto de arrastrar mesas en el Mostrador ahora **une mesas** (antes movía comensales). Para mover un único comensal sigue estando la PDA.

## [0.11.0] - 2026-06-26

### Añadido
- **Unir mesas arrastrando** en el mapa de sala del Mostrador: arrastra una mesa con comensales y suéltala sobre otra para **juntarlas** (o moverlas si la destino está libre). Pide confirmación y avisa con un toast. La mesa destino se resalta al pasar por encima.

## [0.10.0] - 2026-06-26

### Cambiado
- **Mapa de sala del Mostrador más vistoso y organizado**: las mesas se agrupan por **zona** (con contador de ocupadas por zona) y hay una **leyenda de estados** con su recuento. Las fichas de mesa se rediseñan con franja de color de estado, degradado sutil, plazas, comensales, tiempo ocupada, total y avisos de platos listos, con anillo de selección y realce al pasar el ratón.

## [0.9.0] - 2026-06-26

### Cambiado
- **El Panel Camarero pasa a ser el «Mostrador · TPV»**: el terminal fijo de escritorio que complementa a la PDA en lugar de duplicarla. Ahora permite:
  - **Abrir mesa** desde el mapa de sala (con el primer comensal) asignándola al empleado conectado.
  - **Tomar pedidos** con la carta a la vista.
  - **Cobro completo de mesa** (descuento, dividir e importe en efectivo con cambio), además del cobro por persona.
  - **Mover / juntar mesas** desde el propio panel.
- El cobro/atención queda registrado a nombre del **empleado de la sesión** (antes "Mostrador").

## [0.8.0] - 2026-06-26

### Cambiado
- **Avisos y diálogos propios** en lugar de los `alert`/`confirm`/`prompt` nativos del navegador: ahora son toasts (info/éxito/error) y ventanas de confirmar o pedir texto integradas en el estilo de la app (desenfoque, animación, color según el tipo). Las confirmaciones destructivas se muestran en rojo.
- Sustituidos en: Admin (cerrar caja, borrar producto/mesa/categoría/empleado), PDA (abrir mesa, anular línea), toma de pedidos (nuevo comensal), reservas (cancelar y envío de correos) y cliente (error de pago).

## [0.7.0] - 2026-06-26

### Añadido
- **Control de acceso por PIN** (nivel demo): cada empleado entra en las pantallas de personal con su PIN de 4 dígitos mediante un **teclado numérico**. Roles **administrador** y **camarero**.
- **Pantallas protegidas**: PDA, Panel Camarero, Cocina, Barra e Impresión exigen un empleado **activo**; el Panel Admin exige rol **administrador**. La carta del cliente por QR sigue abierta.
- **Gestión de personal** (Panel Admin · pestaña «Personal»): alta y baja de empleados, cambio de rol y de PIN, y activar/desactivar sin perder la ficha. El padrón se sincroniza entre dispositivos y una baja revoca el acceso al instante.
- **Cerrar sesión** en todas las pantallas de personal (con el empleado conectado a la vista).

### Cambiado
- La PDA del camarero ya **no pide solo el nombre**: usa la sesión del empleado autenticado.

> Nota: es control de acceso de **demostración** (vive en el estado, sin backend de autenticación ni cifrado). La autenticación real con backend, roles y datos aislados por local queda para la fase de producción (ver ROADMAP).

## [0.6.0] - 2026-06-26

### Añadido
- **Identidad del local configurable** (Panel Admin · pestaña «Local»): nombre, subtítulo, dirección, teléfono, CIF, **% de IVA**, **moneda** y **pie de ticket**, con vista previa en vivo del encabezado del ticket. Los datos se guardan y se sincronizan entre dispositivos.
- El nombre del local aparece ahora en la pantalla de identificación del cliente, en la página de reservas y en la cabecera de Admin.

### Cambiado
- El **ticket** usa los datos configurables del local; se elimina el «CASA LOLI» y el IVA del 10 % que estaban fijos en el código. Primer paso hacia una carta/ticket válidos para cualquier bar.

## [0.5.1] - 2026-06-26

### Mantenimiento
- **CI/CD**: las acciones del workflow de despliegue a GitHub Pages se actualizan a las versiones que corren sobre **Node 24**, eliminando el aviso de deprecación de Node 20 (`actions/checkout` v7, `actions/setup-node` v6, `actions/configure-pages` v6, `actions/upload-pages-artifact` v5, `actions/deploy-pages` v5). Sin cambios funcionales en la aplicación.

## [0.5.0] - 2026-06-26

### Cambiado
- **Lavado de cara completo de la interfaz** (solo visual, sin cambios de lógica):
  - Nuevo **sistema de diseño** global: paleta slate más profunda, tipografía **Inter**, fondo con gradientes ambientales, sombras y radios reutilizables, foco visible, feedback de pulsación, scrollbar fina y animaciones.
  - **Inicio** rediseñado: hero con título en degradado y roles agrupados por contexto en tarjetas con elevación.
  - **Pantallas de personal** (Cocina, Barra, PDA, Camarero, Admin): cabeceras fijas con degradado, tarjetas con profundidad, navegación con efecto cristal y pulso de alerta en comandas demoradas.
  - **Modales y hojas** (personalizar plato, cobro, método de pago, tickets, mover/juntar, cajones laterales): desenfoque de fondo, animaciones de entrada, asa en las hojas y sombras elevadas.
  - **Reservas** (público, calendario y gestor) alineadas al mismo estilo.

## [0.4.0] - 2026-06-25

### Añadido
- **Gestión de la reserva por el cliente desde el email**: cada reserva lleva un enlace seguro (con token) para **cancelar o modificar** la reserva desde cualquier dispositivo.
- **Email de cancelación** al cliente cuando se cancela la reserva (lo cancele él o el personal).
- Modificar reabre el asistente con los datos rellenos y guarda los cambios sobre la misma reserva.

## [0.3.5] - 2026-06-25

### Cambiado
- Se quita el botón **No-show** de la gestión de reservas; una reserva que se libera simplemente se **cancela**.

## [0.3.4] - 2026-06-24

### Cambiado
- La reserva pide **teléfono (opcional) y email (obligatorio)**. El email sigue siendo el único canal de comunicación; el teléfono queda como dato de contacto para el local.

## [0.3.3] - 2026-06-24

### Cambiado
- En la reserva se pide **email** (obligatorio y validado) en lugar del teléfono.

### Añadido
- **Correo de confirmación automático** al reservar, vía **EmailJS** (sin backend). Si no está configurado, degrada con elegancia.
- Botones de **confirmación y recordatorio por email** en la gestión de reservas (admin/camarero).
- Variables `VITE_EMAILJS_*` documentadas en `.env.example`.

## [0.3.2] - 2026-06-24

### Cambiado
- **Flujo de reserva reordenado** para que sea coherente: personas → **zona** → día → hora → datos. La zona se elige **antes** que la hora porque condiciona la disponibilidad.
- **Disponibilidad por zona**: las horas que se ofrecen reflejan el aforo de la zona elegida (las de "me da igual" usan el aforo total del local).
- **Selector de día con mini calendario mensual** (con navegación de mes, días pasados y cerrados deshabilitados) en lugar de chips.

## [0.3.1] - 2026-06-24

### Cambiado
- **Formulario de reserva rediseñado** como asistente guiado en 4 pasos (personas → día → hora → datos): botones grandes, mínimo texto a escribir y pensado para cualquier edad/móvil.
- Selector de día visual (Hoy/Mañana + próximos días, días cerrados deshabilitados) y horas por turno.
- Resumen editable (toca para volver a un paso), indicador de progreso, enlace «añadir a mi calendario» y gestión compacta de «mis reservas».

## [0.3.0] - 2026-06-24

### Añadido
- **Disponibilidad de reservas**: turnos (comida/cena…), intervalo, duración, aforo y días cerrados configurables desde Admin.
- **`/reservar` con horas reales**: solo ofrece slots libres según horario y **aforo** (control de overbooking por solapamiento de turnos); bloquea grupos mayores al máximo online.
- **Vista de servicio**: timeline por día con barra de ocupación por franja (comensales/aforo) y nombres por slot.
- **Confirmación por WhatsApp** desde la gestión y **cancelación de la reserva por el propio cliente**.

## [0.2.0] - 2026-06-24

### Añadido
- **Métodos de pago** al cobrar (efectivo / tarjeta / Bizum), por comensal y por mesa completa.
- **Cierre de caja / arqueo (Z)**: pestaña «Caja» en Admin con ventas del día, desglose por método y por camarero, efectivo contado y descuadre.
- **Atribución a camarero**: las comandas y los cobros quedan asociados a quién los hizo.
- **Reservas online** estilo CoverManager: página pública `/reservar` (día, hora, personas, zona preferida) con confirmación inmediata.
- **Gestión de reservas** en Admin (pestaña «Reservas») y Camarero (panel lateral): asignar mesa, sentar, cancelar y no-show.

## [0.1.0] - 2026-06

### Añadido
- TPV base con carta y sala configurables y sincronizadas (Supabase Realtime).
- Vista de cliente con QR, Panel Camarero, PDA, KDS de cocina y barra.
- Tickets imprimibles (comanda, cuenta de mesa y por persona) y estación de impresión automática.
- Pago online con Stripe (modo prueba).

[0.4.0]: https://github.com/Bryanliinaress/tpv-hosteleria/releases/tag/v0.4.0
[0.3.5]: https://github.com/Bryanliinaress/tpv-hosteleria/releases/tag/v0.3.5
[0.3.4]: https://github.com/Bryanliinaress/tpv-hosteleria/releases/tag/v0.3.4
[0.3.3]: https://github.com/Bryanliinaress/tpv-hosteleria/releases/tag/v0.3.3
[0.3.2]: https://github.com/Bryanliinaress/tpv-hosteleria/releases/tag/v0.3.2
[0.3.1]: https://github.com/Bryanliinaress/tpv-hosteleria/releases/tag/v0.3.1
[0.3.0]: https://github.com/Bryanliinaress/tpv-hosteleria/releases/tag/v0.3.0
[0.2.0]: https://github.com/Bryanliinaress/tpv-hosteleria/releases/tag/v0.2.0
[0.1.0]: https://github.com/Bryanliinaress/tpv-hosteleria/releases/tag/v0.1.0
