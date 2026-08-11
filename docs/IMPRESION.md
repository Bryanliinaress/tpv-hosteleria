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

### Varias impresoras: cocina, barra y caja

Lo normal en un restaurante montado: las comandas de comida salen por la
impresora de cocina, las de bebida por la de barra, y el ticket del cliente por
la de caja. Se declara una impresora por destino:

```bash
IMPRESORA_COCINA=192.168.1.50 IMPRESORA_BARRA=192.168.1.51 IMPRESORA_CAJA=192.168.1.52   node scripts/puente-impresion.mjs
```

La app manda el destino en cada impresión; el puente decide la máquina. Un
destino sin impresora configurada cae en `IMPRESORA` (o en la primera que haya):
**nunca se pierde una comanda por un destino sin declarar**.

### Impresora USB en Windows SIN ser administrador (lo más habitual)

Al enchufar una térmica USB, Windows le crea el puerto (`USB001`) pero **no una
cola**. Con estos dos pasos queda lista, sin instalar el disco del fabricante
—que además es contraproducente: su driver convertiría el ESC/POS en texto—:

1. **Crear la cola** con el driver genérico que ya trae Windows:
   ```powershell
   Add-PrinterDriver -Name "Generic / Text Only"
   Add-Printer -Name "TPV-Cocina" -DriverName "Generic / Text Only" -PortName "USB001"
   ```
   (para la segunda impresora, `USB002` y `TPV-Barra`)

2. **Decírselo al puente por su NOMBRE**, sin compartir nada:
   ```bash
   IMPRESORA_COCINA=TPV-Cocina IMPRESORA_BARRA=TPV-Barra node scripts/puente-impresion.mjs
   ```

Por qué así: compartir una impresora en Windows **exige permisos de
administrador**, y el dueño de un bar no tiene por qué tenerlos (aquí Windows lo
denegó al montarlo). Mandando los bytes a la cola con datatype **RAW**
(`scripts/imprimir-raw.ps1`) se imprime igual, sin compartir y sin elevación.

⚠️ Dos impresoras del mismo modelo se distinguen **por el puerto** (USB001 /
USB002), que Windows asigna según el orden en que se conectaron. Imprime una
etiqueta en cada una y **pégales una pegatina**: si algún día se reconectan en
otro orden, podrían intercambiarse.

### Dos impresoras USB en el MISMO PC

Es el montaje típico de un bar pequeño: las dos térmicas enchufadas al ordenador
de la barra. Se comparten en Windows (clic derecho sobre la impresora →
Propiedades → Compartir → nombre corto y sin espacios) y se declaran por nombre:

```bash
IMPRESORA_COCINA="\\localhost\Cocina" IMPRESORA_BARRA="\\localhost\Barra" node scripts/puente-impresion.mjs
```

El puente les manda los bytes **en crudo** (`copy /b`), sin pasar por el driver:
si pasaran por él, los comandos ESC/POS se convertirían en texto y saldría
basura en vez del ticket.

### Para probar con UNA sola impresora

No hace falta comprar dos para validar el reparto: apunta los dos destinos a la
misma máquina y verás salir por ella las comandas de cocina y las de barra, cada
una con su cabecera.

```bash
IMPRESORA_COCINA=192.168.1.50 IMPRESORA_BARRA=192.168.1.50   node scripts/puente-impresion.mjs
```

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
- El puente **espera a que los bytes salgan de verdad** antes de cerrar el
  socket (`end` + `close`, no `write` + cerrar): un ticket largo podía quedarse
  a medias.
- **Una impresión cada vez por impresora.** Dos comandas simultáneas por el
  mismo socket salen mezcladas en el papel; cada impresora tiene su turno y las
  demás no se esperan.
- **Reintenta 3 veces** (0,4 s y 0,8 s) antes de dar error: la térmica puede
  estar un segundo ocupada y perder una comanda es un plato que no sale.
