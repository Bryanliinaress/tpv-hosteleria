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

## Facturas por correo (Resend)

Las facturas salen del **servidor** (Edge Function `enviar-factura`) por
[Resend](https://resend.com), con el PDF adjunto. Todas las instalaciones envían
desde **un único dominio de envíos de la empresa**; el bar aparece como nombre
visible y **las respuestas le llegan a él**:

    De:            Casa Loli <facturas@envios.tu-empresa.es>
    Responder a:   info@casaloli.es      (Admin › Local → Correo del local)

Por qué un subdominio (`envios.`) y no el dominio principal: si algún envío
acaba marcado como spam, la reputación que se resiente es la del subdominio, no
la del correo de la empresa.

### Una vez (para todas las instalaciones)

1. Cuenta en Resend → **Domains → Add Domain** → `envios.tu-empresa.es`.
2. Resend enseña unos registros DNS (MX y TXT de SPF, y TXT de DKIM). Copiarlos
   **tal cual** en el DNS de `tu-empresa.es`, donde esté gestionado. Los nombres
   y valores exactos los da Resend: no inventarlos.
3. Recomendado: un TXT `_dmarc.envios` con `v=DMARC1; p=none;` para empezar.
4. Esperar a que Resend marque el dominio como **Verified**.
5. **API Keys → Create** con permiso de solo envío.

### En cada instalación (su proyecto de Supabase)

En **Edge Functions → Secrets**:

- `RESEND_API_KEY` — la clave. **Nunca** en el repositorio, en un commit ni en
  una nota de versión.
- `CORREO_REMITENTE` — `facturas@envios.tu-empresa.es` (el mismo en todas).

Y en la app, **Admin › Local → Correo del local**: sin él, las facturas salen
igual pero las respuestas no tienen a dónde ir (Admin avisa en «lo que falta»).

Sin los dos secretos, «📎 Enviar PDF» abre Compartir con el PDF adjunto, como
alternativa.
