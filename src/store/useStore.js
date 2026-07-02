import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Métodos de pago disponibles al cobrar (configurable para cualquier local)
export const METODOS_PAGO = [
  { id: 'efectivo', label: 'Efectivo', emoji: '💵' },
  { id: 'tarjeta', label: 'Tarjeta', emoji: '💳' },
  { id: 'bizum', label: 'Bizum', emoji: '📲' },
]
export const METODO_LABEL = { ...Object.fromEntries(METODOS_PAGO.map(m => [m.id, m.label])), sincobrar: 'Sin cobrar' }
export const METODO_EMOJI = { ...Object.fromEntries(METODOS_PAGO.map(m => [m.id, m.emoji])), sincobrar: '🚫' }

// Los 14 alérgenos de declaración obligatoria en la UE (Reglamento 1169/2011)
export const ALERGENOS = [
  { id: 'gluten', nombre: 'Gluten', emoji: '🌾' },
  { id: 'crustaceos', nombre: 'Crustáceos', emoji: '🦐' },
  { id: 'huevos', nombre: 'Huevos', emoji: '🥚' },
  { id: 'pescado', nombre: 'Pescado', emoji: '🐟' },
  { id: 'cacahuetes', nombre: 'Cacahuetes', emoji: '🥜' },
  { id: 'soja', nombre: 'Soja', emoji: '🫘' },
  { id: 'lacteos', nombre: 'Lácteos', emoji: '🥛' },
  { id: 'frutos_cascara', nombre: 'Frutos de cáscara', emoji: '🌰' },
  { id: 'apio', nombre: 'Apio', emoji: '🥬' },
  { id: 'mostaza', nombre: 'Mostaza', emoji: '🟡' },
  { id: 'sesamo', nombre: 'Sésamo', emoji: '⚪' },
  { id: 'sulfitos', nombre: 'Sulfitos', emoji: '🍷' },
  { id: 'altramuces', nombre: 'Altramuces', emoji: '🌼' },
  { id: 'moluscos', nombre: 'Moluscos', emoji: '🐚' },
]
export const ALERGENO_INFO = Object.fromEntries(ALERGENOS.map(a => [a.id, a]))

// Deducción básica de alérgenos por texto (solo para sembrar la carta demo;
// en un local real los fija el admin producto a producto).
export function alergenosDe(texto) {
  const t = (texto || '').toLowerCase()
  const res = []
  if (/queso|mantequilla|leche|nata/.test(t)) res.push('lacteos')
  if (/huevo|tortilla|mayonesa/.test(t)) res.push('huevos')
  if (/atún|pescado|anchoa|boquer/.test(t)) res.push('pescado')
  if (/cerveza|caña|tercio/.test(t)) res.push('gluten')
  if (/vino|vermut/.test(t)) res.push('sulfitos')
  if (/cola cao|chocolate/.test(t)) res.push('lacteos', 'soja')
  return [...new Set(res)]
}

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
      { id: 'cafes', nombre: 'Cafés', tipo: 'bebida', emoji: '☕' },
      { id: 'bebidas', nombre: 'Bebidas', tipo: 'bebida', emoji: '🥤' },
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
    ].map(p => ({ ...p, categoria: 'desayunos', tipo: 'comida', descripcion: p.ingredientes.join(', '), disponible: true, alergenos: [...new Set(['gluten', ...alergenosDe(p.ingredientes.join(' '))])] })).concat(
      // ── CAFÉS (Santa Cristina) — precio único ──
      [
        { id: 'cf1', nombre: 'Solo', precio: 1.30, descripcion: 'Café solo (espresso)' },
        { id: 'cf2', nombre: 'Largo', precio: 1.30, descripcion: 'Café solo con más agua' },
        { id: 'cf3', nombre: 'Semilargo', precio: 1.30, descripcion: 'Entre solo y largo' },
        { id: 'cf4', nombre: 'Mitad', precio: 1.40, descripcion: 'Mitad café, mitad leche' },
        { id: 'cf5', nombre: 'Entre corto', precio: 1.40, descripcion: 'Un poco menos de leche que el corto' },
        { id: 'cf6', nombre: 'Corto', precio: 1.40, descripcion: 'Café con un poco de leche' },
        { id: 'cf7', nombre: 'Sombra', precio: 1.40, descripcion: 'Leche con un toque de café' },
        { id: 'cf8', nombre: 'Nube', precio: 1.40, descripcion: 'Leche con una nube de café' },
      ].map(p => ({ ...p, categoria: 'cafes', tipo: 'bebida', disponible: true, alergenos: alergenosDe(p.nombre + ' ' + p.descripcion) })),
      // ── BEBIDAS (cafetería/bar) — precio único ──
      [
        { id: 'be1', nombre: 'Coca-Cola', precio: 2.00, descripcion: 'Lata/botellín 33cl' },
        { id: 'be2', nombre: 'Coca-Cola Zero', precio: 2.00, descripcion: 'Lata/botellín 33cl' },
        { id: 'be3', nombre: 'Fanta Naranja', precio: 2.00, descripcion: 'Lata/botellín 33cl' },
        { id: 'be4', nombre: 'Fanta Limón', precio: 2.00, descripcion: 'Lata/botellín 33cl' },
        { id: 'be5', nombre: 'Sprite', precio: 2.00, descripcion: 'Lata/botellín 33cl' },
        { id: 'be6', nombre: 'Nestea', precio: 2.20, descripcion: 'Té con limón' },
        { id: 'be7', nombre: 'Aquarius', precio: 2.20, descripcion: 'Naranja o limón' },
        { id: 'be8', nombre: 'Tónica', precio: 2.00, descripcion: 'Schweppes 20cl' },
        { id: 'be9', nombre: 'Bitter Kas', precio: 2.20, descripcion: 'Sin alcohol' },
        { id: 'be10', nombre: 'Agua mineral', precio: 1.30, descripcion: 'Botella 50cl' },
        { id: 'be11', nombre: 'Agua con gas', precio: 1.60, descripcion: 'Botella 50cl' },
        { id: 'be12', nombre: 'Zumo de naranja natural', precio: 2.50, descripcion: 'Recién exprimido' },
        { id: 'be13', nombre: 'Zumo', precio: 2.00, descripcion: 'Piña, melocotón o tomate' },
        { id: 'be14', nombre: 'Caña', precio: 1.50, descripcion: 'Cerveza de barril 20cl' },
        { id: 'be15', nombre: 'Doble', precio: 2.20, descripcion: 'Cerveza de barril 40cl' },
        { id: 'be16', nombre: 'Tercio', precio: 2.50, descripcion: 'Botellín 33cl' },
        { id: 'be17', nombre: 'Botellín', precio: 2.00, descripcion: 'Cerveza 25cl' },
        { id: 'be18', nombre: 'Cerveza sin alcohol', precio: 2.00, descripcion: 'Botellín 25cl' },
        { id: 'be19', nombre: 'Copa de vino tinto', precio: 1.80, descripcion: 'D.O. de la casa' },
        { id: 'be20', nombre: 'Copa de vino blanco', precio: 1.80, descripcion: 'D.O. de la casa' },
        { id: 'be21', nombre: 'Vermut', precio: 2.50, descripcion: 'Rojo o blanco, con sifón' },
        { id: 'be22', nombre: 'Té / Infusión', precio: 1.40, descripcion: 'Variedades a elegir' },
        { id: 'be23', nombre: 'Cola Cao', precio: 1.60, descripcion: 'Caliente o frío' },
        { id: 'be24', nombre: 'Chocolate caliente', precio: 2.00, descripcion: 'A la taza' },
        { id: 'be25', nombre: 'Vaso de leche', precio: 1.30, descripcion: 'Caliente o fría' },
      ].map(p => ({ ...p, categoria: 'bebidas', tipo: 'bebida', disponible: true, alergenos: alergenosDe(p.nombre + ' ' + p.descripcion) })),
    ),
  },

  // ── IDENTIDAD DEL LOCAL (configurable para cualquier bar) ─
  // Datos del negocio que aparecen en tickets, cabeceras y reservas.
  local: {
    nombre: 'Mi Local',
    subtitulo: 'Bar · Cafetería',
    direccion: '',
    telefono: '',
    cif: '',
    ivaPct: 10,        // % de IVA incluido en el precio
    moneda: '€',
    pieTicket: '¡Gracias por su visita!',
  },

  // ── PERSONAL / ACCESO (control de acceso por PIN, nivel demo) ─
  // El admin da de alta a los empleados; cada uno entra con su PIN. Es un
  // control de acceso de demostración (vive en el estado sincronizado, no es
  // seguridad real cifrada). Roles: 'admin' | 'camarero'.
  empleados: [
    { id: 'emp-admin', nombre: 'Encargado', pin: '1234', rol: 'admin', activo: true },
    { id: 'emp-maria', nombre: 'María', pin: '1111', rol: 'camarero', activo: true },
    { id: 'emp-juan', nombre: 'Juan', pin: '2222', rol: 'camarero', activo: true },
  ],

  // ── MESAS ──────────────────────────────────────────────
  mesas: Array.from({ length: 12 }, (_, i) => ({
    id: `mesa-${i + 1}`,
    numero: i + 1,
    capacidad: i < 4 ? 2 : i < 8 ? 4 : 6,
    zona: i < 4 ? 'Terraza' : i < 8 ? 'Interior' : 'Salón',
    estado: 'libre', // libre | ocupada | esperando_cobro
    personas: [],
    abiertaDesde: null,
  })),

  // ── COLAS COCINA / BARRA ───────────────────────────────
  pedidosCocina: [],
  pedidosBarra: [],

  // ── AVISOS AL CAMARERO ─────────────────────────────────
  avisos: [], // { id, mesaId, mesaNumero, personaNombre, hora }

  // ── HISTORIAL DE TICKETS (mesas cerradas) ──────────────
  historial: [], // { id, mesaNumero, cerradaEn, total, propina, pagos, personas, camarero, cobradoPor }

  // ── CIERRES DE CAJA (arqueos Z) ────────────────────────
  cierres: [], // { id, desde, hasta, total, propinas, pagos, nTickets, contado, descuadre }

  // ── AGENDA DE RESERVAS (reservas online del cliente) ───
  // Reserva tipo CoverManager: el cliente pide fecha/hora/personas/zona y el
  // local la gestiona (asigna mesa, sienta, cancela). Distinto del estado
  // 'reservada' de una mesa, que es el "bloqueo" puntual de una mesa concreta.
  reservas: [], // { id, fecha, hora, personas, nombre, telefono, zona, notas, estado, mesaId, creada }

  // Configuración de disponibilidad de reservas (horarios, aforo, políticas).
  reservasConfig: {
    turnos: [
      { id: 'comida', nombre: 'Comida', inicio: '13:00', fin: '16:00' },
      { id: 'cena', nombre: 'Cena', inicio: '20:00', fin: '23:30' },
    ],
    intervaloMin: 30,        // minutos entre slots de reserva
    duracionMin: 90,         // duración estimada que ocupa una reserva
    aforo: null,             // nº máx de comensales simultáneos; null = suma de plazas de las mesas
    maxPersonasOnline: 10,   // grupos mayores: deben llamar al local
    diasCerrados: [],        // días de la semana cerrados (0=domingo … 6=sábado)
  },

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

  liberarMesa: (mesaId) => set(state => {
    const mesa = state.mesas.find(m => m.id === mesaId)
    const rec = snapshotMesa(mesa)
    const grupo = idsGrupo(mesa) // libera también las mesas unidas al grupo
    return {
      mesas: state.mesas.map(m => grupo.includes(m.id) ? { ...m, ...CAMPOS_LIBRE } : m),
      pedidosCocina: state.pedidosCocina.filter(p => !grupo.includes(p.mesaId)),
      pedidosBarra: state.pedidosBarra.filter(p => !grupo.includes(p.mesaId)),
      avisos: state.avisos.filter(a => !grupo.includes(a.mesaId)),
      historial: rec ? [...state.historial, rec] : state.historial,
    }
  }),

  // Asigna el camarero que atiende la mesa (solo si aún no tiene uno).
  asignarCamarero: (mesaId, nombre) => set(state => ({
    mesas: state.mesas.map(m => (m.id === mesaId && !m.camarero && nombre) ? { ...m, camarero: nombre } : m),
  })),

  // Mueve/junta una mesa en otra: las personas de 'origen' pasan a 'destino'
  // (si destino está libre, es un "mover"; si está ocupada, "juntar"), y origen
  // queda libre. Reetiqueta las comandas de cocina/barra.
  fusionarMesa: (origenId, destinoId) => set(state => {
    if (origenId === destinoId) return {}
    const origen = state.mesas.find(m => m.id === origenId)
    const destino = state.mesas.find(m => m.id === destinoId)
    if (!origen || !destino) return {}
    const destinoLibre = destino.estado === 'libre'
    const retag = (arr) => arr.map(p => p.mesaId === origenId ? { ...p, mesaId: destinoId, mesaNumero: destino.numero } : p)
    return {
      mesas: state.mesas.map(m => {
        if (m.id === destinoId) return { ...m, estado: 'ocupada', abiertaDesde: destinoLibre ? origen.abiertaDesde : m.abiertaDesde, personas: [...(destinoLibre ? [] : m.personas), ...origen.personas], camarero: m.camarero || origen.camarero }
        if (m.id === origenId) return { ...m, estado: 'libre', personas: [], abiertaDesde: null, camarero: null }
        return m
      }),
      pedidosCocina: retag(state.pedidosCocina),
      pedidosBarra: retag(state.pedidosBarra),
      avisos: state.avisos.filter(a => a.mesaId !== origenId),
    }
  }),

  // Agrupa la mesa `secId` (y su grupo, si lo tuviera) dentro del grupo cuya
  // cabeza es `principalId`. Las mesas quedan ocupadas y ENLAZADAS, compartiendo
  // una sola cuenta (la de la principal). Al cobrar/cerrar se separan solas.
  agruparMesas: (principalId, secId) => set(state => {
    if (principalId === secId) return {}
    const principal = state.mesas.find(m => m.id === principalId)
    const sec = state.mesas.find(m => m.id === secId)
    if (!principal || !sec || sec.unidaA || principal.unidaA) return {}
    const miembrosSec = [secId, ...(sec.unidas || [])] // si la secundaria ya era cabeza, absorbe su grupo
    const personasSec = state.mesas.filter(m => miembrosSec.includes(m.id)).flatMap(m => m.personas)
    const retag = (arr) => arr.map(p => miembrosSec.includes(p.mesaId) ? { ...p, mesaId: principalId, mesaNumero: principal.numero } : p)
    const ahora = new Date().toISOString()
    const nuevasUnidas = [...new Set([...(principal.unidas || []), ...miembrosSec])]
    return {
      mesas: state.mesas.map(m => {
        if (m.id === principalId) return { ...m, estado: 'ocupada', abiertaDesde: m.abiertaDesde || ahora, personas: [...m.personas, ...personasSec], unidas: nuevasUnidas, unidaA: null, camarero: m.camarero || sec.camarero }
        if (miembrosSec.includes(m.id)) return { ...m, estado: 'ocupada', abiertaDesde: m.abiertaDesde || ahora, personas: [], unidas: [], unidaA: principalId, reserva: null }
        return m
      }),
      pedidosCocina: retag(state.pedidosCocina),
      pedidosBarra: retag(state.pedidosBarra),
      avisos: state.avisos.filter(a => !miembrosSec.includes(a.mesaId)),
    }
  }),

  // Separa el grupo: la cabeza conserva la cuenta; las mesas unidas se liberan.
  separarMesas: (principalId) => set(state => {
    const principal = state.mesas.find(m => m.id === principalId)
    if (!principal) return {}
    const miembros = principal.unidas || []
    return {
      mesas: state.mesas.map(m => {
        if (m.id === principalId) return { ...m, unidas: [] }
        if (miembros.includes(m.id)) return { ...m, ...CAMPOS_LIBRE }
        return m
      }),
    }
  }),

  // Transfiere un comensal (con sus pedidos) de una mesa a otra.
  transferirComensal: (origenId, personaId, destinoId) => set(state => {
    if (origenId === destinoId) return {}
    const origen = state.mesas.find(m => m.id === origenId)
    const destino = state.mesas.find(m => m.id === destinoId)
    const persona = origen?.personas.find(p => p.id === personaId)
    if (!persona || !destino) return {}
    const destinoLibre = destino.estado === 'libre'
    const retag = (arr) => arr.map(p => (p.mesaId === origenId && p.personaId === personaId) ? { ...p, mesaId: destinoId, mesaNumero: destino.numero } : p)
    return {
      mesas: state.mesas.map(m => {
        if (m.id === origenId) {
          const restantes = m.personas.filter(p => p.id !== personaId)
          return restantes.length === 0 ? { ...m, estado: 'libre', personas: [], abiertaDesde: null, camarero: null } : { ...m, personas: restantes }
        }
        if (m.id === destinoId) return { ...m, estado: 'ocupada', abiertaDesde: destinoLibre ? new Date().toISOString() : m.abiertaDesde, personas: [...(destinoLibre ? [] : m.personas), persona] }
        return m
      }),
      pedidosCocina: retag(state.pedidosCocina),
      pedidosBarra: retag(state.pedidosBarra),
    }
  }),

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

  // Anula una línea (pendiente o ya enviada) y retira su comanda de cocina/barra.
  anularItem: (mesaId, personaId, uid) => set(state => {
    const entryId = `${mesaId}-${personaId}-${uid}`
    return {
      mesas: state.mesas.map(m => m.id !== mesaId ? m : {
        ...m,
        personas: m.personas.map(p => p.id !== personaId ? p : { ...p, items: p.items.filter(i => i.uid !== uid) }),
      }),
      pedidosCocina: state.pedidosCocina.filter(p => p.id !== entryId),
      pedidosBarra: state.pedidosBarra.filter(p => p.id !== entryId),
    }
  }),

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
          camarero: mesa.camarero || null,
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

  // Marca como servidos (entregados) los platos listos de una mesa: salen de
  // la cola de cocina/barra y del feed de avisos.
  servirMesa: (mesaId) => set(state => ({
    pedidosCocina: state.pedidosCocina.filter(p => !(p.mesaId === mesaId && p.estado === 'listo')),
    pedidosBarra: state.pedidosBarra.filter(p => !(p.mesaId === mesaId && p.estado === 'listo')),
  })),

  // Pago por persona: marca a un comensal como pagado con su método de pago.
  // Cuando TODOS han pagado, la mesa se reinicia automáticamente.
  // `opts` admite { propina, metodo, cobradoPor }. Por compatibilidad, si se
  // pasa un número se interpreta como la propina.
  pagarParte: (mesaId, personaId, opts = {}) => set(state => {
    const o = typeof opts === 'number' ? { propina: opts } : opts
    const { propina = 0, metodo = 'efectivo', cobradoPor = null } = o
    const mesas = state.mesas.map(m => m.id !== mesaId ? m : {
      ...m,
      personas: m.personas.map(p => p.id === personaId ? { ...p, pagado: true, propina: Number(propina) || 0, metodoPago: metodo, cobradoPor } : p),
    })
    const mesa = mesas.find(m => m.id === mesaId)
    const todosPagados = mesa.personas.length > 0 && mesa.personas.every(p => p.pagado)

    if (todosPagados) {
      const rec = snapshotMesa(mesa)
      const grupo = idsGrupo(mesa)
      return {
        mesas: mesas.map(m => grupo.includes(m.id) ? { ...m, ...CAMPOS_LIBRE } : m),
        pedidosCocina: state.pedidosCocina.filter(p => !grupo.includes(p.mesaId)),
        pedidosBarra: state.pedidosBarra.filter(p => !grupo.includes(p.mesaId)),
        avisos: state.avisos.filter(a => !grupo.includes(a.mesaId)),
        historial: rec ? [...state.historial, rec] : state.historial,
      }
    }
    return { mesas }
  }),

  // Cobra de una vez todo lo pendiente de la mesa con un único método de pago
  // y la cierra (los ya pagados conservan su método).
  cobrarMesa: (mesaId, opts = {}) => set(state => {
    const { metodo = 'efectivo', cobradoPor = null } = opts
    const mesas = state.mesas.map(m => m.id !== mesaId ? m : {
      ...m,
      personas: m.personas.map(p => p.pagado ? p : { ...p, pagado: true, metodoPago: metodo, cobradoPor }),
    })
    const mesa = mesas.find(m => m.id === mesaId)
    const rec = snapshotMesa(mesa)
    const grupo = idsGrupo(mesa)
    return {
      mesas: mesas.map(m => grupo.includes(m.id) ? { ...m, ...CAMPOS_LIBRE } : m),
      pedidosCocina: state.pedidosCocina.filter(p => !grupo.includes(p.mesaId)),
      pedidosBarra: state.pedidosBarra.filter(p => !grupo.includes(p.mesaId)),
      avisos: state.avisos.filter(a => !grupo.includes(a.mesaId)),
      historial: rec ? [...state.historial, rec] : state.historial,
    }
  }),

  // Paga la cuenta COMPLETA de la mesa de una vez (un comensal paga por todos),
  // aunque haya varios comensales. Marca a todos los no pagados como pagados con
  // el método dado, añade la propina (al conjunto) y cierra la mesa/grupo.
  pagarTodo: (mesaId, opts = {}) => set(state => {
    const { propina = 0, metodo = 'tarjeta', cobradoPor = null } = opts
    let primero = true
    const mesas = state.mesas.map(m => m.id !== mesaId ? m : {
      ...m,
      personas: m.personas.map(p => {
        if (p.pagado) return p
        const prop = primero ? (Number(propina) || 0) : 0 // la propina total se registra una vez
        primero = false
        return { ...p, pagado: true, propina: prop, metodoPago: metodo, cobradoPor }
      }),
    })
    const mesa = mesas.find(m => m.id === mesaId)
    const rec = snapshotMesa(mesa)
    const grupo = idsGrupo(mesa)
    return {
      mesas: mesas.map(m => grupo.includes(m.id) ? { ...m, ...CAMPOS_LIBRE } : m),
      pedidosCocina: state.pedidosCocina.filter(p => !grupo.includes(p.mesaId)),
      pedidosBarra: state.pedidosBarra.filter(p => !grupo.includes(p.mesaId)),
      avisos: state.avisos.filter(a => !grupo.includes(a.mesaId)),
      historial: rec ? [...state.historial, rec] : state.historial,
    }
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

  // ── RESERVAS DE MESA ───────────────────────────────────
  // Marca una mesa libre como reservada (nombre, hora y nº de personas).
  reservarMesa: (mesaId, datos) => set(state => ({
    mesas: state.mesas.map(m => (m.id === mesaId && m.estado === 'libre') ? {
      ...m,
      estado: 'reservada',
      reserva: {
        nombre: (datos.nombre || '').trim() || 'Reserva',
        hora: datos.hora || '',
        personas: Math.max(1, Number(datos.personas) || 2),
        telefono: (datos.telefono || '').trim(),
        creada: new Date().toISOString(),
      },
    } : m),
  })),

  cancelarReserva: (mesaId) => set(state => ({
    mesas: state.mesas.map(m => m.id !== mesaId ? m : { ...m, estado: 'libre', reserva: null }),
  })),

  // Sienta la reserva: abre la mesa con el primer comensal y limpia la reserva.
  sentarReserva: (mesaId, nombre) => {
    set(state => ({ mesas: state.mesas.map(m => m.id !== mesaId ? m : { ...m, estado: 'libre', reserva: null }) }))
    return get().unirseAMesa(mesaId, nombre)
  },

  // ── AGENDA DE RESERVAS (online) ────────────────────────
  // Crea una reserva del cliente (queda confirmada al instante).
  crearReserva: (datos) => {
    const id = `rv${Date.now()}`
    set(state => ({
      reservas: [...state.reservas, {
        id,
        token: Math.random().toString(36).slice(2, 10), // localizador para gestionar la reserva desde el email
        fecha: datos.fecha,                 // 'YYYY-MM-DD'
        hora: datos.hora || '',             // 'HH:MM'
        personas: Math.max(1, Number(datos.personas) || 2),
        nombre: (datos.nombre || '').trim() || 'Cliente',
        email: (datos.email || '').trim(),
        telefono: (datos.telefono || '').trim(),
        zona: datos.zona || '',             // preferencia; '' = sin preferencia
        notas: (datos.notas || '').trim(),
        estado: 'confirmada',               // confirmada | sentada | cancelada | no_show
        mesaId: null,
        creada: new Date().toISOString(),
      }],
    }))
    return id
  },

  // Asigna (o reasigna) una mesa a la reserva y la marca como 'reservada'.
  asignarReservaMesa: (id, mesaId) => set(state => {
    const r = state.reservas.find(x => x.id === id)
    if (!r) return {}
    return {
      reservas: state.reservas.map(x => x.id === id ? { ...x, mesaId } : x),
      mesas: state.mesas.map(m => {
        if (m.id === r.mesaId && m.id !== mesaId && m.estado === 'reservada') return { ...m, estado: 'libre', reserva: null }
        if (m.id === mesaId && m.estado === 'libre') return { ...m, estado: 'reservada', reserva: { nombre: r.nombre, hora: r.hora, personas: r.personas, telefono: r.telefono, reservaId: r.id } }
        return m
      }),
    }
  }),

  // Sienta la reserva: abre su mesa asignada y la marca 'sentada'.
  sentarReservaAgenda: (id) => {
    const r = get().reservas.find(x => x.id === id)
    if (!r || !r.mesaId) return null
    set(state => ({ mesas: state.mesas.map(m => m.id !== r.mesaId ? m : { ...m, estado: 'libre', reserva: null }) }))
    const pid = get().unirseAMesa(r.mesaId, r.nombre)
    set(state => ({ reservas: state.reservas.map(x => x.id === id ? { ...x, estado: 'sentada' } : x) }))
    return pid
  },

  // Cancela / marca no-show: libera la mesa si la tenía reservada.
  cambiarEstadoReserva: (id, estado) => set(state => {
    const r = state.reservas.find(x => x.id === id)
    return {
      reservas: state.reservas.map(x => x.id === id ? { ...x, estado } : x),
      mesas: state.mesas.map(m => (r && m.id === r.mesaId && m.estado === 'reservada') ? { ...m, estado: 'libre', reserva: null } : m),
    }
  }),

  // Modifica una reserva (fecha/hora/personas/zona/datos). Al cambiar la hora o
  // la zona, la mesa asignada deja de valer: se libera y se quita la asignación.
  actualizarReserva: (id, cambios) => set(state => {
    const r = state.reservas.find(x => x.id === id)
    if (!r) return {}
    return {
      reservas: state.reservas.map(x => x.id !== id ? x : {
        ...x,
        fecha: cambios.fecha ?? x.fecha,
        hora: cambios.hora ?? x.hora,
        personas: cambios.personas ?? x.personas,
        zona: cambios.zona ?? x.zona,
        nombre: (cambios.nombre ?? x.nombre),
        email: (cambios.email ?? x.email),
        telefono: (cambios.telefono ?? x.telefono),
        notas: (cambios.notas ?? x.notas),
        mesaId: null,
      }),
      mesas: state.mesas.map(m => (m.id === r.mesaId && m.estado === 'reservada') ? { ...m, estado: 'libre', reserva: null } : m),
    }
  }),

  // Actualiza la configuración de disponibilidad de reservas.
  updateReservasConfig: (cambios) => set(state => ({
    reservasConfig: { ...state.reservasConfig, ...cambios },
  })),

  // ── PERSONAL (gestión de empleados, solo admin) ────────
  // Da de alta un empleado. Devuelve { ok, error }. El PIN debe ser de 4
  // dígitos y único entre el personal activo.
  addEmpleado: ({ nombre, pin, rol }) => {
    const n = (nombre || '').trim()
    const p = (pin || '').trim()
    if (!n) return { ok: false, error: 'Escribe un nombre' }
    if (!/^\d{4}$/.test(p)) return { ok: false, error: 'El PIN debe tener 4 dígitos' }
    if (get().empleados.some(e => e.pin === p)) return { ok: false, error: 'Ese PIN ya está en uso' }
    set(state => ({ empleados: [...state.empleados, { id: `emp${Date.now()}`, nombre: n, pin: p, rol: rol === 'admin' ? 'admin' : 'camarero', activo: true }] }))
    return { ok: true }
  },

  // Modifica un empleado (nombre, rol, pin, activo). Valida PIN si cambia.
  updateEmpleado: (id, cambios) => {
    if (cambios.pin !== undefined) {
      const p = (cambios.pin || '').trim()
      if (!/^\d{4}$/.test(p)) return { ok: false, error: 'El PIN debe tener 4 dígitos' }
      if (get().empleados.some(e => e.id !== id && e.pin === p)) return { ok: false, error: 'Ese PIN ya está en uso' }
    }
    set(state => ({
      empleados: state.empleados.map(e => e.id !== id ? e : {
        ...e,
        ...(cambios.nombre !== undefined ? { nombre: (cambios.nombre || '').trim() || e.nombre } : {}),
        ...(cambios.rol !== undefined ? { rol: cambios.rol === 'admin' ? 'admin' : 'camarero' } : {}),
        ...(cambios.pin !== undefined ? { pin: (cambios.pin || '').trim() } : {}),
        ...(cambios.activo !== undefined ? { activo: !!cambios.activo } : {}),
      }),
    }))
    return { ok: true }
  },

  // Elimina un empleado. No deja borrar el último admin activo.
  removeEmpleado: (id) => {
    const emps = get().empleados
    const e = emps.find(x => x.id === id)
    if (e?.rol === 'admin' && emps.filter(x => x.rol === 'admin' && x.activo && x.id !== id).length === 0) {
      return { ok: false, error: 'Debe quedar al menos un administrador' }
    }
    set(state => ({ empleados: state.empleados.filter(x => x.id !== id) }))
    return { ok: true }
  },

  // ── IDENTIDAD DEL LOCAL ────────────────────────────────
  // Actualiza los datos del negocio (nombre, IVA, moneda, pie de ticket…).
  updateLocal: (cambios) => set(state => {
    const next = { ...cambios }
    if (next.ivaPct !== undefined) next.ivaPct = Math.max(0, Number(next.ivaPct) || 0)
    if (next.moneda !== undefined) next.moneda = (next.moneda || '').trim() || '€'
    return { local: { ...state.local, ...next } }
  }),

  // ── CIERRE DE CAJA (arqueo Z) ──────────────────────────
  // Cierra la caja desde el último cierre hasta ahora: agrega ventas, propinas
  // y desglose por método. `contado` (efectivo real en cajón) calcula descuadre.
  cerrarCaja: (contado) => set(state => {
    const desde = state.cierres.length ? state.cierres[state.cierres.length - 1].hasta : null
    const tickets = state.historial.filter(r => !desde || new Date(r.cerradaEn) > new Date(desde))
    const total = tickets.reduce((s, r) => s + r.total, 0)
    const propinas = tickets.reduce((s, r) => s + (r.propina || 0), 0)
    const pagos = {}
    tickets.forEach(r => Object.entries(r.pagos || {}).forEach(([k, v]) => { pagos[k] = (pagos[k] || 0) + v }))
    const cont = contado === '' || contado == null ? null : Number(contado) || 0
    const descuadre = cont == null ? null : cont - (pagos.efectivo || 0)
    return {
      cierres: [...state.cierres, {
        id: `z${Date.now()}`,
        desde,
        hasta: new Date().toISOString(),
        total, propinas, pagos,
        nTickets: tickets.length,
        contado: cont,
        descuadre,
      }],
    }
  }),

  // ── GESTIÓN DE SALA (admin) ────────────────────────────
  addMesa: () => set(state => {
    const maxNum = state.mesas.reduce((mx, x) => Math.max(mx, x.numero), 0)
    const ultZona = state.mesas[state.mesas.length - 1]?.zona || 'Sala'
    return { mesas: [...state.mesas, { id: `mesa-${Date.now()}`, numero: maxNum + 1, capacidad: 4, zona: ultZona, estado: 'libre', personas: [], abiertaDesde: null }] }
  }),

  removeMesa: (mesaId) => set(state => ({
    mesas: state.mesas.filter(m => !(m.id === mesaId && m.estado === 'libre')),
  })),

  updateMesa: (mesaId, cambios) => set(state => ({
    mesas: state.mesas.map(m => m.id !== mesaId ? m : {
      ...m,
      ...(cambios.capacidad !== undefined ? { capacidad: Math.max(1, Number(cambios.capacidad) || 1) } : {}),
      ...(cambios.zona !== undefined ? { zona: cambios.zona.trim() || 'Sala' } : {}),
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
          alergenos: producto.alergenos || [],
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
        if (cambios.alergenos !== undefined) next.alergenos = cambios.alergenos
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

  // ── CONFIG DE CARTA (categorías, panes, extras) ────────
  addCategoria: (nombre, tipo) => set(state => ({
    carta: { ...state.carta, categorias: [...state.carta.categorias, { id: `cat${Date.now()}`, nombre: (nombre || '').trim() || 'Nueva', tipo: tipo || 'comida', emoji: tipo === 'bebida' ? '🥤' : '🍽' }] },
  })),
  removeCategoria: (id) => set(state => ({
    carta: { ...state.carta, categorias: state.carta.categorias.filter(c => c.id !== id), productos: state.carta.productos.filter(p => p.categoria !== id) },
  })),
  addExtra: (nombre) => set(state => {
    const n = (nombre || '').trim()
    if (!n || state.carta.extras.includes(n)) return {}
    return { carta: { ...state.carta, extras: [...state.carta.extras, n] } }
  }),
  removeExtra: (nombre) => set(state => ({ carta: { ...state.carta, extras: state.carta.extras.filter(e => e !== nombre) } })),
  addTipoPan: (nombre, sup) => set(state => ({
    carta: { ...state.carta, tiposPan: [...state.carta.tiposPan, { id: `tp${Date.now()}`, nombre: (nombre || '').trim() || 'Pan', sup: Number(sup) || 0 }] },
  })),
  removeTipoPan: (id) => set(state => ({ carta: { ...state.carta, tiposPan: state.carta.tiposPan.filter(t => t.id !== id) } })),

  // ── UTILIDAD ───────────────────────────────────────────
  resetDatos: () => {
    localStorage.removeItem('tpv-hosteleria')
    location.reload()
  },
}), {
  name: 'tpv-hosteleria',
  version: 7, // v7: alérgenos en los productos de la carta
  migrate: () => undefined, // si cambia el formato de carta, descarta lo viejo y usa el por defecto
  partialize: (state) => ({
    local: state.local,
    empleados: state.empleados,
    carta: state.carta,
    mesas: state.mesas,
    pedidosCocina: state.pedidosCocina,
    pedidosBarra: state.pedidosBarra,
    avisos: state.avisos,
    historial: state.historial,
    cierres: state.cierres,
    reservas: state.reservas,
    reservasConfig: state.reservasConfig,
  }),
}))

// Estado al liberar una mesa (también limpia los enlaces de grupo).
const CAMPOS_LIBRE = { estado: 'libre', personas: [], abiertaDesde: null, camarero: null, reserva: null, unidas: [], unidaA: null }

// Ids de todas las mesas del grupo de `mesa` (ella + sus unidas).
function idsGrupo(mesa) {
  if (!mesa) return []
  return [mesa.id, ...((mesa.unidas) || [])]
}

// Crea el registro de ticket de una mesa al cerrarse (null si no consumió nada).
function snapshotMesa(mesa) {
  if (!mesa || !mesa.personas?.some(p => p.items.length)) return null
  const total = mesa.personas.reduce((s, p) => s + p.items.reduce((ss, i) => ss + i.precio * i.cantidad, 0), 0)
  const propina = mesa.personas.reduce((s, p) => s + (p.propina || 0), 0)
  // Desglose del total por método de pago (lo no cobrado se marca 'sincobrar')
  const pagos = {}
  mesa.personas.forEach(p => {
    const sub = p.items.reduce((ss, i) => ss + i.precio * i.cantidad, 0)
    if (sub <= 0) return
    const m = p.pagado ? (p.metodoPago || 'efectivo') : 'sincobrar'
    pagos[m] = (pagos[m] || 0) + sub
  })
  const cobradoPor = mesa.personas.find(p => p.cobradoPor)?.cobradoPor || mesa.camarero || null
  return { id: `t${Date.now()}-${mesa.numero}`, mesaNumero: mesa.numero, cerradaEn: new Date().toISOString(), total, propina, pagos, personas: mesa.personas, camarero: mesa.camarero || null, cobradoPor }
}

// ── DISPONIBILIDAD DE RESERVAS ───────────────────────────
const minDe = (hhmm) => { const [h, m] = (hhmm || '0:0').split(':').map(Number); return h * 60 + m }
const hhmmDe = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

// Genera los slots de reserva de un día según los turnos + intervalo.
export function generarSlots(config) {
  const slots = []
  ;(config.turnos || []).forEach(t => {
    for (let m = minDe(t.inicio); m < minDe(t.fin); m += config.intervaloMin) {
      slots.push({ turno: t.id, turnoNombre: t.nombre, hora: hhmmDe(m) })
    }
  })
  return slots
}

// Aforo total (comensales simultáneos): el configurado o la suma de plazas.
export function aforoTotal(config, mesas) {
  if (config.aforo != null && config.aforo !== '') return Number(config.aforo) || 0
  return mesas.reduce((s, m) => s + (Number(m.capacidad) || 0), 0)
}

// Aforo de una zona concreta (suma de plazas de sus mesas). Sin zona = aforo total.
export function aforoZona(config, mesas, zona) {
  if (!zona) return aforoTotal(config, mesas)
  return mesas.filter(m => m.zona === zona).reduce((s, m) => s + (Number(m.capacidad) || 0), 0)
}

// Comensales ya reservados que solapan [hora, hora+duración) en una fecha.
// Si se indica `zona`, solo cuenta las reservas de esa zona.
export function ocupacionEn(reservas, config, fecha, hora, zona, excluirId) {
  const dur = config.duracionMin
  const ini = minDe(hora), fin = ini + dur
  return reservas
    .filter(r => r.id !== excluirId && r.fecha === fecha && (r.estado === 'confirmada' || r.estado === 'sentada'))
    .filter(r => !zona || r.zona === zona)
    .filter(r => { const ri = minDe(r.hora), rf = ri + dur; return ri < fin && rf > ini })
    .reduce((s, r) => s + (Number(r.personas) || 0), 0)
}

// ¿Caben `personas` en ese slot sin superar el aforo (de la zona si se indica)?
export function slotDisponible(config, mesas, reservas, fecha, hora, personas, zona, excluirId) {
  return ocupacionEn(reservas, config, fecha, hora, zona, excluirId) + Number(personas || 0) <= aforoZona(config, mesas, zona)
}

// ¿El día (YYYY-MM-DD) está cerrado según la config?
export function diaCerrado(config, fecha) {
  const dia = new Date(fecha + 'T12:00:00').getDay() // 0=domingo … 6=sábado
  return (config.diasCerrados || []).includes(dia)
}

// Busca un empleado activo por PIN (control de acceso por PIN). Si se pide
// `soloAdmin`, solo valida administradores. Devuelve el empleado o null.
export function empleadoPorPin(empleados, pin, soloAdmin = false) {
  const e = (empleados || []).find(x => x.activo && x.pin === pin)
  if (!e) return null
  if (soloAdmin && e.rol !== 'admin') return null
  return e
}

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
