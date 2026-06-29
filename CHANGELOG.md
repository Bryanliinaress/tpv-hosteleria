# Changelog

Todas las versiones relevantes de este proyecto se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/)
y el versionado sigue [SemVer](https://semver.org/lang/es/).

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
