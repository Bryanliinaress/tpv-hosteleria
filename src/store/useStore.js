import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useStore = create(persist((set, get) => ({
  // ── CARTA ──────────────────────────────────────────────
  carta: {
    categorias: [
      { id: 'entrantes', nombre: 'Entrantes', tipo: 'comida', emoji: '🥗' },
      { id: 'principales', nombre: 'Principales', tipo: 'comida', emoji: '🍽' },
      { id: 'postres', nombre: 'Postres', tipo: 'comida', emoji: '🍮' },
      { id: 'cervezas', nombre: 'Cervezas', tipo: 'bebida', emoji: '🍺' },
      { id: 'vinos', nombre: 'Vinos', tipo: 'bebida', emoji: '🍷' },
      { id: 'refrescos', nombre: 'Refrescos', tipo: 'bebida', emoji: '🥤' },
    ],
    productos: [
      { id: 'p1', nombre: 'Croquetas de jamón', precio: 8.50, categoria: 'entrantes', tipo: 'comida', descripcion: '6 unidades, bechamel artesanal', disponible: true },
      { id: 'p2', nombre: 'Tabla de ibéricos', precio: 14.00, categoria: 'entrantes', tipo: 'comida', descripcion: 'Selección de embutidos ibéricos', disponible: true },
      { id: 'p3', nombre: 'Ensalada mixta', precio: 7.50, categoria: 'entrantes', tipo: 'comida', descripcion: 'Con atún, huevo y aceitunas', disponible: true },
      { id: 'p4', nombre: 'Secreto ibérico', precio: 17.00, categoria: 'principales', tipo: 'comida', descripcion: 'Con patatas asadas y pimientos', disponible: true },
      { id: 'p5', nombre: 'Merluza a la plancha', precio: 15.50, categoria: 'principales', tipo: 'comida', descripcion: 'Con verduras de temporada', disponible: true },
      { id: 'p6', nombre: 'Arroz del señorito', precio: 16.00, categoria: 'principales', tipo: 'comida', descripcion: 'Arroz caldoso con mariscos', disponible: true },
      { id: 'p7', nombre: 'Tarta de queso', precio: 5.50, categoria: 'postres', tipo: 'comida', descripcion: 'Estilo La Viña, con coulis de frutos rojos', disponible: true },
      { id: 'p8', nombre: 'Coulant de chocolate', precio: 6.00, categoria: 'postres', tipo: 'comida', descripcion: 'Con helado de vainilla', disponible: true },
      { id: 'p9', nombre: 'Caña', precio: 1.80, categoria: 'cervezas', tipo: 'bebida', descripcion: 'Cerveza de barril 20cl', disponible: true },
      { id: 'p10', nombre: 'Tercio', precio: 2.50, categoria: 'cervezas', tipo: 'bebida', descripcion: 'Botellín 33cl', disponible: true },
      { id: 'p11', nombre: 'Vino tinto Ribera', precio: 3.50, categoria: 'vinos', tipo: 'bebida', descripcion: 'Copa vino tinto D.O. Ribera del Duero', disponible: true },
      { id: 'p12', nombre: 'Vino blanco Rueda', precio: 3.50, categoria: 'vinos', tipo: 'bebida', descripcion: 'Copa vino blanco D.O. Rueda', disponible: true },
      { id: 'p13', nombre: 'Coca-Cola', precio: 2.20, categoria: 'refrescos', tipo: 'bebida', descripcion: 'Lata 33cl', disponible: true },
      { id: 'p14', nombre: 'Agua mineral', precio: 1.50, categoria: 'refrescos', tipo: 'bebida', descripcion: 'Botella 50cl', disponible: true },
    ],
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

  // ── ACCIONES ───────────────────────────────────────────
  ocuparMesa: (mesaId, numPersonas) => set(state => ({
    mesas: state.mesas.map(m => m.id !== mesaId ? m : {
      ...m,
      estado: 'ocupada',
      abiertaDesde: new Date().toISOString(),
      personas: Array.from({ length: numPersonas }, (_, i) => ({
        id: `p${i + 1}`,
        nombre: `Persona ${i + 1}`,
        items: [],
      })),
    }),
  })),

  liberarMesa: (mesaId) => set(state => ({
    mesas: state.mesas.map(m => m.id !== mesaId ? m : {
      ...m, estado: 'libre', personas: [], abiertaDesde: null,
    }),
    pedidosCocina: state.pedidosCocina.filter(p => p.mesaId !== mesaId),
    pedidosBarra: state.pedidosBarra.filter(p => p.mesaId !== mesaId),
  })),

  addItem: (mesaId, personaId, producto) => set(state => ({
    mesas: state.mesas.map(m => m.id !== mesaId ? m : {
      ...m,
      personas: m.personas.map(p => p.id !== personaId ? p : {
        ...p,
        items: (() => {
          const existe = p.items.find(i => i.productoId === producto.id && i.estado === 'pendiente')
          if (existe) return p.items.map(i =>
            i.productoId === producto.id && i.estado === 'pendiente'
              ? { ...i, cantidad: i.cantidad + 1 } : i
          )
          return [...p.items, {
            productoId: producto.id,
            nombre: producto.nombre,
            precio: producto.precio,
            tipo: producto.tipo,
            cantidad: 1,
            estado: 'pendiente',
          }]
        })(),
      }),
    }),
  })),

  removeItem: (mesaId, personaId, productoId) => set(state => ({
    mesas: state.mesas.map(m => m.id !== mesaId ? m : {
      ...m,
      personas: m.personas.map(p => p.id !== personaId ? p : {
        ...p,
        items: p.items
          .map(i => i.productoId === productoId && i.estado === 'pendiente'
            ? i.cantidad > 1 ? { ...i, cantidad: i.cantidad - 1 } : null : i)
          .filter(Boolean),
      }),
    }),
  })),

  confirmarPedido: (mesaId) => set(state => {
    const mesa = state.mesas.find(m => m.id === mesaId)
    const cocina = []
    const barra = []

    mesa.personas.forEach(persona => {
      persona.items.filter(i => i.estado === 'pendiente').forEach(item => {
        const entry = {
          id: `${mesaId}-${persona.id}-${item.productoId}-${Date.now()}`,
          mesaId,
          mesaNumero: mesa.numero,
          personaId: persona.id,
          personaNombre: persona.nombre,
          nombre: item.nombre,
          cantidad: item.cantidad,
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

  // ── GESTIÓN DE CARTA (admin) ───────────────────────────
  addProducto: (producto) => set(state => {
    const id = `p${Date.now()}`
    return {
      carta: {
        ...state.carta,
        productos: [...state.carta.productos, {
          id,
          nombre: producto.nombre,
          precio: Number(producto.precio) || 0,
          categoria: producto.categoria,
          tipo: state.carta.categorias.find(c => c.id === producto.categoria)?.tipo || 'comida',
          descripcion: producto.descripcion || '',
          disponible: true,
        }],
      },
    }
  }),

  updateProducto: (productoId, cambios) => set(state => ({
    carta: {
      ...state.carta,
      productos: state.carta.productos.map(p => p.id !== productoId ? p : {
        ...p,
        ...cambios,
        ...(cambios.precio !== undefined ? { precio: Number(cambios.precio) || 0 } : {}),
        ...(cambios.categoria ? { tipo: state.carta.categorias.find(c => c.id === cambios.categoria)?.tipo || p.tipo } : {}),
      }),
    },
  })),

  deleteProducto: (productoId) => set(state => ({
    carta: {
      ...state.carta,
      productos: state.carta.productos.filter(p => p.id !== productoId),
    },
  })),

  toggleDisponible: (productoId) => set(state => ({
    carta: {
      ...state.carta,
      productos: state.carta.productos.map(p => p.id !== productoId ? p : { ...p, disponible: !p.disponible }),
    },
  })),

  // ── UTILIDAD ───────────────────────────────────────────
  resetDatos: () => {
    localStorage.removeItem('tpv-hosteleria')
    location.reload()
  },
}), {
  name: 'tpv-hosteleria',
  partialize: (state) => ({
    carta: state.carta,
    mesas: state.mesas,
    pedidosCocina: state.pedidosCocina,
    pedidosBarra: state.pedidosBarra,
  }),
}))

// ── Sincronización en vivo entre pestañas/pantallas ──────
// Cuando otra pestaña (cliente, cocina, barra, camarero...) modifica el
// localStorage, rehidratamos el store para reflejar los cambios al instante.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'tpv-hosteleria') {
      useStore.persist.rehydrate()
    }
  })
}
