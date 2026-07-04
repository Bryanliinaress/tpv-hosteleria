# Probar la impresión térmica (con lo que ya hay)

La estación de impresión (`/print`) ya imprime comandas automáticamente usando
la impresión del navegador. Para que salga **sin diálogo** (silenciosa) se usa
Chrome en modo kiosko. Esto se puede probar HOY con cualquier impresora térmica
con driver de Windows.

## Qué comprar (si aún no hay impresora)

- **Ancho 80 mm** (el ticket está maquetado a 80 mm). Las de 58 mm valen pero
  habría que ajustar el CSS.
- Con **driver de Windows** (casi todas las genéricas lo traen) y a poder ser
  **conexión Ethernet/LAN** además de USB — la red nos servirá después para la
  fase ESC/POS (tarea #16) sin cambiar de hardware.
- Opciones: genérica 80 mm USB+LAN (~60-100€) para probar, o Epson TM-T20III
  (~180€) si va a ser la definitiva. Con **corte automático** mejor.

## Puesta en marcha (10 minutos)

1. **Instala la impresora** en el PC de barra/cocina con su driver y márcala
   como **impresora predeterminada** de Windows.
2. En las preferencias de impresión del driver: papel 80 mm, sin márgenes
   extra, corte al finalizar (si lo soporta).
3. **Lanza Chrome en modo kiosko de impresión** con el acceso directo de abajo
   (o crea uno): imprime directo a la predeterminada, sin diálogo.
4. En la estación (`#/print`): elige **Cocina/Barra/Ambas** y deja
   **Auto-impresión ON**. Cada pedido nuevo imprime su comanda solo.
5. Prueba también los tickets de cuenta desde Mostrador/PDA (🧾): salen por la
   misma impresora predeterminada.

## Acceso directo (Windows)

Crea `EstacionImpresion.bat` con esto (ajusta la URL si es local):

```bat
start "" chrome --kiosk-printing --app=https://bryanliinaress.github.io/tpv-hosteleria/#/print
```

`--kiosk-printing` = imprime sin mostrar el diálogo. `--app` = ventana sin
pestañas, tipo aplicación.

## Probar SIN impresora (hoy mismo)

Se puede validar la maquetación sin hardware: abre `#/print`, genera un pedido
desde una mesa y, sin modo kiosko, en el diálogo elige **"Microsoft Print to
PDF"** → el PDF muestra exactamente lo que saldría por el papel de 80 mm.

## Limitaciones del enfoque actual (lo que resuelve la fase ESC/POS)

- Depende de un PC con Chrome encendido con el flag correcto.
- No abre el cajón portamonedas ni controla el corte por software.
- Si el driver mete márgenes o escala, hay que ajustarlo en el driver.
- Una comanda cada ~1 s (cola secuencial del navegador) — suficiente para un
  bar, justo para picos muy grandes.
