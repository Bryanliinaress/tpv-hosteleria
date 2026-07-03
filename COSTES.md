# Costes de operación real (por bar)

Estimación para un bar tipo (12 mesas, 2-3 camareros). Precios orientativos
verificados en julio de 2026 donde se indica fuente; el resto, rangos de
mercado a confirmar con presupuesto.

## A) Hardware (pago único)

| Equipo | Ajustado | Recomendado |
|---|---|---|
| 2 impresoras térmicas de red (barra+cocina) | 200€ (genéricas) | 360€ (Epson TM-T20III) |
| Terminal de mostrador | 150€ (tablet 10") | 350€ (TPV táctil 15") |
| PDA camareros ×2 | 240€ (Android básico) | 500€ (Sunmi/iMin) |
| Pantalla cocina (KDS) | 0€ (opcional) | 150€ (tablet) |
| Cajón portamonedas | 50€ | 80€ |
| QRs de mesa ×12 | 25€ | 40€ |
| WiFi (si hace falta) | 0€ | 80€ |
| **Total** | **~665€** | **~1.560€** |

## B) Mensual fijo (software)

| Concepto | Coste/mes | Nota |
|---|---|---|
| Supabase (backend) | 0€ → ~23€ | free tier al empezar; Pro recomendado (backups) |
| Hosting front | 0€ | GitHub Pages/Vercel |
| Dominio | ~1€ | 12€/año |
| Emails reservas (EmailJS) | 0€ → ~7€ | 200/mes gratis |
| **Fiscal Verifactu — Verifacti** | **2,90€/NIF** | ✅ verificado: 3.000 facturas/mes incluidas, +2€/1.000 extra, NIF de prueba gratis, incluye TicketBAI y plantilla de declaración responsable |
| **Total** | **~4€/mes al empezar · ~35€/mes en serio** | |

## C) Variable (pagos online por QR)

- Stripe: ~1,5% + 0,25€ por operación (EEA). Compensa en cuentas de mesa
  (12€ → ~3,6%), no en consumiciones sueltas.
- Datáfono físico aparte (banco 0,3-0,6% negociado o SumUp 0,75-1,5%).

## D) Fiscal — proveedor elegido

**Recomendación: [Verifacti](https://www.verifacti.com)** (API Verifactu + TicketBAI):
- 2,90€/NIF/mes (≈1 bar = 1 NIF), sin permanencia ni alta, 10% dto. anual.
- 3.000 facturas/NIF/mes incluidas (sobra para un bar: ~100 tickets/día).
- **NIF de prueba gratuito sin tarjeta** → podemos integrar y probar ya.
- API REST serverless con webhooks, gestión de NIFs y censo AEAT.
- Plantilla de declaración responsable y automatización de la representación.

Alternativa evaluada: [fiskaly SIGN ES](https://www.fiskaly.com/signes/verifactu-for-erp-pos-providers)
(cubre además SII/NaTicket/B2B; sin precios públicos, presupuesto a medida —
más orientado a enterprise). Nos quedamos con Verifacti por precio transparente
y sandbox inmediato.

## E) Resumen por escenario

| Escenario | Año 1 | Años siguientes |
|---|---|---|
| Mínimo viable | ~750-850€ | ~90-200€/año + comisiones |
| Recomendado | ~2.000-2.200€ | ~450-700€/año + comisiones |

**Contexto competitivo:** un TPV comercial cuesta 30-70€/mes de licencia
(+20-50€/mes el autopedido QR como addon) = 600-1.400€/año solo en software.
Margen para un modelo SaaS propio: cobrar 25-40€/mes al bar cubre costes con
margen y sigue siendo más barato que cualquier alternativa.
