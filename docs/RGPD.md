# RGPD — borrador para validación por asesoría

> ⚠️ **BORRADOR.** Estos textos y el mapa de tratamientos están preparados para
> que la asesoría del local los **valide y complete** (huecos marcados con
> `【…】`), no para publicarse tal cual. Base: RGPD (UE) 2016/679 y LOPDGDD
> 3/2018. Última revisión: 2026-07-14.

## 1. Mapa de tratamientos (registro de actividades, art. 30)

| Tratamiento | Datos | Base legal | Conservación | Dónde viven |
|---|---|---|---|---|
| **Reservas online** | nombre, email, teléfono, nº personas, notas | Ejecución de medidas precontractuales (art. 6.1.b) | Configurable, por defecto **30 días** tras la fecha de la reserva (purga automática ya implementada) | Supabase (UE 【confirmar región del proyecto】) |
| **Pedido en mesa (QR)** | nombre de pila del comensal, consumo | Ejecución de contrato (art. 6.1.b) | Se borra al cerrar la mesa; en el ticket queda **solo el nombre de pila** como snapshot | Supabase |
| **Tickets / facturación** | consumo, importes, método de pago, nombre de pila | Obligación legal fiscal (art. 6.1.c) | **4-6 años** (normativa fiscal/mercantil 【confirmar plazo con asesoría】) — NO se purga con las reservas | Supabase |
| **Fichajes de jornada** | empleado, entradas/salidas | Obligación legal (art. 6.1.c, RD-ley 8/2019) | **4 años** (ya indicado en la app) | Supabase |
| **Pagos online** | los gestiona Stripe; el TPV no ve nº de tarjeta | Ejecución de contrato (art. 6.1.b) | Según Stripe | Stripe (encargado) |
| **Registro fiscal Verifactu** | datos de factura | Obligación legal (art. 6.1.c, RD 1007/2023) | Según norma | Verifacti (encargado) 【pendiente de alta】 |

**Responsable**: el titular de cada local (nombre comercial, NIF, dirección,
email de contacto — se rellenan con la identidad configurada en Ajustes → Local).
**Encargados de tratamiento**: Supabase Inc. (hosting BBDD), Stripe Payments
Europe (pagos), Verifacti (registro fiscal), 【EmailJS u otro si se activa el
email de confirmaciones】. Firmar/aceptar los DPA de cada uno 【asesoría:
verificar DPA y transferencias internacionales; con Supabase elegir región UE】.

No hay decisiones automatizadas ni elaboración de perfiles. No se ceden datos a
terceros salvo obligación legal (AEAT vía Verifactu).

## 2. Política de privacidad (texto para la web/carta QR)

> **Protección de datos — 【NOMBRE DEL LOCAL】**
>
> **Responsable**: 【nombre y NIF】, 【dirección】, 【email de contacto】.
>
> **Qué datos tratamos y para qué**:
> - *Reservas*: nombre, email y teléfono, para gestionar tu reserva,
>   confirmártela y avisarte de cambios.
> - *Pedido en mesa*: el nombre que escribes al unirte a la mesa, para
>   distinguir las comandas y dividir la cuenta.
> - *Pago con tarjeta*: lo procesa Stripe; nosotros no vemos tu número de
>   tarjeta.
>
> **Base legal**: la gestión de tu reserva o pedido (art. 6.1.b RGPD) y las
> obligaciones fiscales de facturación (art. 6.1.c RGPD).
>
> **Conservación**: los datos de reserva se eliminan automáticamente a los
> 【30】 días de la fecha de la reserva. Los datos del pedido se eliminan al
> cerrar la mesa; los justificantes de venta se conservan los años que exige
> la normativa fiscal.
>
> **Tus derechos**: puedes ejercer acceso, rectificación, supresión, oposición,
> limitación y portabilidad escribiendo a 【email】. Si crees que no te hemos
> atendido bien, puedes reclamar ante la AEPD (aepd.es).

## 3. Texto de consentimiento en el formulario de reservas

Ya implementado en la app (pantalla de reserva, paso "datos"); texto vigente:
información básica + conservación configurable. 【Asesoría: revisar que la capa
informativa cumpla el art. 13 — responsable, finalidad, plazo, derechos — y si
conviene checkbox explícito o basta la capa informativa al ser 6.1.b】.

## 4. Pendiente de implementación (cuando lo valide la asesoría)

- [ ] Página `/privacidad` en la app con el texto del §2 y enlace desde la
      carta QR y el formulario de reservas.
- [ ] Campo de identidad del local para el email de contacto RGPD (Ajustes).
- [ ] Procedimiento de ejercicio de derechos (buscar/borrar reservas por email
      desde Admin — el borrado manual ya existe).
- [ ] Con el backend multi-tenant: verificación de región UE del proyecto
      Supabase y aceptación de su DPA.
