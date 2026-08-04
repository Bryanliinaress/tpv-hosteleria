# Impresión térmica

Hay **tres formas** de imprimir, configurables por dispositivo en
**Admin → Ajustes → Impresión** (cada terminal puede usar la suya):

| Modo | Cuándo usarlo | Necesita |
|---|---|---|
| **USB directo (ESC/POS)** | Impresora enchufada al PC de barra | Chrome/Edge; elegir la impresora una vez |
| **Puente de red (ESC/POS)** | Impresora Ethernet, o varias estaciones | Ejecutar `scripts/puente-impresion.mjs` en un PC del local |
| **Diálogo del navegador** | Cualquier impresora con driver | Chrome en modo kiosko para no ver el diálogo |

Con **ESC/POS** la comanda sale al instante, sin diálogo, con **corte
automático**, **QR nativo** (más nítido y rápido que una imagen) y posibilidad
de abrir el **cajón portamonedas**. Es lo que usan los TPV comerciales.

## Opción 1 · USB directo (lo más simple)

1. Enchufa la impresora al PC y enciéndela.
2. Admin → Ajustes → Impresión → **USB directo** → *Elegir impresora USB*.
3. Selecciona la impresora en el diálogo del navegador (solo la primera vez).
4. Pulsa **Imprimir ticket de prueba**: debe salir con acentos y un QR.

> Solo funciona en Chrome/Edge de escritorio, y en HTTPS o localhost.

## Opción 2 · Puente de red (impresoras Ethernet)

El navegador no puede abrir sockets TCP, así que un pequeño programa hace de
intermediario. En un PC del local (puede ser el mismo de barra):

```bash
IMPRESORA=192.168.1.50 node scripts/puente-impresion.mjs
```

Al arrancar imprime su dirección (`http://IP-DEL-PC:9110`). Ponla en
Admin → Ajustes → Impresión → **Puente de red**. Comprueba con
`http://IP-DEL-PC:9110/estado` que responde.

Ventajas: una sola impresora sirve a varias tablets/PDAs, y no depende de que
ese navegador tenga permisos USB.

## Opción 3 · Diálogo del navegador (lo de siempre)

Sigue disponible y **es el modo por defecto**. Además funciona como red de
seguridad: si ESC/POS falla, la app cae automáticamente aquí para no dejar al
camarero sin comanda.

Para que no muestre el diálogo, Chrome en modo kiosko:

```
chrome.exe --kiosk-printing --app=https://bryanliinaress.github.io/tpv-hosteleria/app/#/print
```

## Qué comprar

- **80 mm** (el ticket está maquetado a ese ancho; las de 58 mm requieren ajuste).
- **Corte automático** — imprescindible para el ritmo de un servicio.
- **USB + Ethernet** si es posible: te deja elegir modo sin cambiar de hardware.
- Genérica 80 mm (~60-100 €) para empezar, o Epson TM-T20III (~180 €) si va a
  ser la definitiva.

## Detalles técnicos

- Los comandos se generan en `src/lib/escpos.js` (cubierto por 14 tests).
- Texto codificado en **CP858**: las térmicas no entienden UTF-8. Los caracteres
  sin equivalente se transcriben sin tilde en vez de imprimir basura.
- El transporte vive en `src/lib/impresora.js` y guarda la preferencia **por
  dispositivo** en `localStorage`, porque cada terminal del local puede imprimir
  en un sitio distinto.
