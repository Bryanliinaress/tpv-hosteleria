# Pagos online por QR (Stripe)

El cliente puede pagar su parte desde el móvil con tarjeta o Bizum, sin esperar
al camarero. **Está desactivado por defecto**: se enciende con
`VITE_PAGOS_ONLINE=1` en el build, y solo cuando el local tenga su cuenta.

> El pago online es un **extra**. Un bar funciona perfectamente cobrando en
> efectivo y con su datáfono: todo eso ya está en el TPV.

## Por qué hay un webhook (y no basta con el navegador)

Al volver de Stripe, el navegador trae un "he pagado" en la URL. Fiarse de eso
tiene dos fallos graves:

- Si el cliente **cierra el móvil** justo después de pagar, el TPV nunca se
  entera: dinero cobrado y cuenta marcada como pendiente.
- Una **URL manipulada** podía marcar como pagada una cuenta sin cobrar.

Por eso Stripe avisa **servidor a servidor** (`supabase/functions/stripe-webhook`),
con **firma criptográfica** que se verifica antes de tocar nada. Esa es la
fuente fiable del cobro; el retorno del navegador ya solo sirve para enseñar
"¡gracias!" al cliente.

El registro es **idempotente**: Stripe reintenta sus avisos si algo falla, y un
mismo pago no puede cobrarse dos veces ni generar dos tickets (tabla
`pagos_online`, con la referencia de la sesión como clave única).

## Puesta en marcha

1. Crear cuenta en [stripe.com](https://stripe.com) y activar **Bizum** en el
   panel si se quiere (Checkout muestra automáticamente los métodos activos).
2. Guardar los secretos en el proyecto de Supabase:
   - `STRIPE_SECRET_KEY` — clave secreta (empieza por `sk_`).
   - `STRIPE_WEBHOOK_SECRET` — la da Stripe al crear el webhook (`whsec_`).
3. Desplegar las funciones:
   ```bash
   npx supabase functions deploy crear-checkout --project-ref TU_REF
   npx supabase functions deploy stripe-webhook --project-ref TU_REF --no-verify-jwt
   ```
   El webhook va con `--no-verify-jwt`: quien llama es Stripe, no un usuario, y
   la autenticidad se comprueba con la firma.
4. En Stripe → Developers → Webhooks, añadir el endpoint
   `https://TU_REF.supabase.co/functions/v1/stripe-webhook` con el evento
   **`checkout.session.completed`**.
5. Aplicar la migración `20260804T10_pagos_online.sql`.
6. Construir con `VITE_PAGOS_ONLINE=1`.

### Probar sin cobrar de verdad

Con las claves de **test** (`sk_test_…`) y la tarjeta `4242 4242 4242 4242`
(cualquier fecha futura y CVC). Stripe CLI permite reenviar los avisos al
entorno local:

```bash
stripe listen --forward-to https://TU_REF.supabase.co/functions/v1/stripe-webhook
```

## Y el dinero, ¿a quién llega?

Tal cual está, a **una** cuenta de Stripe. Para vender el TPV a varios bares
hace falta **Stripe Connect**: cada local conecta su cuenta y **recibe sus
cobros directamente**, sin que el dinero pase por la tuya (lo cual es también
lo correcto legal y fiscalmente).

Eso requiere que cada negocio complete el alta en Stripe (datos fiscales y
cuenta bancaria). Cuando llegue el momento, el cambio en el código es pequeño:
añadir `stripe_account` a la creación de la sesión y guardar el id de la cuenta
conectada en la configuración del local.

## Costes

~1,5 % + 0,25 € por operación (tarjeta europea). Sale a cuenta en cuentas de
mesa (12 € → ~3,6 %), no en un café suelto: por eso conviene ofrecerlo **junto
al cobro normal**, nunca como única opción.
