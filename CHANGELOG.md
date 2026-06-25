# Changelog

Todas las versiones relevantes de este proyecto se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/)
y el versionado sigue [SemVer](https://semver.org/lang/es/).

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

[0.3.5]: https://github.com/Bryanliinaress/tpv-hosteleria/releases/tag/v0.3.5
[0.3.4]: https://github.com/Bryanliinaress/tpv-hosteleria/releases/tag/v0.3.4
[0.3.3]: https://github.com/Bryanliinaress/tpv-hosteleria/releases/tag/v0.3.3
[0.3.2]: https://github.com/Bryanliinaress/tpv-hosteleria/releases/tag/v0.3.2
[0.3.1]: https://github.com/Bryanliinaress/tpv-hosteleria/releases/tag/v0.3.1
[0.3.0]: https://github.com/Bryanliinaress/tpv-hosteleria/releases/tag/v0.3.0
[0.2.0]: https://github.com/Bryanliinaress/tpv-hosteleria/releases/tag/v0.2.0
[0.1.0]: https://github.com/Bryanliinaress/tpv-hosteleria/releases/tag/v0.1.0
