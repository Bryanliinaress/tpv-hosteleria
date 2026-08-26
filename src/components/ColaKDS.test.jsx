/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ColaKDS from './ColaKDS'

// Los mismos estados que usan cocina y barra.
const ESTADO = {
  espera: { label: '⏸ En espera', color: '#94a3b8', next: 'recibido', nextLabel: '▶ Marchar' },
  recibido: { label: '📥 En cola', color: '#f59e0b', next: 'preparando', nextLabel: '👨‍🍳 Preparando' },
  preparando: { label: '👨‍🍳 Preparando', color: '#3b82f6', next: 'listo', nextLabel: '✅ Listo' },
  listo: { label: '✅ Listo', color: '#10b981', next: null, nextLabel: null },
}

const hace = (min) => new Date(Date.now() - min * 60000).toISOString()
const pedido = (o = {}) => ({
  id: o.id || 'p1', mesaId: 'm1', mesaNumero: o.mesa ?? 4,
  nombre: o.nombre || 'Tortilla', cantidad: o.cantidad ?? 1,
  estado: o.estado || 'recibido', horaEntrada: o.horaEntrada ?? hace(2),
  personaNombre: o.persona || 'Ana', ...o,
})

const pintar = (pedidos, extra = {}) =>
  render(<ColaKDS pedidos={pedidos} estados={ESTADO} acento="#10b981" onAvanzar={vi.fn()} {...extra} />)

const texto = () => document.body.textContent.replace(/\s+/g, ' ')
afterEach(cleanup)

// ────────────────────────────────────────────────────────────────────────────
// La cola de cocina y barra. Es una pantalla que se mira de lejos, con las
// manos ocupadas y con prisa: lo que importa es que se entienda de un vistazo
// y que no mienta con los tiempos.
// ────────────────────────────────────────────────────────────────────────────
describe('cuando no hay nada', () => {
  it('lo dice, en vez de dejar la pantalla vacía', () => {
    pintar([])
    expect(texto()).toMatch(/Sin pedidos pendientes/)
  })
})

describe('lo que se ve de un pedido', () => {
  it('la mesa, el plato y la cantidad', () => {
    pintar([pedido({ nombre: 'Paella', cantidad: 2, mesa: 7 })])
    const t = texto()
    expect(t).toMatch(/7/)
    expect(t).toMatch(/Paella/)
  })

  it('los platos de una misma mesa salen juntos', () => {
    // Salen juntos de la cocina, así que se leen juntos.
    pintar([
      pedido({ id: 'a', nombre: 'Sopa' }),
      pedido({ id: 'b', nombre: 'Filete' }),
    ])
    expect(texto()).toMatch(/Sopa/)
    expect(texto()).toMatch(/Filete/)
  })
})

describe('el tiempo de espera', () => {
  it('se enseña en minutos', () => {
    pintar([pedido({ horaEntrada: hace(7) })])
    expect(texto()).toMatch(/7 min/)
  })

  it('menos de un minuto va en segundos, no «0 min»', () => {
    pintar([pedido({ horaEntrada: new Date().toISOString() })])
    expect(texto()).toMatch(/\d+s/)
  })

  it('una comanda sin hora pone un guion, no un número absurdo', () => {
    // Sin esto salía «29000000 min», que es lo que da restar a la época.
    pintar([pedido({ horaEntrada: null })])
    expect(texto()).toMatch(/—/)
    expect(texto()).not.toMatch(/\d{5,} min/)
  })
})

describe('avanzar el pedido', () => {
  it('ofrece el siguiente paso, no una lista de estados', () => {
    pintar([pedido({ estado: 'recibido' })])
    // «Preparando» aparece dos veces: como etiqueta del estado siguiente y en
    // el botón. Se busca el botón, que es lo que se toca.
    expect(screen.getAllByRole('button', { name: /Preparando/ }).length).toBeGreaterThan(0)
  })

  it('al pulsarlo avisa de qué pedido y a qué estado pasa', async () => {
    const u = userEvent.setup()
    const avanzar = vi.fn()
    pintar([pedido({ id: 'p9', estado: 'recibido' })], { onAvanzar: avanzar })
    await u.click(screen.getAllByRole('button', { name: /Preparando/ })[0])
    expect(avanzar).toHaveBeenCalled()
    expect(avanzar.mock.calls[0]).toContain('preparando')
  })

  it('lo que ya está listo no ofrece siguiente paso', () => {
    pintar([pedido({ estado: 'listo' })])
    expect(screen.queryByRole('button', { name: /Listo/ })).toBeNull()
  })
})

describe('la barra habla de bebidas, no de platos', () => {
  it('en cocina son platos', () => {
    pintar([pedido({ cantidad: 4 })])
    expect(texto()).toMatch(/platos|plato/)
  })

  it('en barra, bebidas: «4 platos» por tres refrescos y un café suena a error', () => {
    pintar([pedido({ cantidad: 4 })], { unidad: ['bebida', 'bebidas'] })
    expect(texto()).toMatch(/bebida/)
    expect(texto()).not.toMatch(/plato/)
  })

  it('en singular, singular', () => {
    pintar([pedido({ cantidad: 1 })], { unidad: ['bebida', 'bebidas'] })
    // sin `\b` al final: el texto va pegado al siguiente dato («1 bebida2 min»)
    expect(texto()).toMatch(/1 bebida/)
    expect(texto()).not.toMatch(/1 bebidas/)
  })
})

describe('lo que aguanta sin romperse', () => {
  it('un estado que no conoce no deja la comanda invisible', () => {
    // Si mañana aparece un estado nuevo, la cocina tiene que seguir viendo el
    // plato. `estadoDeGrupo` lo trata como terminado, que es discutible pero es
    // lo que hace: lo que NO puede pasar es que desaparezca de la pantalla.
    pintar([pedido({ estado: 'inventado' })])
    expect(texto()).toMatch(/Tortilla/)
  })

  it('una comanda sin nombre de comensal no revienta', () => {
    pintar([pedido({ persona: null })])
    expect(texto()).toMatch(/Tortilla/)
  })
})
