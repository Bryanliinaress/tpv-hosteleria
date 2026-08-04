import { useStore } from '../../store/useStore'
import { supabase } from '../supabase'
import { getLocalId, cargarCarta, cargarLocal } from './estado'

// ────────────────────────────────────────────────────────────────────────────
// Carta de arranque para un local NUEVO.
//
// Un bar que acaba de registrarse no tiene nada: si además le dejamos la carta
// vacía, no puede ni probar el TPV. Aquí se siembra la carta de ejemplo
// (bar/cafetería) que ya trae la app, para que la edite en vez de empezar de
// cero. Se inserta en bloque, no producto a producto.
// ────────────────────────────────────────────────────────────────────────────

// La plantilla es la carta de fábrica del store (una carta de bar española
// real: desayunos con formatos de pan, cafés y bebidas).
export function plantillaDeFabrica() {
  const inicial = useStore.getInitialState?.() || null
  const carta = inicial?.carta
  if (carta?.productos?.length) return carta
  // si zustand no expone el estado inicial, se usa el actual como referencia
  return useStore.getState().carta
}

export async function cartaVacia() {
  return (useStore.getState().carta?.productos || []).length === 0
}

// Siembra categorías + productos + config de carta (formatos, panes, extras).
export async function sembrarCartaEjemplo() {
  const localId = getLocalId()
  if (!localId) throw new Error('sin_local')
  const plantilla = plantillaDeFabrica()

  // 1) categorías (guardando la equivalencia con los ids de la plantilla)
  const { data: cats, error: e1 } = await supabase.from('categorias').insert(
    plantilla.categorias.map((c, i) => ({
      local_id: localId, nombre: c.nombre, tipo: c.tipo, emoji: c.emoji, orden: i,
    })),
  ).select('id, nombre')
  if (e1) throw e1
  const idDe = {}
  plantilla.categorias.forEach(c => {
    idDe[c.id] = cats.find(x => x.nombre === c.nombre)?.id
  })

  // 2) productos
  const filas = plantilla.productos.map((p, i) => ({
    local_id: localId,
    categoria_id: idDe[p.categoria],
    nombre: p.nombre,
    descripcion: p.descripcion || '',
    precios: p.precios || { base: p.precio ?? 0 },
    modificadores: { ingredientes: p.ingredientes || [], imagen: p.imagen || '' },
    alergenos: p.alergenos || [],
    disponible: p.disponible !== false,
    orden: i,
  })).filter(f => f.categoria_id)
  const { error: e2 } = await supabase.from('productos').insert(filas)
  if (e2) throw e2

  // 3) config de carta del local (formatos de pan, variedades y extras)
  const { data: loc } = await supabase.from('locales').select('config').eq('id', localId).single()
  const config = {
    ...(loc?.config || {}),
    carta: {
      formatos: plantilla.formatos || [],
      tiposPan: plantilla.tiposPan || [],
      extras: plantilla.extras || [],
      etiquetas: plantilla.etiquetas || undefined,
    },
  }
  await supabase.from('locales').update({ config }).eq('id', localId)

  await cargarLocal(); await cargarCarta()
  return filas.length
}

// Deja la carta vacía (el dueño prefiere partir de cero).
export async function vaciarCartaV2() {
  const localId = getLocalId()
  if (!localId) throw new Error('sin_local')
  const { error } = await supabase.from('productos').delete().eq('local_id', localId)
  if (error) throw error
  await cargarCarta()
}
