# Correos de reserva (EmailJS)

La app envía confirmación, recordatorio y cancelación de reservas desde el
navegador con [EmailJS](https://www.emailjs.com) (200 correos/mes gratis).
Variables en `.env`: `VITE_EMAILJS_SERVICE_ID`, `VITE_EMAILJS_TEMPLATE_ID` y
`VITE_EMAILJS_PUBLIC_KEY`.

## ⚠️ La plantilla hay que limpiarla

EmailJS crea las plantillas con un texto de ejemplo en inglés:

> *A message by {{name}} has been received. Kindly respond at your earliest convenience.*

Ese texto **sale en los correos reales** delante del mensaje de la reserva
(y como la app no envía `name`, queda como *"A message by  has been received"*).
Hay que **borrarlo** en emailjs.com → Email Templates.

## Plantilla recomendada

| Campo | Valor |
|---|---|
| **Subject** | `{{asunto}}` |
| **To email** | `{{to_email}}` |
| **From name** | `{{from_name}}` (la app envía el nombre del local) |
| **Reply-To** | el email del local |
| **Content** | solo esto: |

```
{{mensaje}}
```

Con eso el correo sale tal cual lo compone la app, ya formateado y firmado con
el nombre del local. Nada más en el cuerpo.

## Variables que envía la app

`to_email`, `to_name`, `asunto`, `mensaje`, `tipo`, `fecha`, `hora`,
`personas`, `zona`, `local`, `from_name`.

## Detalles aprendidos

- **EmailJS escapa el HTML de las variables**: una fecha `04/08/2026` llegaba
  al asunto como `04&#x2F;08&#x2F;2026`. Por eso las fechas se envían en texto
  ("4 de agosto de 2026"). Evita meter `/`, `<`, `>` o `&` en las variables.
- Si el destinatario no existe, Gmail devuelve un rebote al remitente: normal
  al probar con direcciones inventadas.
- Sin EmailJS configurado, la app abre el cliente de correo (`mailto:`) como
  alternativa, salvo en flujos automáticos.
