# Changelog

Todas las versiones relevantes de este proyecto se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/)
y el versionado sigue [SemVer](https://semver.org/lang/es/).

## [0.133.0] - 2026-09-11

### Cambiado
- **La factura por correo sale del servidor (Resend), no de EmailJS.** El plan gratuito de EmailJS no adjunta archivos, así que «📎 Enviar PDF» nunca iba a mandar el PDF solo. Ahora la pantalla genera el PDF y lo pasa a una Edge Function nueva (`enviar-factura`), que lo manda con Resend desde el **dominio del bar**: llega a la bandeja de entrada en vez de a spam, y la clave vive como secreto del servidor, no en la web.

  - La función **comprueba** que la factura es del local del aparato, que el archivo es un PDF de verdad y que el correo es válido. **El texto lo escribe el servidor** con los datos de la factura: el dominio del bar solo puede mandar facturas, no cualquier cosa.
  - **Una factura rechazada por Hacienda no se manda**: primero se corrige.
  - **Cada envío queda apuntado** (`envios_factura`, migración `20260912T49`): a quién, cuándo y si falló.
  - **Sin configurar** (secretos `RESEND_API_KEY` y `CORREO_REMITENTE` en Supabase), el botón sigue como antes: Compartir con el PDF adjunto o descargarlo. Un **error de verdad** —factura rechazada, dominio sin verificar— se enseña como error y no abre Compartir, para que nadie crea que salió.

### Quitado
- La plantilla de EmailJS para facturas (`VITE_EMAILJS_TEMPLATE_FACTURA_ID`) y su paso en el deploy: con el plan gratuito no podía funcionar. EmailJS sigue mandando los correos de reservas.

## [0.132.1] - 2026-09-11

### Arreglado
- **El deploy no pasaba la plantilla de EmailJS de facturas al build.** `VITE_EMAILJS_TEMPLATE_FACTURA_ID` estaba en el código y en `.env.example`, pero el workflow de GitHub Pages no la reenviaba: aunque se creara la plantilla con el adjunto y su secreto en el repositorio, la web publicada seguiría sin verla y «📎 Enviar PDF» seguiría abriendo Compartir en vez de mandar el correo solo.

## [0.132.0] - 2026-09-11

### Añadido
- **✏️ Corregir y reenviar una factura que Hacienda ha rechazado.** Pasó con la F-1 de prueba: nombre «t» con un NIF real. Hacienda comprueba que el nombre del destinatario casa con su NIF, y si no, la rechaza. Y la factura se quedaba atascada: no se puede editar (a propósito), los reintentos repetían el mismo error y el ticket ya no admitía otra.

  Ahora la factura rechazada **se ve**: el botón del ticket dice «📄 F-1 ⚠ rechazada» y, al abrirla, un aviso rojo con el motivo exacto de Hacienda y **«Corregir datos y reenviar»**. Se abre el mismo formulario de siempre ya relleno —con el buscador de clientes guardados—, se corrige y se reenvía **con el mismo número y la misma fecha**: como Hacienda la rechazó, nunca llegó a constar.

  - **Solo se corrige una rechazada.** Una aceptada ya es un documento fiscal y no se toca; una pendiente aún no ha tenido respuesta. Lo comprueba el servidor.
  - **Reenviar lo mismo no arregla nada**, así que no deja: «Son los mismos datos que rechazó Hacienda».
  - **Queda constancia** de qué ponía antes, qué pone ahora, por qué se rechazó y quién lo cambió (`correcciones_factura`): una factura que cambia de titular es justo lo que hay que poder explicar en una inspección.
  - **Al reenviarla**, se manda otra vez a Verifacti. Verifacti valida el NIF contra el censo de Hacienda *antes* de mandarla —por eso el rechazo llega al momento y sin registro—; si aun así contesta que ya la tiene, se envía como **subsanación** de un registro rechazado (`PUT /verifactu/modify` con `rechazo_previo`).
  - El formulario avisa ahora bajo el nombre: **«Tal como consta en Hacienda: si no casa con el NIF, la rechaza»**.

  Migración `20260912T48`. `corregir_factura` es solo para el personal.

## [0.131.0] - 2026-09-11

### Añadido
- **👥 Clientes de factura guardados.** El que pide factura suele volver: el comercial de los martes, el taller de enfrente, la empresa de la comida de Navidad. Al emitir, la casilla **«Guardar este cliente para la próxima vez»** (marcada por defecto) lo guarda, y la próxima vez aparece arriba del formulario: se busca por nombre («talleres») o por un trozo de NIF («B123»), sin mirar tildes ni puntos, y **un toque rellena nombre, NIF, domicilio y correo**. Si alguien teclea a mano un NIF que ya está guardado, se le ofrece «Usar sus datos» en vez de escribirlos otra vez con otra errata.

  Un NIF es un cliente: si vuelve con otro domicilio, se actualiza el suyo en vez de duplicarlo, y un correo vacío no borra el que ya tenía. Se guarda **en la misma transacción que la factura** (migración `20260912T47`): no queda un cliente guardado de una factura que falló, ni al revés.

  ⚠️ **Datos personales (RGPD).** Un DNI y un domicilio son datos de una persona: se guardan solo para facturarle y se **borran desde Admin › Caja › Clientes de facturas**, sin llamar a nadie. Borrar al cliente no toca sus facturas ya emitidas, que son documentos fiscales y llevan sus datos dentro.

### Cambiado
- **El correo lleva la factura en PDF adjunta, no un enlace.** Es lo que espera una gestoría: un enlace a una web es algo que un departamento de administración no abre. El PDF se genera en el propio aparato, en A4, con lo mismo que la factura impresa —y el QR de Verifactu cuando ya consta en Hacienda—, pasa a otra página si hay muchas líneas y pesa unos pocos KB. Además hay **⬇️ Descargar PDF** junto a Imprimir.

  El PDF se escribe sin librerías (fuentes estándar de PDF con codificación WinAnsi, que tiene el «€» y todas las tildes): no añade peso al mostrador y el mismo código sirve en Node.

  **Para que se envíe solo** hace falta una plantilla de EmailJS con el adjunto configurado —se hace en su panel, no desde el código— y ponerla en `VITE_EMAILJS_TEMPLATE_FACTURA_ID` (ver `.env.example`). Mientras no esté, «📎 Enviar PDF» abre el menú **Compartir** del sistema con el PDF ya adjunto para elegir Gmail, Outlook o WhatsApp, y si el aparato no puede, descarga el PDF y abre el correo para adjuntarlo.

## [0.130.0] - 2026-09-11

### Añadido
- **🧾 Facturas: «¿me haces factura?».** Desde el Mostrador (🧾 Cerradas hoy) y desde Admin › Caja › Tickets del mes, cualquier ticket cobrado se convierte en una **factura completa** con el nombre o razón social, el NIF y el domicilio del cliente. Al emitirla se abre la factura con **🖨️ Imprimir** (en A4) y **✉️ Enviar por correo**; si el ticket ya tiene factura, el botón la abre (📄 F-12) en vez de emitir otra.

  ⚠️ **No es una venta nueva.** Cada cobro ya es una factura simplificada (el ticket, F2) registrada en Hacienda. La factura completa es la MISMA consumición con los datos del cliente, y se registra como **F3** —«emitida en sustitución de facturas simplificadas»— apuntando al ticket. Una factura aparte (F1) declararía la venta dos veces. Por eso tampoco es un ticket más: no entra en el arqueo, ni en los informes, ni en «facturado hoy». Va en su propia tabla, con **su serie (F) y su numeración correlativa sin huecos**, con el mismo contador bloqueado que los tickets.

  - **El NIF se comprueba de verdad**: DNI, NIE y CIF con su letra o dígito de control. La AEAT rechaza un NIF que no existe, y eso se descubre cuando el cliente ya se ha ido con el papel.
  - **Lo que pide la ley en una factura completa**: emisor y cliente con NIF y domicilio, número y serie, fecha, líneas, base y cuota por cada tipo de IVA, y a qué ticket sustituye. Las líneas se **agrupan** —en la comida de empresa «4× Menú del día» es una línea, no cuatro repartidas por comensal— y el desglose sale de la **misma función** que el ticket, para que la factura y el F2 no digan bases distintas.
  - **Todo se congela al emitir**: si mañana cambia el nombre del local o el IVA de un producto, la factura de hoy sigue diciendo lo que dijo. Y no se puede editar: solo la escribe `emitir_factura`.
  - **Por correo** va con la plantilla de EmailJS que ya existe (asunto y mensaje: no hay que tocar nada) y un **enlace** a la factura para verla, imprimirla o guardarla en PDF desde el móvil o la gestoría. El enlace lleva un token de 64 caracteres y abre esa factura y ninguna otra. Sin EmailJS configurado, se abre el programa de correo con todo escrito.
  - **Registro en Hacienda**: por la misma Edge Function y con los mismos reintentos que un ticket. Si el ticket al que sustituye aún no consta en la AEAT, la factura **espera** sin gastar intentos y entra en el siguiente reintento. `npm run salud` avisa también de facturas sin registrar.

  **Lo que no se puede hacer (y dice por qué):** facturar dos veces el mismo ticket, facturar una devolución, o facturar un ticket que ya tiene devoluciones — ahí la AEAT exige F1 y no F3, que es otro documento. Y hace falta el **CIF y la dirección fiscal del local** (Admin › Local): sin eso, la pantalla lo dice antes de pedir los datos del cliente.

- **Un ticket con factura ya no ofrece «↩ Devolver».** La devolución emite una rectificativa R5, que corrige el ticket; pero con factura, el ticket está sustituido por ella y lo que habría que rectificar es la factura (R1–R4), un circuito que todavía no existe. Mejor un «no se puede» claro en el mostrador que un registro fiscal que no cuadra. Lo impide también el servidor, con un trigger sobre `tickets` (migración `20260911T46`), venga la devolución de donde venga.

  Migración `20260911T45`. `emitir_factura` es solo para el personal; las funciones que tocan el registro fiscal, solo para el servidor; al cliente solo se le abre `factura_por_token`. En la demo funciona entero salvo el registro en Hacienda.

## [0.129.0] - 2026-09-11

### Cambiado
- **Tomar pedido en el Mostrador, rehecho para pantalla grande.** Se abría la pantalla de la PDA —una columna de 520 px pensada para usarse con una mano— en mitad del monitor, con la sala asomando por los lados: un producto por fila a todo lo ancho, los apartados en una tira y lo pedido escondido en un pie que solo salía al pedir algo.

  Ahora la pantalla se reparte como se trabaja en una barra:
  - **a la izquierda, los apartados de la carta**, siempre a la vista y con cuántos productos tiene cada uno;
  - **en el centro, los productos en rejilla.** La tarjeta **entera** es el botón —no un «+» pequeño en una esquina— y lleva un **número con lo que ese comensal ya lleva pedido**, para no marcar dos veces el mismo café. Los que tienen opciones lo dicen («opciones ›», «menú ›») y abren una ventana centrada, no una hoja de lado a lado del monitor;
  - **a la derecha, la comanda de la mesa entera**, con cada línea y su detalle («Pitufo · sin queso»), el tiempo (1º/2º/postre), los − y +, lo que ya se envió, «✍️ Fuera de carta» y el botón de enviar, siempre a la vista.

  **Con teclado:** se escribe «semilargo» y **Enter lo añade** y deja el buscador listo para el siguiente. Solo si no hay duda: con «café» y cinco cafés, Enter no añade uno que nadie ha elegido — avisa de cuántos coinciden. **Escape** cierra de dentro afuera: la ventana de opciones, luego la búsqueda, y solo entonces la pantalla.

  En un móvil (menos de 900 px) sigue saliendo la versión de una mano de la PDA, que ahí sí es la buena. Y los laterales crecen con la pantalla: con anchos fijos, en una tablet apaisada de 1024 px la rejilla del centro se quedaba en una sola columna.

### Arreglado
- **«Enviar 2 a cocina/barra» enviaba 5.** El botón contaba solo lo del comensal elegido, pero enviar manda lo pendiente de **toda la mesa**. Con dos comensales pidiendo a la vez, el camarero veía «2» y a cocina salían los cinco platos. Ahora cuenta y suma la mesa entera, en la PDA y en el Mostrador, y la PDA avisa «+ 3 de otros comensales, que también salen al enviar».

## [0.128.0] - 2026-09-10

### Añadido
- **💶 Cambiarle el precio a una línea.** Pasa todos los días: el menú del día se cobra a precio de menú aunque los platos vengan de la carta, se le hace precio a la mesa grande de doce, se rebaja el plato que salió tarde, o el de la pizarra se tecleó mal.

  Hasta ahora la única salida era **anular la línea y volver a meterla**, que deja una anulación falsa en la auditoría y una comanda repetida en cocina. Ahora se cambia en el sitio, con el botón **€** de la propia línea.

  ⚠️ **Cambiar un precio es, literalmente, la forma en que el dinero se va de un bar sin que nadie robe nada.** Así que no es un `update` a secas: pide **motivo** —como al anular— y deja registro de **qué línea, cuánto valía, cuánto vale, quién y por qué**, en una tabla nueva (`cambios_precio`, migración `20260910T44`). Se mira en **Admin › Caja › Cambios de precio**, al lado de las anulaciones, porque se miran por lo mismo y a la vez.

  **No se toca una línea ya cobrada**: ese importe está dentro de un ticket registrado en la AEAT, y cambiarlo dejaría la cuenta y el ticket diciendo cosas distintas. Para eso está la rectificativa. Lo comprueba el servidor, no solo la pantalla.

  Y como todo lo que pone precios a mano, la función está concedida **solo a `authenticated`**: comprobado contra la base real, con la clave anónima responde `permission denied`.

### Arreglado
- **La fila de una línea, con un botón más, se aplastaba a 375 px.** Con el nuevo **€** eran cinco botones peleándose con el nombre del plato. Ahora el nombre tiene una base de ancho y los botones —con su importe— se bajan juntos a su propia línea, en vez de dejar el precio solo en una tercera.

## [0.127.0] - 2026-09-10

### Añadido
- **✍️ Fuera de carta: cobrar algo que no tiene ficha.** Desde el Mostrador se añade una línea con **nombre, precio y cantidad** a mano: la sugerencia que se escribió esta mañana en la pizarra, el descorche de la botella que trajo el cliente, la tarta de cumpleaños, el suplemento de terraza.

  Hasta ahora había dos salidas y las dos malas: cobrarlo **por fuera del TPV** —y lo que se cobra por fuera no sale en el ticket, ni en el arqueo, ni en Hacienda— o dar de alta un producto de la carta que el cliente del QR ve esa misma noche.

  La línea va a la comanda y al ticket como cualquier otra. Hay que decir **si lo hace la cocina o la barra**, que no es un detalle de color: es lo que decide por qué impresora sale y en qué KDS aparece. Y a **0 €** también se puede: la invitación de la casa es una línea que alguien prepara, no un olvido de cobro.

  ⚠️ **Aquí el precio lo pone una persona**, y eso es justo lo contrario de lo que hace el cliente del QR, donde el precio lo resuelve siempre el servidor desde la carta. Por eso vive en una RPC nueva (`personal_agregar_libre`, migración `20260910T43`) **concedida solo a `authenticated`**: comprobado contra la base real, llamándola con la clave anónima responde `permission denied`. El servidor vuelve a validar nombre, precio (0 – 999,99 €), cantidad y tipo — que la pantalla avise no sirve de nada si la RPC se puede llamar por su cuenta.

  El precio se teclea **con coma** («4,50»), como en España: en un campo numérico la coma se pierde y «4,50» llega como «450». Es el mismo fallo que tuvo el IVA en la v0.122.0, arreglado de raíz aquí.

- **📤 «Enviar a cocina/barra» en la propia mesa.** Lo pendiente (el punto naranja) solo se enviaba desde la pantalla de tomar pedido. Una línea añadida por cualquier otro camino —o el carrito a medias de un cliente del QR— se quedaba ahí sin que nadie en el mostrador lo viera. Ahora el botón aparece en la mesa en cuanto hay algo sin enviar, y dice cuántas unidades son.

## [0.126.0] - 2026-09-10

### Cambiado
- **«🔗 Dispositivos» vuelve a tener su propia pestaña.** En la v0.123.0 la metí dentro de Local, plegada, con el argumento de que es «cómo está montado el bar» y se toca al montarlo. Es verdad a medias: también es **la salida de emergencia** cuando un aparato se queda fuera, y ahí dentro costaba encontrarla justo en el peor momento. La configuración de impresión sí se queda en Local, que esa sí se toca una vez.

### Añadido
- **De quién es cada aparato.** Un dispositivo ya decía cómo se llama y para qué se usa; ahora se le puede poner dueño: «la PDA de María». Con cuatro tablets iguales, eso es lo que dice **a quién dejas sin aparato** al quitarle el acceso — o qué aparatos eran de quien ya no trabaja aquí.

  «Sin asignar» es una respuesta válida, no un hueco por rellenar: el aparato fijo de la barra no es de nadie en particular. Se cambia con **PIN de encargado**, como renombrar o revocar, y comprobado en el servidor.

  ⚠️ **Es información, no permisos.** Asignarle un aparato a María **no** hace que ese aparato entre como María ni le dé sus permisos: quien identifica a la persona sigue siendo **el PIN**. La pantalla lo dice con esas palabras, para que nadie lo dé por hecho.

- **Dar de baja a un empleado no deja sin acceso a su aparato**: la columna es `on delete set null`, no `cascade`. Comprobado contra la base creando un empleado, asignándole un aparato y borrándolo: el aparato siguió `aprobado`, solo se quedó sin dueño. Nueva columna `dispositivos.empleado_id` y RPC `asignar_dispositivo` (migración `20260910T42`).

## [0.125.0] - 2026-09-09

Segunda vuelta a la carta. La v0.118.0 arregló los **apartados**; esto es lo mismo un nivel más abajo, en los **productos**.

### Añadido
- **▲▼ para ordenar los productos dentro de su apartado.** Los apartados ya se ordenaban, pero los productos salían en el orden en que se dieron de alta — y ese es el orden en el que el cliente los lee al escanear el QR. Un bar quiere el bocadillo estrella arriba, no el último que metió.

  Se mueven **entre los de su apartado**, no entre vecinos de la lista: intercambiar con el de al lado a secas cambiaría un producto de apartado al llegar al borde, que no es lo que pide nadie al pulsar una flecha. Y buscando no se enseñan: una lista filtrada no es el orden de la carta.

- **Duplicar un producto (⧉).** Montar una carta son ocho bocadillos que solo cambian el relleno: sin esto, cada uno es teclear otra vez precio, formatos, alérgenos e IVA. La copia se coloca **detrás del original** —que es donde se busca—, se lleva todo salvo el id, y **nace disponible**: copiar el agotado de ayer para crear el plato de hoy no puede traerse el «agotado» puesto.

  El nombre lleva «(copia)» a propósito: dos productos con el mismo nombre son dos líneas idénticas en la carta del cliente y una comanda en la que no se sabe cuál pidió. Así se ve que falta renombrarlo.

- **Aviso de agotados con «🔄 Reponer todo».** Lo agotado se marca durante el servicio —se acabó la tortilla— y se repone al día siguiente, todo de golpe. Devolverlo producto por producto es la clase de tarea que se olvida, y un plato que sigue «agotado» tres días después es dinero que no se vende. El aviso dice cuántos son y cuáles, porque **el cliente no los ve en la carta**.

### Arreglado
- **Con seis botones en la fila, el nombre del producto se quedaba en una letra por línea** a 375 px: «Aceite y tomate» ocupaba tres líneas. Es el mismo fallo que tenía la lista de dispositivos (v0.116.0): con una base de ancho, en un móvil los botones se bajan solos a su propia línea.

## [0.124.0] - 2026-09-09

### Añadido
- **La agenda dice qué reclama atención AHORA MISMO.** Listaba las reservas del día ordenadas por hora, todas pintadas igual: la de las 22:00 exactamente como la que entra por la puerta en diez minutos y no tiene mesa asignada. A las 14:10 de un sábado, lo que el encargado necesita saber son dos cosas:
  - **Quién llega enseguida** —y si tiene mesa, porque asignarla con el cliente delante es la diferencia entre sentarlo y tenerlo de pie—. Si alguna de las que están al caer no tiene mesa, sale destacado y con su nombre.
  - **Quién se ha retrasado**, para decidir si esperar o soltar la mesa.

  Va en una franja encima de la agenda, y **cada tarjeta de la lista lleva la misma marca** («🔔 en 11 min», «⌛ 26 min tarde») para saber cuál de las doce es.

- La falta de mesa **solo se avisa en las que están al caer**: que la reserva de las 22:00 no tenga mesa a las 14:10 no es un problema, es que aún no toca. Un aviso que salta con lo que no urge se aprende a ignorar, y entonces no sirve para lo que sí.

- **Los minutos se recalculan solos** (`useReloj`, cada 10 s). Se calculan al pintar, así que sin esto se quedarían congelados en la hora en que alguien tocó la pantalla por última vez — es exactamente lo que le pasaba al reloj del KDS (v0.108.0), y una agenda que dice «en 11 min» de algo que fue hace media hora es peor que no decir nada.

La regla de qué está «al caer» y qué «se retrasa» vive en **`src/lib/agenda.js`**, con test: las sentadas y las canceladas no reclaman nada, y el orden es por hora, que es el orden en que entran por la puerta.

## [0.123.0] - 2026-09-09

### Arreglado
- **🔴 El IVA del local se podía guardar mal, y los tickets salían con «IVA (0%)».** La regla que sanea lo que se escribe en Admin → Local **existía solo en la demo**: en la app real, `updateLocal` era `actualizarConfig(cambios)` a pelo. Dos de esos campos son dinero:
  - **El IVA**. El campo era `type="number"`, que en un teclado español **se come la coma**: escribir «10,5» dejaba el hueco vacío, y vacío se guardaba como **0**. Todo el que lee ese dato hace `Number(ivaPct) || 0`, así que el ticket de pantalla, el recibo del cliente y **el papel de la impresora** salían con «IVA (0%)» y la base igual al total. No fallaba nada: salía mal y con buena cara, en una factura simplificada.
  - **La moneda**. Borrar el campo dejaba `""` y los importes salían sin símbolo.

  Ahora la regla vive en **`src/lib/local.js`** y la comparten la demo y la app real, el campo del IVA acepta la coma (como el efectivo contado del arqueo) y **vacío ya no es 0**: se rechaza diciendo que dejarlo así pondría «IVA 0%» en todos los tickets, y el campo vuelve a lo que había.

### Cambiado
- **Local pasa a ser «cómo está montado este bar»**: absorbe las dos pestañas que quedaban sueltas y que son de lo mismo — se tocan al montar el sitio y casi nunca más.
  - **🔗 Aparatos con acceso** (era la pestaña «Dispositivos»).
  - **🖨 Impresión** (era la pestaña «Impresión»), que es cómo imprime **este** dispositivo.

  Las dos, plegadas. Con esto el panel baja de **9 pestañas a 7**.
- **El aviso de lo que falta, arriba del todo y diciendo dónde se nota cada hueco**: «la dirección · sale en el ticket y el recibo del cliente», «el teléfono · sale en “Llámanos” de la página de reservas». Antes miraba tres campos, estaba enterrado dentro de la tarjeta y no decía para qué sirve ninguno. Ahora también vigila el **IVA**, y marca como **fiscal** los dos que exige una factura simplificada: el CIF y el IVA.

## [0.122.0] - 2026-09-09

### Añadido
- **Informes de cualquier rango de fechas: «📅 Otras fechas».** Solo había cinco botones (hoy, ayer, 7 días, este mes, mes pasado). El gestor pide «del 1 al 15» y el dueño quiere ver «el sábado pasado», y no había forma: tocaba mirar el mes entero y hacer la resta a mano.

  El **«hasta» es inclusivo**, que es como lo entiende quien lo escribe: pedir «al 15» trae el 15 entero. Por dentro se le manda al servidor el día siguiente a las 00:00, porque consulta con el fin exclusivo — sin eso, el último día del informe sale siempre a cero y nadie entiende por qué.

- **Cada cifra se compara con el periodo anterior**: «↓ 11% respecto al periodo anterior, que hizo 177,00 €». Un número solo no dice nada — «1.240 €» solo significa algo al lado de lo que se hizo la semana anterior, que es la pregunta que se hace quien abre esta pantalla. El periodo de comparación es el de la **misma duración pegado justo antes**: de «los 7 días que acaban hoy» salen «los 7 anteriores», y de septiembre sale agosto con **sus** días, no con 30 fijos.

  Si en el periodo anterior no hubo ventas **no se enseña un porcentaje**: dividir entre cero daría «+∞ %», que no informa de nada. Se dice que no había nada con qué comparar.

### Arreglado
- **El CSV se llamaba siempre igual.** `informe-mes.csv` para todos los meses: al bajar el de agosto y luego el de septiembre, el segundo pisaba al primero en la carpeta de descargas y el gestor abría el que no era. Ahora el nombre lleva el periodo («informe-del-1-de-septiembre-al-15-de-septiembre-de-2026.csv»), y la cabecera de dentro también.

## [0.121.0] - 2026-09-09

### Cambiado
- **La caja se ordena por lo que hay que hacer, no por lo que hay que consultar.** Era una rejilla con cuatro tarjetas grandes desplegadas a la vez —arqueo, cierre, movimientos del cajón y anulaciones—, y lo único que se hace a diario, **cuadrar y cerrar**, quedaba enterrado entre listas que se miran una vez al mes. Ahora:
  - **Arriba, lo que reclama algo HOY**: los cobros sin cuenta que hay que devolver y el **estado fiscal** — «tickets sin registrar en Hacienda» hay que atenderlo **el mismo día** o ya no entran (aviso que estaba escondido en la pestaña de Tickets).
  - **En medio, la caja abierta y el cierre Z.**
  - **Plegado, lo que se consulta**: los tickets del mes, el cajón, los cierres anteriores y las anulaciones.
- **La pestaña «🧾 Tickets» desaparece: un ticket es el justificante de un cobro.** Se viene aquí a reimprimir uno o a **devolver dinero**, que es una operación de caja — sale del cajón o vuelve a la tarjeta. Tenerlo en otra pestaña obligaba a saltar en mitad de cuadrar. Va plegado dentro de Caja, con todo lo de antes (devolver, reintentar un reembolso que no llegó, ver el ticket).

### Añadido
- **Buscador de tickets por número o por mesa.** Con sesenta tickets en un mes, encontrar «el nº 47» o «el de la mesa 3» era bajar scrolleando. Busca en los del mes en curso —el historial se baja por ventana, no entero— y lo dice cuando no encuentra nada, para no hacer creer que ese ticket no existe.

### Arreglado
- **Una caja sin ventas pero con movimientos no se podía cerrar.** El botón exigía al menos un ticket, así que un lunes en el que no se vende nada pero se sacan 50 € para pagar al del pan dejaba ese movimiento **colgando en la caja abierta para siempre**, ensuciando el arqueo de los días siguientes. Ahora se puede cerrar con ventas **o** con movimientos, y el aviso de confirmación lo dice con esas palabras.
- Los bloques que se mudaron a plegables **repetían su título**: «Entradas y salidas del cajón · 1 en esta caja» y justo debajo, otra vez, «Entradas y salidas de caja · 1 en esta caja». Ahora el título lo pone solo el plegable.

## [0.120.0] - 2026-09-09

### Añadido
- **El panel de personal dice lo que hace falta saber de un vistazo: quién está en turno AHORA y cuántas horas lleva cada uno.** Ninguna de las dos cosas se veía: para saber si a María se le había quedado el turno abierto había que salir de Personal, irse a la pestaña de fichajes, elegir el mes y buscar su nombre entre los fichajes de todos. Ahora cada persona es una ficha con su rol, su **🟢 En turno desde…** si lo tiene, y sus **horas del mes**. Arriba, cuántos hay dentro ahora mismo.
- **Un turno abierto no suma horas.** Contarlas «hasta ahora» pondría en la nómina un número que cambia solo cada vez que se mira la pantalla. La cuenta vive en `src/lib/fichajes.js` (`jornadaDe`), con test — es el mismo número que una vez salió de todos juntos bajo un mismo «undefined» (v0.105.0).
- **Quien ya no trabaja aquí no estorba entre los que sí.** Los inactivos se agrupan en «Sin turno», plegado. No se borran: su ficha hace falta para el registro de jornada, que hay que **conservar cuatro años**, y ahora el diálogo de eliminar lo dice.
- **Cambiar el rol, el PIN o dar de baja vive detrás del ⚙️ de cada ficha**, que son cosas que se hacen una vez. Antes estaban los cinco controles apretados en una fila.

### Cambiado
- **La pestaña «⏱ Fichajes» desaparece: el registro de jornada es de las personas que hay en Personal.** Vive plegado al final de la pestaña, con lo mismo de antes (corregir, añadir una jornada que nadie fichó, exportar el CSV). **El mes lo manda la pestaña entera**: si el resumen de cada persona dijera un mes y la lista de abajo otro, los dos números no cuadrarían y no habría forma de saber cuál estás mirando. El resumen «Horas por empleado» que había ahí sobra: ahora está en la ficha de cada uno.

### Arreglado
- **El nombre de un empleado se guardaba en CADA TECLA.** Escribir «María» eran **cinco peticiones** al servidor, y la que llegara la última mandaba: con la red lenta podía quedarse en «Marí». Ahora se guarda al salir del campo, como el resto del panel, y lo dice.

## [0.119.0] - 2026-09-09

### Añadido
- **La sala se ve por zonas, no como una rejilla plana.** Con tres zonas y doce mesas no se veía dónde empieza la terraza: la zona solo existía como un texto dentro de cada mesa. Ahora cada zona es una sección con **cuántas mesas y cuántas plazas tiene** —que es su aforo para la reserva online, el número que decide hasta cuántos comensales puede reservar un cliente que elige «Terraza»—, y las zonas salen ordenadas por su **mesa más baja**: la zona donde está la mesa 1 va primero. Alfabéticamente, «Terraza» iría detrás de «Interior» aunque la terraza sean las mesas 1 a 4, y eso no es la sala.
- **Añadir mesas de verdad: cuántas, de cuántas plazas, en qué zona y desde qué número.** «+ Añadir mesa» creaba UNA, de cuatro plazas, en «la zona de la última mesa de la lista» — que es la que sea. Montar un bar de doce mesas eran doce clics y luego doce ediciones. Se comprueban **todos** los números antes de crear ninguna: dar de alta cuatro y fallar en la quinta deja la sala a medias y al encargado sin saber cuáles entraron. Y **la zona se puede crear ahí mismo**, sin tener que crear la mesa en otra y luego moverla.
- **`+ Mesa aquí` en cada zona**, que abre el alta con esa zona ya puesta.
- **Quitar una zona sin perder sus mesas.** Una zona no es una tabla: es lo que hay escrito en sus mesas. Ahora se puede decir «estas N mesas se mudan a X» y la zona desaparece — antes había que cambiarlas de una en una, doce ocasiones de dejarse una por el camino, y una zona con una sola mesa suelta es justo la que la reserva online le ofrece al cliente como si fuera un sitio de verdad.
- **Las mesas sin zona salen juntas al final**, en su propia sección, para que se vean y se les ponga una. Antes se perdían entre las demás.

### Cambiado
- **La pestaña «📱 QR Codes» desaparece: los QR son de las mesas.** Cada mesa enseña **su propio QR** con un toque (con el enlace y el botón de copiarlo), que es lo que hace falta cuando cambias una mesa de sitio o la renumeras — su pegatina es lo siguiente que hay que reimprimir. Y la **hoja A4 para imprimirlas todas** vive plegada al final de Mesas, con el aviso de la dirección y el botón de imprimir. Sale igual que antes: las mismas doce pegatinas recortables, ni una de más.

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
