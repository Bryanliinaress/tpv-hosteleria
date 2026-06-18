import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Firma de una línea de pedido (para fusionar ítems idénticos al añadir)
const firma = (c) => [
  c.productoId,
  c.pan?.formato, c.pan?.tipo,
  [...(c.quitados || [])].sort().join(','),
  [...(c.anadidos || [])].sort().join(','),
  (c.nota || '').trim(),
].join('|')

export const useStore = create(persist((set, get) => ({
  // ── CARTA (Casa Loli · Desayunos) ──────────────────────
  carta: {
    categorias: [
      { id: 'desayunos', nombre: 'Desayunos', tipo: 'comida', emoji: '🥪' },
    ],
    // Formato de pan = las dos columnas de precio de la carta
    formatos: [
      { id: 'pitufo', nombre: 'Pitufo' },
      { id: 'viena', nombre: 'Viena' },
    ],
    // Tipo/variedad de pan, con suplemento sobre el precio
    tiposPan: [
      { id: 'normal', nombre: 'Normal', sup: 0 },
      { id: 'mollete', nombre: 'Mollete', sup: 0.20 },
      { id: 'centeno', nombre: 'Pan de centeno', sup: 0.20 },
      { id: 'multicereal', nombre: 'Multicereal', sup: 0 },
      { id: 'integral', nombre: 'Integral', sup: 0 },
      { id: 'singluten', nombre: 'Sin gluten', sup: 1.20 },
    ],
    // Condimentos que se pueden añadir (gratis, como nota a cocina)
    extras: ['Tomate', 'Aceite', 'Mantequilla', 'Queso', 'Huevo', 'Lechuga', 'Mayonesa', 'Pimientos'],
    productos: [
      { id: 'cl1', nombre: 'Mantequilla', precios: { pitufo: 1.50, viena: 2.50 }, ingredientes: ['Mantequilla'] },
      { id: 'cl2', nombre: 'Aceite', precios: { pitufo: 1.50, viena: 2.50 }, ingredientes: ['Aceite'] },
      { id: 'cl3', nombre: 'Aceite y tomate', precios: { pitufo: 1.50, viena: 2.50 }, ingredientes: ['Aceite', 'Tomate'] },
      { id: 'cl4', nombre: 'Jamón york y mantequilla', precios: { pitufo: 2.00, viena: 3.00 }, ingredientes: ['Jamón york', 'Mantequilla'] },
      { id: 'cl5', nombre: 'Mixto', precios: { pitufo: 2.00, viena: 3.00 }, ingredientes: ['Jamón york', 'Queso', 'Mantequilla'] },
      { id: 'cl6', nombre: 'Catalana', precios: { pitufo: 2.00, viena: 3.00 }, ingredientes: ['Jamón serrano', 'Tomate', 'Aceite'] },
      { id: 'cl7', nombre: 'Catalana con queso manchego', precios: { pitufo: 2.80, viena: 4.20 }, ingredientes: ['Jamón serrano', 'Tomate', 'Aceite', 'Queso manchego'] },
      { id: 'cl8', nombre: 'Lomo en manteca', precios: { pitufo: 2.00, viena: 3.00 }, ingredientes: ['Lomo en manteca'] },
      { id: 'cl9', nombre: 'Especial de la casa', precios: { pitufo: 3.50, viena: 5.00 }, ingredientes: ['Especial de la casa'] },
      { id: 'cl10', nombre: 'Serranito (pollo o cerdo)', precios: { pitufo: 3.50, viena: 5.00 }, ingredientes: ['Carne (pollo o cerdo)', 'Pimiento', 'Tomate'] },
      { id: 'cl11', nombre: 'Filete de pollo', precios: { pitufo: 3.50, viena: 5.00 }, ingredientes: ['Filete de pollo'] },
      { id: 'cl12', nombre: 'Beicon completo', precios: { pitufo: 2.50, viena: 4.80 }, ingredientes: ['Beicon', 'Huevo'] },
      { id: 'cl13', nombre: 'Atún', precios: { pitufo: 2.30, viena: 3.50 }, ingredientes: ['Atún'] },
      { id: 'cl14', nombre: 'Tortilla francesa completa', precios: { pitufo: 2.80, viena: 4.20 }, ingredientes: ['Tortilla francesa'] },
      { id: 'cl15', nombre: 'Tortilla de patatas', precios: { pitufo: 2.50, viena: 4.20 }, ingredientes: ['Tortilla de patatas'] },
      { id: 'cl16', nombre: 'Lomo adobado completo', precios: { pitufo: 2.50, viena: 4.80 }, ingredientes: ['Lomo adobado'] },
      { id: 'cl17', nombre: 'Mixto vegetal', precios: { pitufo: 2.50, viena: 4.20 }, ingredientes: ['Vegetales', 'Queso'] },
      { id: 'cl18', nombre: 'Sobrasada', precios: { pitufo: 1.50, viena: 2.50 }, ingredientes: ['Sobrasada'] },
      { id: 'cl19', nombre: 'Zurrapa', precios: { pitufo: 1.50, viena: 2.50 }, ingredientes: ['Zurrapa'] },
      { id: 'cl20', nombre: 'Queso manchego', precios: { pitufo: 2.50, viena: 4.20 }, ingredientes: ['Queso manchego'] },
      { id: 'cl21', nombre: 'Jamón ibérico', precios: { pitufo: 3.50, viena: 5.00 }, ingredientes: ['Jamón ibérico'] },
      { id: 'cl22', nombre: 'Pavo', precios: { pitufo: 2.00, viena: 3.00 }, ingredientes: ['Pavo'] },
      { id: 'cl23', nombre: 'Salchichón', precios: { pitufo: 2.00, viena: 3.00 }, ingredientes: ['Salchichón'] },
      { id: 'cl24', nombre: 'York pata', precios: { pitufo: 2.60, viena: 4.50 }, ingredientes: ['Jamón york pata'] },
    ].map(p => ({ ...p, categoria: 'desayunos', tipo: 'comida', descripcion: p.ingredientes.join(', '), disponible: true })),
  },

  // ── MESAS ──────────────────────────────────────────────
  mesas: Array.from({ length: 12 }, (_, i) => ({
    id: `mesa-${i + 1}`,
    numero: i + 1,
    capacidad: i < 4 ? 2 : i < 8 ? 4 : 6,
    estado: 'libre', // libre | ocupada | esperando_cobro
    personas: [],
    abiertaDesde: null,
  })),

  // ── COLAS COCINA / BARRA ───────────────────────────────
  pedidosCocina: [],
  pedidosBarra: [],

  // ── AVISOS AL CAMARERO ─────────────────────────────────
  avisos: [], // { id, mesaId, mesaNumero, personaNombre, hora }

  // ── ACCIONES ───────────────────────────────────────────
  // Un cliente se une a la mesa por su nombre. Si la mesa está libre, la
  // abre (primer comensal). Si ya está ocupada, se suma como una persona más.
  // Devuelve el id de la persona creada para que el dispositivo lo recuerde.
  unirseAMesa: (mesaId, nombre) => {
    const nuevoId = `p${Date.now()}`
    set(state => ({
      mesas: state.mesas.map(m => {
        if (m.id !== mesaId) return m
        const libre = m.estado === 'libre'
        const personas = libre ? [] : m.personas
        return {
          ...m,
          estado: 'ocupada',
          abiertaDesde: libre ? new Date().toISOString() : m.abiertaDesde,
          personas: [...personas, {
            id: nuevoId,
            nombre: (nombre || '').trim() || `Persona ${personas.length + 1}`,
            items: [],
            pagado: false,
          }],
        }
      }),
    }))
    return nuevoId
  },

  liberarMesa: (mesaId) => set(state => ({
    mesas: state.mesas.map(m => m.id !== mesaId ? m : {
      ...m, estado: 'libre', personas: [], abiertaDesde: null,
    }),
    pedidosCocina: state.pedidosCocina.filter(p => p.mesaId !== mesaId),
    pedidosBarra: state.pedidosBarra.filter(p => p.mesaId !== mesaId),
    avisos: state.avisos.filter(a => a.mesaId !== mesaId),
  })),

  // Añade una línea de pedido personalizada (pan + condimentos). Si ya existe
  // una línea pendiente idéntica, incrementa su cantidad.
  agregarItem: (mesaId, personaId, config) => set(state => ({
    mesas: state.mesas.map(m => m.id !== mesaId ? m : {
      ...m,
      personas: m.personas.map(p => {
        if (p.id !== personaId) return p
        const f = firma(config)
        const existe = p.items.find(i => i.estado === 'pendiente' && firma(i) === f)
        if (existe) {
          return { ...p, pagado: false, items: p.items.map(i => i === existe ? { ...i, cantidad: i.cantidad + 1 } : i) }
        }
        return {
          ...p,
          pagado: false,
          items: [...p.items, {
            uid: `it${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
            productoId: config.productoId,
            nombre: config.nombre,
            precio: Number(config.precio) || 0,
            tipo: config.tipo || 'comida',
            cantidad: 1,
            estado: 'pendiente',
            pan: config.pan || null,
            quitados: config.quitados || [],
            anadidos: config.anadidos || [],
            nota: config.nota || '',
            compartidoCon: [],
          }],
        }
      }),
    }),
  })),

  // Cambia la cantidad de una línea pendiente (delta +1/-1). Si llega a 0, se elimina.
  cambiarCantidad: (mesaId, personaId, uid, delta) => set(state => ({
    mesas: state.mesas.map(m => m.id !== mesaId ? m : {
      ...m,
      personas: m.personas.map(p => p.id !== personaId ? p : {
        ...p,
        items: p.items
          .map(i => (i.uid === uid && i.estado === 'pendiente') ? { ...i, cantidad: i.cantidad + delta } : i)
          .filter(i => i.cantidad > 0),
      }),
    }),
  })),

  confirmarPedido: (mesaId) => set(state => {
    const mesa = state.mesas.find(m => m.id === mesaId)
    const cocina = []
    const barra = []

    const componerNota = (item) => {
      const partes = []
      if (item.pan) partes.push(`${item.pan.nombreFormato} · ${item.pan.nombreTipo}`)
      if (item.quitados?.length) partes.push('SIN ' + item.quitados.join(', '))
      if (item.anadidos?.length) partes.push('CON ' + item.anadidos.join(', '))
      if (item.nota) partes.push(item.nota)
      return partes.join(' · ')
    }

    mesa.personas.forEach(persona => {
      persona.items.filter(i => i.estado === 'pendiente').forEach(item => {
        const entry = {
          id: `${mesaId}-${persona.id}-${item.uid}`,
          mesaId,
          mesaNumero: mesa.numero,
          personaId: persona.id,
          personaNombre: persona.nombre,
          nombre: item.nombre,
          cantidad: item.cantidad,
          nota: componerNota(item),
          estado: 'recibido',
          horaEntrada: new Date().toISOString(),
        }
        if (item.tipo === 'comida') cocina.push(entry)
        else barra.push(entry)
      })
    })

    return {
      pedidosCocina: [...state.pedidosCocina, ...cocina],
      pedidosBarra: [...state.pedidosBarra, ...barra],
      mesas: state.mesas.map(m => m.id !== mesaId ? m : {
        ...m,
        estado: 'ocupada',
        personas: m.personas.map(p => ({
          ...p,
          items: p.items.map(i => i.estado === 'pendiente' ? { ...i, estado: 'enviado' } : i),
        })),
      }),
    }
  }),

  actualizarEstadoCocina: (itemId, nuevoEstado) => set(state => ({
    pedidosCocina: state.pedidosCocina.map(p => p.id === itemId ? { ...p, estado: nuevoEstado } : p),
  })),

  actualizarEstadoBarra: (itemId, nuevoEstado) => set(state => ({
    pedidosBarra: state.pedidosBarra.map(p => p.id === itemId ? { ...p, estado: nuevoEstado } : p),
  })),

  pedirCuenta: (mesaId) => set(state => ({
    mesas: state.mesas.map(m => m.id !== mesaId ? m : { ...m, estado: 'esperando_cobro' }),
  })),

  // El cliente llama al camarero (agua, dudas...). Aparece en el Panel Camarero.
  llamarCamarero: (mesaId, personaNombre) => set(state => {
    const mesa = state.mesas.find(m => m.id === mesaId)
    if (state.avisos.some(a => a.mesaId === mesaId)) return {}
    return {
      avisos: [...state.avisos, {
        id: `aviso-${mesaId}-${Date.now()}`,
        mesaId,
        mesaNumero: mesa?.numero,
        personaNombre,
        hora: new Date().toISOString(),
      }],
    }
  }),

  atenderAviso: (avisoId) => set(state => ({
    avisos: state.avisos.filter(a => a.id !== avisoId),
  })),

  // Pago por persona: marca a un comensal como pagado. Cuando TODOS han pagado
  // (la cuenta llega a 0), la mesa se reinicia automáticamente.
  pagarParte: (mesaId, personaId, propina = 0) => set(state => {
    const mesas = state.mesas.map(m => m.id !== mesaId ? m : {
      ...m,
      personas: m.personas.map(p => p.id === personaId ? { ...p, pagado: true, propina: Number(propina) || 0 } : p),
    })
    const mesa = mesas.find(m => m.id === mesaId)
    const todosPagados = mesa.personas.length > 0 && mesa.personas.every(p => p.pagado)

    if (todosPagados) {
      return {
        mesas: mesas.map(m => m.id !== mesaId ? m : {
          ...m, estado: 'libre', personas: [], abiertaDesde: null,
        }),
        pedidosCocina: state.pedidosCocina.filter(p => p.mesaId !== mesaId),
        pedidosBarra: state.pedidosBarra.filter(p => p.mesaId !== mesaId),
        avisos: state.avisos.filter(a => a.mesaId !== mesaId),
      }
    }
    return { mesas }
  }),

  // Compartir un plato entre comensales (se identifica por uid de la línea).
  toggleCompartir: (mesaId, ownerId, uid, sharerId) => set(state => ({
    mesas: state.mesas.map(m => m.id !== mesaId ? m : {
      ...m,
      personas: m.personas.map(p => p.id !== ownerId ? p : {
        ...p,
        items: p.items.map(i => {
          if (i.uid !== uid) return i
          const actual = i.compartidoCon || []
          const compartidoCon = actual.includes(sharerId)
            ? actual.filter(id => id !== sharerId)
            : [...actual, sharerId]
          return { ...i, compartidoCon }
        }),
      }),
    }),
  })),

  // ── GESTIÓN DE CARTA (admin) ───────────────────────────
  addProducto: (producto) => set(state => {
    const id = `p${Date.now()}`
    return {
      carta: {
        ...state.carta,
        productos: [...state.carta.productos, {
          id,
          nombre: producto.nombre,
          precios: {
            pitufo: Number(producto.precioPitufo) || 0,
            viena: Number(producto.precioViena) || 0,
          },
          categoria: producto.categoria,
          tipo: state.carta.categorias.find(c => c.id === producto.categoria)?.tipo || 'comida',
          descripcion: producto.descripcion || '',
          ingredientes: (producto.descripcion || '').split(',').map(s => s.trim()).filter(Boolean),
          disponible: true,
        }],
      },
    }
  }),

  updateProducto: (productoId, cambios) => set(state => ({
    carta: {
      ...state.carta,
      productos: state.carta.productos.map(p => {
        if (p.id !== productoId) return p
        const next = { ...p }
        if (cambios.nombre !== undefined) next.nombre = cambios.nombre
        if (cambios.descripcion !== undefined) {
          next.descripcion = cambios.descripcion
          next.ingredientes = cambios.descripcion.split(',').map(s => s.trim()).filter(Boolean)
        }
        if (cambios.precioPitufo !== undefined || cambios.precioViena !== undefined) {
          next.precios = {
            pitufo: Number(cambios.precioPitufo ?? p.precios?.pitufo) || 0,
            viena: Number(cambios.precioViena ?? p.precios?.viena) || 0,
          }
        }
        return next
      }),
    },
  })),

  deleteProducto: (productoId) => set(state => ({
    carta: { ...state.carta, productos: state.carta.productos.filter(p => p.id !== productoId) },
  })),

  toggleDisponible: (productoId) => set(state => ({
    carta: { ...state.carta, productos: state.carta.productos.map(p => p.id !== productoId ? p : { ...p, disponible: !p.disponible }) },
  })),

  // ── UTILIDAD ───────────────────────────────────────────
  resetDatos: () => {
    localStorage.removeItem('tpv-hosteleria')
    location.reload()
  },
}), {
  name: 'tpv-hosteleria',
  version: 3,
  migrate: () => undefined, // si cambia el formato de carta, descarta lo viejo y usa el por defecto
  partialize: (state) => ({
    carta: state.carta,
    mesas: state.mesas,
    pedidosCocina: state.pedidosCocina,
    pedidosBarra: state.pedidosBarra,
    avisos: state.avisos,
  }),
}))

// Lo que debe cada comensal, repartiendo a partes iguales los platos compartidos.
export function owedPorPersona(mesa) {
  const res = {}
  mesa.personas.forEach(p => { res[p.id] = 0 })
  mesa.personas.forEach(owner => {
    owner.items.forEach(item => {
      const sharers = [owner.id, ...(item.compartidoCon || [])].filter(id => id in res)
      const importe = item.precio * item.cantidad
      const cuota = importe / (sharers.length || 1)
      sharers.forEach(id => { res[id] += cuota })
    })
  })
  return res
}

// ── Sincronización en vivo entre pestañas del mismo navegador ──
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'tpv-hosteleria') useStore.persist.rehydrate()
  })
}
