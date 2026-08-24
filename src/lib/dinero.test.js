import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cent, importeLinea, totalDe, totalDeMesa, pendienteDeMesa, desgloseIVA } from './dinero'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

describe('totales', () => {
  const ana = { nombre: 'Ana', items: [{ precio: 1.5, cantidad: 2 }, { precio: 2.2, cantidad: 1 }] }
  const luis = { nombre: 'Luis', pagado: true, items: [{ precio: 3.1, cantidad: 1 }] }

  it('suma lo de un comensal', () => expect(totalDe(ana)).toBe(5.2))
  it('suma la mesa entera, pagados incluidos', () => expect(totalDeMesa({ personas: [ana, luis] })).toBe(8.3))
  it('lo pendiente deja fuera a quien ya pagó', () => expect(pendienteDeMesa({ personas: [ana, luis] })).toBe(5.2))

  it('aguanta lo que llega a medias sin devolver NaN', () => {
    expect(totalDe(null)).toBe(0)
    expect(totalDe({ items: null })).toBe(0)
    expect(totalDeMesa(undefined)).toBe(0)
    expect(importeLinea({ precio: undefined, cantidad: 2 })).toBe(0)
  })

  it('redondea a céntimos: 0.1 + 0.2 no puede acabar en 0.30000000000000004', () => {
    expect(totalDe({ items: [{ precio: 0.1, cantidad: 1 }, { precio: 0.2, cantidad: 1 }] })).toBe(0.3)
    expect(cent(1.005)).toBeCloseTo(1, 2)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// El desglose de IVA de una factura simplificada.
//
// La cuota sale de RESTAR de la base ya redondeada. Redondeando las dos por
// separado —que es lo que hacía el papel— «base + IVA» se imprime un céntimo
// por encima del total, y el cliente lo compara con lo que ha pagado.
// ────────────────────────────────────────────────────────────────────────────
describe('desglose de IVA', () => {
  it('base + cuota = total, SIEMPRE, en los tres tipos', () => {
    for (const pct of [4, 10, 21]) {
      for (let c = 50; c <= 50000; c++) {
        const total = c / 100
        const { base, iva } = desgloseIVA(total, pct)
        expect(cent(base + iva), `${total} € al ${pct}%`).toBe(total)
      }
    }
  })

  it('el caso que el papel imprimía mal: 3,25 € al 4 %', () => {
    // el método viejo daba base 3.13 + IVA 0.13 = 3.26 € en un ticket de 3.25 €
    expect(desgloseIVA(3.25, 4)).toEqual({ ivaPct: 4, base: 3.13, iva: 0.12, total: 3.25 })
  })

  it('sin IVA configurado no revienta ni inventa', () => {
    expect(desgloseIVA(10, 0)).toEqual({ ivaPct: 0, base: 10, iva: 0, total: 10 })
    expect(desgloseIVA(0, 10)).toEqual({ ivaPct: 10, base: 0, iva: 0, total: 0 })
  })
})

// ────────────────────────────────────────────────────────────────────────────
// La Edge Function que registra en la AEAT corre en Deno y no puede importar
// este módulo, así que su copia del desglose se queda fuera del alcance de los
// tests… salvo leyéndola. Si alguien la cambia por su cuenta, el papel y lo
// que consta en Hacienda dejarían de decir lo mismo.
// ────────────────────────────────────────────────────────────────────────────
describe('lo que se manda a la AEAT usa el mismo redondeo', () => {
  it('la Edge Function saca la cuota de la base ya redondeada', () => {
    const src = readFileSync(join(RAIZ, 'supabase/functions/registrar-fiscal/index.ts'), 'utf8')
    expect(src).toMatch(/const base = Math\.round\(\(total \/ \(1 \+ ivaPct \/ 100\)\) \* 100\) \/ 100/)
    expect(src).toMatch(/const cuota = Math\.round\(\(total - base\) \* 100\) \/ 100/)
  })
})
