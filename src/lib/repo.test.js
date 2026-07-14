import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock del cliente: capturamos cada llamada RPC (nombre + argumentos)
const rpcMock = vi.fn(async () => ({ data: 'ok', error: null }))
vi.mock('./supabase', () => ({ supabase: { rpc: (...a) => rpcMock(...a) } }))

const { qr, reservas, personal } = await import('./repo')

beforeEach(() => rpcMock.mockClear())

// El contrato repo ↔ migración 02: cada operación llama a SU función con los
// parámetros que la RPC espera (si esto rompe, el SQL y el front divergieron).
describe('repo: contrato con las RPC de la migración 02', () => {
  it('qr.unirseMesa → qr_unirse_mesa(p_mesa, p_nombre)', async () => {
    await qr.unirseMesa('m1', 'Ana')
    expect(rpcMock).toHaveBeenCalledWith('qr_unirse_mesa', { p_mesa: 'm1', p_nombre: 'Ana' })
  })

  it('qr.agregarLinea manda variante/personalización y NUNCA un precio', async () => {
    await qr.agregarLinea('c1', 'prod9', { variante: 'viena', personalizacion: { nota: 'sin sal' }, tiempo: 2, cantidad: 3 })
    const [fn, args] = rpcMock.mock.calls[0]
    expect(fn).toBe('qr_agregar_linea')
    expect(args).toEqual({
      p_comensal: 'c1', p_producto: 'prod9', p_variante: 'viena',
      p_personalizacion: { nota: 'sin sal' }, p_tiempo: 2, p_cantidad: 3,
    })
    expect(JSON.stringify(args)).not.toMatch(/precio/i) // el precio lo fija el servidor
  })

  it('qr.agregarLinea usa los valores por defecto del servicio', async () => {
    await qr.agregarLinea('c1', 'prod9')
    expect(rpcMock).toHaveBeenCalledWith('qr_agregar_linea', {
      p_comensal: 'c1', p_producto: 'prod9', p_variante: null,
      p_personalizacion: {}, p_tiempo: 1, p_cantidad: 1,
    })
  })

  it('reservas.crear normaliza opcionales a null', async () => {
    await reservas.crear('loc1', { fecha: '2026-08-01', hora: '13:30', personas: 4, nombre: 'Bea' })
    expect(rpcMock).toHaveBeenCalledWith('crear_reserva', {
      p_local: 'loc1', p_fecha: '2026-08-01', p_hora: '13:30', p_personas: 4,
      p_nombre: 'Bea', p_email: null, p_telefono: null, p_zona: null, p_notas: null,
    })
  })

  it('personal.cobrarMesa manda desglose, propina y descuento', async () => {
    await personal.cobrarMesa('m1', { pagos: { efectivo: 10, tarjeta: 5 }, propina: 1, cobradoPor: 'Juan', descuento: 2 })
    expect(rpcMock).toHaveBeenCalledWith('cobrar_mesa', {
      p_mesa: 'm1', p_pagos: { efectivo: 10, tarjeta: 5 }, p_propina: 1,
      p_cobrado_por: 'Juan', p_descuento: 2,
    })
  })

  it('personal.verificarPin pasa soloAdmin', async () => {
    await personal.verificarPin('1234', true)
    expect(rpcMock).toHaveBeenCalledWith('verificar_pin', { p_pin: '1234', p_solo_admin: true })
  })

  it('los errores de las RPC llegan con su código (sin_aforo, mesa_cerrada…)', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'sin_aforo' } })
    await expect(reservas.crear('loc1', { fecha: '2026-08-01', hora: '13:30', personas: 40, nombre: 'Bea' }))
      .rejects.toMatchObject({ codigo: 'sin_aforo' })
  })
})

// Cada nombre de función que usa el repo debe existir en la migración 02.
describe('repo: todas las RPC usadas existen en la migración 02', () => {
  it('coinciden los nombres', async () => {
    const { readFileSync } = await import('node:fs')
    const sql = readFileSync(new URL('../../supabase/migrations/20260714T02_rpc_servicio.sql', import.meta.url), 'utf8')
    const llamadas = [
      ['qr.unirseMesa', () => qr.unirseMesa('m', 'n')],
      ['qr.agregarLinea', () => qr.agregarLinea('c', 'p')],
      ['qr.cambiarCantidad', () => qr.cambiarCantidad('l', 'c', 1)],
      ['qr.confirmarPedido', () => qr.confirmarPedido('m')],
      ['qr.llamarCamarero', () => qr.llamarCamarero('m')],
      ['qr.cancelarAviso', () => qr.cancelarAviso('m')],
      ['qr.pedirCuenta', () => qr.pedirCuenta('m')],
      ['reservas.crear', () => reservas.crear('l', { fecha: 'f', hora: 'h', personas: 1, nombre: 'n' })],
      ['reservas.porToken', () => reservas.porToken('t')],
      ['reservas.cancelar', () => reservas.cancelar('t')],
      ['personal.verificarPin', () => personal.verificarPin('p')],
      ['personal.fijarPin', () => personal.fijarPin('e', 'p')],
      ['personal.pagarParte', () => personal.pagarParte('c')],
      ['personal.cobrarMesa', () => personal.cobrarMesa('m')],
      ['personal.agruparMesas', () => personal.agruparMesas('a', 'b')],
      ['personal.separarMesas', () => personal.separarMesas('m')],
      ['personal.marcharSiguiente', () => personal.marcharSiguiente('m')],
      ['personal.anularLinea', () => personal.anularLinea('l', 'm', 'p')],
    ]
    for (const [nombre, llamar] of llamadas) {
      rpcMock.mockClear()
      await llamar()
      const fn = rpcMock.mock.calls[0][0]
      expect(sql, `${nombre} llama a "${fn}" pero no está en la migración`).toContain(`function ${fn}(`)
    }
  })
})
