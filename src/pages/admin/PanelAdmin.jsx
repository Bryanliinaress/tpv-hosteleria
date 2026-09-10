import { useEffect, useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useStore, METODO_LABEL, METODO_EMOJI, metodosDe, propinasPorMetodoDe, ALERGENOS, normalizarExtra, etiquetasDe, ETIQUETAS_DEFECTO } from '../../store/useStore'
import { confirmar, toast, pedirTexto } from '../../store/useUI'
import { zonasDe, agruparPorZona } from '../../lib/sala'
import { copiar } from '../../lib/portapapeles'
import { urlStripe, refCorta } from '../../lib/stripe'
import { ROLES, ROLES_ORDENADOS, rolDe } from '../../lib/roles'
import Ticket from '../../components/Ticket'
import ReservasManager from '../../components/ReservasManager'
import ReservasConfig from '../../components/ReservasConfig'
import BotonSalir from '../../components/BotonSalir'
import TemaToggle from '../../components/TemaToggle'
import { useAltoCSS } from '../../components/useAltoCSS'
import EstadoFiscal from '../../components/EstadoFiscal'
import { productosVisibles, TIPOS_APARTADO, EMOJIS_APARTADO, emojiPorTipo, esExtremoDeApartado, agotadosDe } from '../../lib/carta'
import { perfil, urlPublica, urlDeMesa } from '../../lib/perfil'
import { esDelMes, esDelDia, horasEntre } from '../../lib/fechas'
import { loQueFaltaDelLocal } from '../../lib/local'
import { conNombre, jornadaDe } from '../../lib/fichajes'
import ConfigImpresora from '../../components/ConfigImpresora'
import EditorMenu from '../../components/EditorMenu'
import Informes from './Informes'
import Dispositivos from '../../components/Dispositivos'
import Devolver from '../../components/Devolver'
import { desgloseIVA, totalDe, cent, pendienteDeDevolver, importeDesdeTexto } from '../../lib/dinero'
import { efectivoEsperado, descuadreDe, saldoMovimientos, movimientosDesde, cobrosPorPersona } from '../../lib/caja'

const emptyForm = { nombre: '', nombreEn: '', categoria: '', descripcion: '', descripcionEn: '', alergenos: [], imagen: '', conFormatos: false, precios: {}, precio: '', menu: null, ivaPct: '' }

export default function PanelAdmin() {
  const { carta, mesas, historial, cierres, anulaciones, cambiosPrecio, pagosSinCuenta, reservas, local, updateLocal, empleados, addEmpleado, updateEmpleado, removeEmpleado, cerrarCaja, addProducto, updateProducto, deleteProducto, toggleDisponible, moverProducto, duplicarProducto, reponerTodo, resetDatos, addMesa, removeMesa, updateMesa, renumerarMesa, renombrarZona, moverZona, addCategoria, removeCategoria, updateCategoria, moverCategoria, addExtra, removeExtra, addTipoPan, removeTipoPan, addFormato, removeFormato, renombrarFormato, updateEtiquetas, fichajes, crearFichaje, editarFichaje, borrarFichaje, pedirFichajesDe, reintentarReembolso, movimientosCaja, registrarMovimiento } = useStore()
  const hoyStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
  const reservasHoy = reservas.filter(r => r.fecha === hoyStr && r.estado === 'confirmada').length
  const [tab, setTab] = useState('carta')
  const [busquedaCarta, setBusquedaCarta] = useState('')
  const [editando, setEditando] = useState(null) // productoId en edición
  const [form, setForm] = useState(emptyForm)
  const [devolviendo, setDevolviendo] = useState(null)   // ticket que se está devolviendo
  const [ticket, setTicket] = useState(null)
  // La tira de pestañas se pega DEBAJO de la cabecera, y la cabecera debajo de
  // la banda de demostración. Los tres altos se miden porque los tres cambian.
  const refCabecera = useAltoCSS('--alto-cabecera-admin')
  const etiquetas = etiquetasDe(carta)
  const zonasNombres = zonasDe(mesas).map(z => z.nombre)
  // el admin sí ve lo agotado: es lo que viene a reactivar
  const coincidencias = productosVisibles(carta, { busqueda: busquedaCarta, incluirNoDisponibles: true })
  const [contado, setContado] = useState('')
  const [movim, setMovim] = useState({ tipo: 'salida', importe: '', motivo: '' })
  // { zona } cuando se está dando de alta mesas; `zona: null` = la primera
  const [altaMesas, setAltaMesas] = useState(null)

  // Lo facturado HOY. Es lo primero que mira un dueño al abrir el panel, y
  // hasta ahora arriba ponía «Categorías 3», que es un dato de programador.
  // Las devoluciones son tickets en negativo, así que restan solas.
  const ticketsHoy = historial.filter(r => esDelDia(r.cerradaEn, hoyStr))
  const facturadoHoy = ticketsHoy.reduce((s2, r) => s2 + r.total, 0)

  // Tickets del mes en curso, agrupados por día (más reciente primero)
  const ahora = new Date()
  const delMes = historial.filter(r => { const d = new Date(r.cerradaEn); return d.getMonth() === ahora.getMonth() && d.getFullYear() === ahora.getFullYear() })
  const totalMes = delMes.reduce((s, r) => s + r.total, 0)
  const propinasMes = delMes.reduce((s, r) => s + (r.propina || 0), 0)
  // Ojo con la clave: agrupar por `toLocaleDateString` da «4/8/2026» y
  // ordenar eso como texto pone el 4 de agosto por delante del 13 («4» > «1»).
  // La clave es ISO —que ordena sola— y la fecha bonita se pinta al final.
  const porDia = {}
  delMes.forEach(r => {
    const d = new Date(r.cerradaEn)
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    ;(porDia[k] ||= []).push(r)
  })
  for (const k of Object.keys(porDia)) porDia[k].sort((a, b) => new Date(b.cerradaEn) - new Date(a.cerradaEn))
  const dias = Object.keys(porDia).sort().reverse()
  const diaBonito = (k) => new Date(`${k}T00:00:00`).toLocaleDateString('es-ES')

  // Copiar avisando de lo que PASÓ, no de lo que se pidió: si el navegador no
  // deja copiar —el TPV abierto por http en la red del bar no es contexto
  // seguro— decir «copiado» manda al encargado a pegar en Stripe lo que hubiera
  // antes en el portapapeles.
  const copiarTexto = async (texto, queEs) => {
    if (await copiar(texto)) toast(`${queEs} copiad${queEs.endsWith('a') ? 'a' : 'o'}`, 'success')
    else toast(`No se pudo copiar: selecciónal${queEs.endsWith('a') ? 'a' : 'o'} a mano`, 'error')
  }
  const copiarRef = (ref) => copiarTexto(ref, 'Referencia')

  // Lo ya devuelto de cada ticket (negativo). El servidor es quien manda —no
  // deja devolver más de lo pendiente—, pero la pantalla tiene que saberlo
  // igual: ofrecer «Devolver» sobre algo ya devuelto es prometer algo que
  // luego va a fallar delante del cliente que está reclamando.
  const devueltoDe = (ticketId) =>
    cent(historial.filter(t => t.rectificaA === ticketId).reduce((s2, t) => s2 + t.total, 0))

  const totalVentas = mesas.reduce((s, m) =>
    s + m.personas.reduce((ss, p) =>
      ss + totalDe(p), 0), 0)
  const mesasOcupadas = mesas.filter(m => m.estado !== 'libre').length

  // ── Arqueo de caja: tickets desde el último cierre ──
  const ultimoCierre = cierres.length ? cierres[cierres.length - 1] : null
  const desdeCaja = ultimoCierre?.hasta || null
  const ticketsCaja = historial.filter(r => !desdeCaja || new Date(r.cerradaEn) > new Date(desdeCaja))
  const cajaTotal = ticketsCaja.reduce((s, r) => s + r.total, 0)
  const cajaPropinas = ticketsCaja.reduce((s, r) => s + (r.propina || 0), 0)
  const cajaPagos = {}
  ticketsCaja.forEach(r => Object.entries(r.pagos || {}).forEach(([k, v]) => { cajaPagos[k] = (cajaPagos[k] || 0) + v }))
  // Personas por un lado y cobro por el móvil del cliente por otro: la regla
  // vive en `src/lib/caja.js`, que es donde están las cuentas del cajón.
  const cobrado = cobrosPorPersona(ticketsCaja)
  // Las propinas dejadas EN EFECTIVO también están en el cajón: si no se
  // esperan, el arqueo canta un sobrante que no existe.
  // el backend real no guarda las propinas agrupadas por método: se derivan del
  // detalle del ticket (ver propinasPorMetodoDe)
  const cajaPropinasEfectivo = ticketsCaja.reduce((s, r) => s + (propinasPorMetodoDe(r).efectivo || 0), 0)
  const efectivoVentas = cajaPagos.efectivo || 0
  // El fondo de cambio y lo que entra o sale del cajón sin ser venta. Sin esto
  // el «descuadre» era la diferencia contra una cuenta incompleta y cantaba el
  // fondo entero como sobrante cada día (ver src/lib/caja.js).
  const fondoCaja = Number(local?.fondoCaja) || 0
  const movsCaja = movimientosDesde(movimientosCaja, ultimoCierre?.hasta || null)
  const saldoMovs = saldoMovimientos(movsCaja)
  const efectivoEsp = efectivoEsperado({
    fondo: fondoCaja, ventasEfectivo: efectivoVentas,
    propinasEfectivo: cajaPropinasEfectivo, movimientos: movsCaja,
  })
  const descuadre = descuadreDe(importeDesdeTexto(contado), efectivoEsp)
  const apuntarMovimiento = () => {
    const r = registrarMovimiento({ ...movim, creadoPor: 'admin' })
    if (!r.ok) return toast(r.error, 'error')
    setMovim({ tipo: movim.tipo, importe: '', motivo: '' })
    toast('Movimiento apuntado', 'success')
  }
  const hacerCierre = async () => {
    if (ticketsCaja.length === 0 && movsCaja.length === 0) return
    if (!(await confirmar({ titulo: 'Cerrar caja', mensaje: ticketsCaja.length
      ? `¿Cerrar caja con ${ticketsCaja.length} ticket(s) y ${cajaTotal.toFixed(2)} €?`
      : `Hoy no se ha vendido nada, pero hay ${movsCaja.length} movimiento(s) del cajón. ¿Cerrar la caja igual?`, confirmar: 'Cerrar caja' }))) return
    cerrarCaja(contado)
    setContado('')
    toast('Caja cerrada correctamente', 'success')
  }

  const empezarNuevo = (categoriaId) => {
    setEditando('nuevo')
    setForm({ ...emptyForm, categoria: categoriaId })
  }
  const empezarEdicion = (prod) => {
    setEditando(prod.id)
    setForm({
      nombre: prod.nombre, nombreEn: prod.nombreEn || '', categoria: prod.categoria, descripcion: prod.descripcion, descripcionEn: prod.descripcionEn || '', alergenos: prod.alergenos || [], imagen: prod.imagen || '',
      conFormatos: !!prod.precios,
      precios: prod.precios ? Object.fromEntries(Object.entries(prod.precios).map(([k, v]) => [k, String(v)])) : {},
      precio: String(prod.precio ?? ''),
      ivaPct: prod.ivaPct == null ? '' : String(prod.ivaPct),
    })
  }
  const cancelar = () => { setEditando(null); setForm(emptyForm) }
  const guardar = () => {
    if (!form.nombre.trim() || !form.categoria) return
    const payload = { ...form, precios: form.conFormatos ? form.precios : {} }
    // sin grupos no es un menú: se guarda como producto normal
    if (!payload.menu?.grupos?.length) payload.menu = null
    if (editando === 'nuevo') addProducto(payload)
    else updateProducto(editando, payload)
    cancelar()
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div ref={refCabecera} style={{ position: 'sticky', top: 'var(--alto-aviso, 0px)', zIndex: 20, background: 'linear-gradient(180deg, var(--color-surface), var(--color-surface-2))', borderBottom: '1px solid var(--color-border)', boxShadow: '0 6px 18px -10px rgba(0,0,0,0.6)', padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
        <div>
          <h1 style={{ fontWeight: 800, fontSize: '1.25rem' }}>🛠 Panel Administración</h1>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.8rem' }}>{local.nombre || 'Gestión del local'}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <TemaToggle compacto />
          <button onClick={async () => {
            // Un clic de más borraba el día entero (mesas abiertas, tickets,
            // fichajes y arqueo) sin preguntar nada.
            const enServidor = import.meta.env.VITE_BACKEND === 'v2'
            const ok = await confirmar({
              titulo: 'Reiniciar datos',
              mensaje: enServidor
                ? 'Vacía la copia guardada en ESTE dispositivo y la vuelve a bajar del servidor. Los datos del local no se tocan.'
                : 'Borra TODOS los datos de este dispositivo: mesas abiertas, tickets del día, fichajes y arqueo. No se puede deshacer.',
              peligro: !enServidor,
              confirmar: enServidor ? 'Recargar' : 'Borrar todo',
            })
            if (ok) resetDatos()
          }} title={import.meta.env.VITE_BACKEND === 'v2' ? 'Vuelve a bajar los datos del servidor' : 'Borra los datos guardados en este dispositivo'} style={{ background: 'var(--color-surface-2)', color: 'var(--color-muted)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.5rem 0.875rem', cursor: 'pointer', fontSize: '0.8rem' }}>
            ↺ Reiniciar datos
          </button>
          <BotonSalir />
        </div>
      </div>

      {/* Stats rápidas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(8.5rem, 1fr))', gap: '0.75rem', padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)' }}>
        {[
          { label: 'Facturado hoy', value: `${facturadoHoy.toFixed(2)} €`, color: '#10b981' },
          { label: 'Tickets hoy', value: ticketsHoy.length, color: 'var(--tint-info-fg)' },
          { label: 'Mesas ocupadas', value: `${mesasOcupadas}/${mesas.length}`, color: 'var(--tint-warning-fg)' },
          { label: 'Sin cobrar en sala', value: `${totalVentas.toFixed(2)} €`, color: 'var(--color-accent)' },
        ].map(s => (
          <div key={s.label} style={{ position: 'relative', overflow: 'hidden', background: 'var(--color-surface)', borderRadius: 'var(--radius)', padding: '1rem', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '3px', height: '100%', background: s.color }} />
            <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginBottom: '0.25rem' }}>{s.label}</div>
            <div style={{ fontWeight: 800, fontSize: '1.4rem', color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)', overflowX: 'auto', position: 'sticky', top: 'calc(var(--alto-aviso, 0px) + var(--alto-cabecera-admin, 0px))', zIndex: 15, scrollbarWidth: 'thin' }}>
        {[
          { id: 'carta', label: '📋 Carta' },
          { id: 'local', label: '🏪 Local' },
          { id: 'personal', label: '👥 Personal' },
          { id: 'mesas', label: '🍽 Mesas' },
          { id: 'reservas', label: `📅 Reservas${reservasHoy ? ` (${reservasHoy})` : ''}` },
          { id: 'caja', label: '💰 Caja' },
          { id: 'informes', label: '📊 Informes' },
          { id: 'dispositivos', label: '🔗 Dispositivos' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: 'none', border: 'none', padding: '0.875rem 1.1rem', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, minHeight: '48px',
            color: tab === t.id ? 'var(--color-accent)' : 'var(--color-muted)',
            borderBottom: tab === t.id ? '2px solid var(--color-accent)' : '2px solid transparent',
            fontWeight: tab === t.id ? 700 : 400, fontSize: '0.875rem',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, padding: '1.25rem', overflowY: 'auto' }}>
        {/* Tab Carta */}
        {tab === 'carta' && (
          <div>
            {/* Con 50+ productos, encontrar «el mixto» no puede ser bajar 6.000 px */}
            <div style={{ position: 'relative', marginBottom: '1rem' }}>
              <input value={busquedaCarta} onChange={e => setBusquedaCarta(e.target.value)} placeholder="🔍 Buscar en la carta…"
                style={{ background: 'var(--color-inset)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.65rem 0.85rem', color: 'var(--color-text)', width: '100%', fontSize: '0.9rem', minHeight: '44px' }} />
              {busquedaCarta && <button onClick={() => setBusquedaCarta('')} aria-label="Limpiar búsqueda" style={{ ...iconBtn, position: 'absolute', right: '0.2rem', top: '50%', transform: 'translateY(-50%)' }}>✕</button>}
            </div>
            {busquedaCarta.trim() && (
              <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '0.75rem' }}>
                {coincidencias.length} de {carta.productos.length} productos coinciden con «{busquedaCarta}»
              </p>
            )}

            {/* Lo agotado, arriba: al día siguiente se repone la nevera entera y
                había que ir producto por producto para devolverlos. */}
            <Agotados carta={carta} reponerTodo={reponerTodo} />
            {carta.categorias.map((cat, i) => {
              const productosCat = busquedaCarta.trim()
                ? coincidencias.filter(p => p.categoria === cat.id)
                : carta.productos.filter(p => p.categoria === cat.id)
              // buscando, una categoría sin resultados solo estorba
              if (busquedaCarta.trim() && productosCat.length === 0) return null
              return (
              <div key={cat.id} style={{ marginBottom: '1.5rem' }}>
                <CabeceraApartado
                  cat={cat} carta={carta}
                  primero={i === 0} ultimo={i === carta.categorias.length - 1}
                  editable={!busquedaCarta.trim()}
                  onAñadir={() => empezarNuevo(cat.id)}
                  updateCategoria={updateCategoria} moverCategoria={moverCategoria} removeCategoria={removeCategoria} />

                {/* Formulario nuevo producto dentro de esta categoría */}
                {editando === 'nuevo' && form.categoria === cat.id && (
                  <FormProducto carta={carta} form={form} setForm={setForm} onGuardar={guardar} onCancelar={cancelar} titulo="Nuevo producto" />
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: '0.625rem' }}>
                  {productosCat.map(prod => (
                    editando === prod.id ? (
                      <FormProducto key={prod.id} carta={carta} form={form} setForm={setForm} onGuardar={guardar} onCancelar={cancelar} titulo="Editar producto" />
                    ) : (
                      <div key={prod.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0.625rem', padding: '0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', opacity: prod.disponible ? 1 : 0.5 }}>
                        {prod.imagen && <img src={prod.imagen} alt="" onError={e => { e.currentTarget.style.display = 'none' }} style={{ width: '2.4rem', height: '2.4rem', objectFit: 'cover', borderRadius: '0.4rem', flexShrink: 0 }} />}
                        {/* Con seis botones al lado, `flex: 1` a secas dejaba
                            el nombre en una letra por línea. Con una base, en
                            un móvil los botones se bajan solos. */}
                        <div style={{ flex: '1 1 11rem', minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                            {prod.nombre}
                            {!prod.disponible && <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: '#f43f5e' }}>(agotado)</span>}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                            {prod.descripcion}
                            {(prod.alergenos || []).length > 0 && <span title={prod.alergenos.map(a => ALERGENOS.find(x => x.id === a)?.nombre || a).join(', ')} style={{ marginLeft: '0.4rem' }}>{prod.alergenos.map(a => ALERGENOS.find(x => x.id === a)?.emoji || '•').join('')}</span>}
                          </div>
                          {/* El precio, debajo del nombre y CON el formato al lado.
                              Dos numeros sueltos en una columna aparte no dicen
                              cual es cual —el nombre del formato solo estaba en
                              un `title`, que en una tablet no se ve nunca— y
                              encima estrujaban el nombre a cuatro lineas. */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.15rem 0.7rem', marginTop: '0.3rem', fontWeight: 700, color: 'var(--color-accent)', fontSize: '0.85rem' }}>
                            {prod.precios
                              ? Object.entries(prod.precios).map(([k, v]) => (
                                  <span key={k} style={{ whiteSpace: 'nowrap' }}>
                                    <span style={{ color: 'var(--color-muted)', fontWeight: 400, fontSize: '0.72rem' }}>{carta.formatos.find(f => f.id === k)?.nombre || k} </span>
                                    {Number(v).toFixed(2)} €
                                  </span>
                                ))
                              : <span style={{ whiteSpace: 'nowrap' }}>{(prod.precio ?? 0).toFixed(2)} €</span>}
                            {/* Solo si NO es el del local: marcarlo en los 58
                                productos sería ruido; marcarlo en los dos que
                                se salen es justo el aviso que hace falta. */}
                            {prod.ivaPct != null && Number(prod.ivaPct) !== Number(local.ivaPct ?? 10) && (
                              <span style={{ fontWeight: 700, fontSize: '0.7rem', color: 'var(--tint-warning-fg)', background: 'var(--tint-warning-bg)', border: '1px solid var(--tint-warning-bd)', borderRadius: '9999px', padding: '0.05rem 0.45rem', whiteSpace: 'nowrap' }}>
                                IVA {Number(prod.ivaPct)}%
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.2rem', alignItems: 'center', marginLeft: 'auto' }}>
                          {/* El orden de los productos es el que ve el cliente
                              al escanear el QR. Buscando no se enseñan: la
                              lista filtrada no es el orden de la carta. */}
                          {!busquedaCarta.trim() && (() => {
                            const { primero, ultimo } = esExtremoDeApartado(carta.productos, prod.id)
                            return <>
                              <button onClick={() => moverProducto(prod.id, -1)} disabled={primero} title="Subir en la carta" aria-label={`Subir ${prod.nombre}`} style={{ ...iconBtn, width: '1.9rem', opacity: primero ? 0.25 : 1 }}>▲</button>
                              <button onClick={() => moverProducto(prod.id, 1)} disabled={ultimo} title="Bajar en la carta" aria-label={`Bajar ${prod.nombre}`} style={{ ...iconBtn, width: '1.9rem', opacity: ultimo ? 0.25 : 1 }}>▼</button>
                            </>
                          })()}
                          <button onClick={() => toggleDisponible(prod.id)} title={prod.disponible ? 'Marcar agotado' : 'Marcar disponible'} aria-label={prod.disponible ? `Marcar ${prod.nombre} agotado` : `Marcar ${prod.nombre} disponible`} style={iconBtn}>{prod.disponible ? '🟢' : '⚪'}</button>
                          {/* Ocho bocadillos que solo cambian el relleno: sin
                              esto, cada uno es teclear otra vez precio,
                              formatos, alérgenos e IVA. */}
                          <button onClick={() => { const r = duplicarProducto(prod.id); toast(r.ok ? `Copiado como «${prod.nombre} (copia)» · renómbralo` : r.error, r.ok ? 'success' : 'error') }} title="Duplicar" aria-label={`Duplicar ${prod.nombre}`} style={iconBtn}>⧉</button>
                          <button onClick={() => empezarEdicion(prod)} title="Editar" aria-label={`Editar ${prod.nombre}`} style={iconBtn}>✏️</button>
                          {/* separado del resto: es el único que no tiene vuelta atrás */}
                          <button onClick={async () => { if (await confirmar({ titulo: 'Borrar producto', mensaje: `¿Borrar "${prod.nombre}" de la carta?`, peligro: true, confirmar: 'Borrar' })) { deleteProducto(prod.id); toast('Producto borrado', 'success') } }} title="Borrar" aria-label={`Borrar ${prod.nombre}`} style={{ ...iconBtn, marginLeft: '0.5rem' }}>🗑️</button>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </div>
              )
            })}

            {/* Crear apartados y personalizar productos, aquí y no en otra
                pestaña: es donde estás mirando cuando te falta uno. */}
            {!busquedaCarta.trim() && <>
              <NuevoApartado carta={carta} addCategoria={addCategoria} />
              <OpcionesCarta
                carta={carta} etiquetas={etiquetas}
                addExtra={addExtra} removeExtra={removeExtra}
                addTipoPan={addTipoPan} removeTipoPan={removeTipoPan}
                addFormato={addFormato} removeFormato={removeFormato} renombrarFormato={renombrarFormato}
                updateEtiquetas={updateEtiquetas} />
            </>}
          </div>
        )}

        {/* Tab Mesas (configuración de sala) */}
        {tab === 'mesas' && (
          <div>
            <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              La sala, por zonas. Cada zona enseña sus plazas —que es su aforo para la reserva online— y cada mesa lleva su pegatina QR. (Solo se pueden borrar mesas libres.)
            </p>

            {!altaMesas && (
              <button onClick={() => setAltaMesas({ zona: null })} style={{ width: '100%', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px dashed var(--color-border)', borderRadius: '0.75rem', padding: '0.9rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                ➕ Añadir mesas
              </button>
            )}
            {altaMesas && (
              <NuevasMesas mesas={mesas} zonas={zonasNombres} addMesa={addMesa}
                zonaPorDefecto={altaMesas.zona} onHecho={() => setAltaMesas(null)} />
            )}

            {agruparPorZona(mesas).map(grupo => (
              <SeccionZona key={grupo.zona} grupo={grupo} zonas={zonasNombres}
                renombrarZona={renombrarZona} moverZona={moverZona}
                onAñadir={() => setAltaMesas({ zona: grupo.sinZona ? null : grupo.zona })}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '0.875rem' }}>
                  {grupo.mesas.map(m => (
                    <TarjetaMesa key={m.id} m={m} zonas={zonasNombres}
                      updateMesa={updateMesa} renumerarMesa={renumerarMesa} removeMesa={removeMesa}
                      copiarTexto={copiarTexto} />
                  ))}
                </div>
              </SeccionZona>
            ))}

            {mesas.length === 0 && (
              <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 1rem' }}>
                Todavía no hay mesas. La sala empieza arriba, en «Añadir mesas».
              </p>
            )}

            <PegatinasQR mesas={mesas} local={local} />
          </div>
        )}

        {/* Tab Reservas (agenda) */}
        {tab === 'reservas' && (
          <div style={{ maxWidth: '640px' }}>
            <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Las reservas del día. Las que entran solas por la página pública <code style={{ color: 'var(--tint-info-fg)' }}>/reservar</code> y las que coges tú por teléfono. Asigna una mesa y siéntalos cuando lleguen.
            </p>
            <ReservasConfig />
            <ReservasManager />
          </div>
        )}

        {/* Tab Caja (arqueo / cierre) */}
        {tab === 'caja' && (
          <>
          {/* Arriba, lo que reclama algo HOY: dinero cobrado que hay que
              devolver y tickets que no han llegado a Hacienda —ese hay que
              atenderlo el mismo día o ya no entra—. Debajo, cuadrar y cerrar,
              que es lo único que se hace a diario. Y plegado, lo que se
              consulta: los tickets, el cajón, los cierres y las anulaciones. */}
          {/* Dinero cobrado que no cuadró con ninguna cuenta. Pasa cuando dos
              comensales pagan a la vez desde sus móviles y el segundo llega con
              la cuenta ya saldada: el cobro se guarda, pero no salía en NINGUNA
              pantalla, así que nadie sabía que hay que devolverlo. */}
          {pagosSinCuenta.length > 0 && (
            <div style={{
              background: 'var(--tint-warning-bg)', color: 'var(--tint-warning-fg)',
              border: '1px solid var(--tint-warning-bd)', borderRadius: 'var(--radius)',
              padding: '0.9rem 1rem', marginBottom: '1.25rem',
            }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.15rem' }}>
                ⚠️ {pagosSinCuenta.length} cobro(s) sin cuenta · {pagosSinCuenta.reduce((s2, p2) => s2 + p2.importe, 0).toFixed(2)} €
              </div>
              <div style={{ fontSize: '0.8rem', opacity: 0.9, marginBottom: '0.6rem' }}>
                Entraron cuando la cuenta ya estaba saldada (dos personas pagando a la vez).
                El dinero está cobrado y <strong>hay que devolverlo desde Stripe</strong>: no está en ningún ticket.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {pagosSinCuenta.map(p2 => (
                  <div key={p2.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', background: 'var(--color-surface)', borderRadius: '0.5rem', padding: '0.45rem 0.55rem' }}>
                    <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {new Date(p2.creadoEn).toLocaleDateString('es-ES')} · {p2.importe.toFixed(2)} €
                    </span>
                    <Referencia texto={p2.referencia} />
                    <button onClick={() => copiarRef(p2.referencia)} title="Copiar la referencia entera"
                      style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '0.375rem', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      📋 Copiar
                    </button>
                    <a href={urlStripe(p2.referencia)} target="_blank" rel="noreferrer" title="Abrir este cobro en Stripe para devolverlo"
                      style={{ background: '#635bff', color: '#fff', borderRadius: '0.375rem', padding: '0.3rem 0.6rem', fontSize: '0.75rem', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                      Devolver en Stripe ↗
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
          <EstadoFiscal />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem', alignItems: 'start' }}>
            {/* Arqueo de la caja abierta */}
            <div style={ajusteCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
                <h3 style={ajusteTitulo}>Caja abierta</h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>
                  desde {ultimoCierre ? new Date(ultimoCierre.hasta).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : 'el inicio'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', marginBottom: '1rem' }}>
                <div style={{ background: 'var(--color-inset)', borderRadius: '0.625rem', padding: '0.75rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>Ventas</div>
                  <div style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--color-accent)' }}>{cajaTotal.toFixed(2)} €</div>
                </div>
                <div style={{ background: 'var(--color-inset)', borderRadius: '0.625rem', padding: '0.75rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>Tickets</div>
                  <div style={{ fontWeight: 800, fontSize: '1.3rem', color: '#3b82f6' }}>{ticketsCaja.length}</div>
                </div>
                <div style={{ background: 'var(--color-inset)', borderRadius: '0.625rem', padding: '0.75rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>Propinas</div>
                  <div style={{ fontWeight: 800, fontSize: '1.3rem', color: '#10b981' }}>{cajaPropinas.toFixed(2)} €</div>
                </div>
                <div style={{ background: 'var(--color-inset)', borderRadius: '0.625rem', padding: '0.75rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>Ticket medio</div>
                  <div style={{ fontWeight: 800, fontSize: '1.3rem', color: '#8b5cf6' }}>{(ticketsCaja.length ? cajaTotal / ticketsCaja.length : 0).toFixed(2)} €</div>
                </div>
              </div>

              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--color-muted)' }}>Desglose por método</h4>
              {metodosDe(cajaPagos).length === 0
                ? <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>Sin cobros todavía.</p>
                : metodosDe(cajaPagos).map(k => (
                  <div key={k} style={ajusteFila}>
                    <span>{METODO_EMOJI[k] || '💰'} {METODO_LABEL[k] || k}</span>
                    <strong>{cajaPagos[k].toFixed(2)} €</strong>
                  </div>
                ))}

              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: '1rem 0 0.5rem', color: 'var(--color-muted)' }}>Cobrado por cada persona</h4>
              {cobrado.personas.length === 0
                ? <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>Nadie ha cobrado nada todavía.</p>
                : cobrado.personas.map(c => (
                  <div key={c.nombre} style={{ ...ajusteFila, gap: '0.75rem' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>👤 {c.nombre}</span>
                    <strong style={{ whiteSpace: 'nowrap' }}>{c.total.toFixed(2)} €</strong>
                  </div>
                ))}
              {cobrado.sinAsignar > 0 && (
                <div style={ajusteFila}>
                  <span style={{ color: 'var(--color-muted)' }}>❓ Sin asignar</span><strong>{cobrado.sinAsignar.toFixed(2)} €</strong>
                </div>
              )}
              {/* El pago online no lo cobra nadie: lo hace el cliente desde su
                  móvil. Salía en la lista de arriba como si fuera un empleado. */}
              {cobrado.online > 0 && (
                <div style={{ ...ajusteFila, alignItems: 'flex-start', gap: '0.75rem', borderBottom: 'none', marginTop: '0.35rem', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border)' }}>
                  <span style={{ color: 'var(--color-muted)' }}>
                    📱 Pagó el cliente por el móvil
                    <span style={{ display: 'block', fontSize: '0.72rem', opacity: 0.75 }}>no lo cobró nadie: no pasó por el cajón</span>
                  </span>
                  <strong style={{ whiteSpace: 'nowrap' }}>{cobrado.online.toFixed(2)} €</strong>
                </div>
              )}
            </div>

            {/* Cierre de caja (Z) */}
            <div style={ajusteCard}>
              <h3 style={ajusteTitulo}>Cerrar caja (Z)</h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)', marginBottom: '0.75rem' }}>
                Cuenta el efectivo del cajón y ciérrala. Quedará registrado el arqueo y empezará una caja nueva.
              </p>
              <label style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>Efectivo contado (opcional)</label>
              <input value={contado} onChange={e => setContado(e.target.value)} inputMode="decimal" placeholder="€ en el cajón" style={{ ...inputStyle, marginTop: '0.25rem', marginBottom: '0.5rem' }} />
              {fondoCaja > 0 && (
                <div style={{ ...ajusteFila, color: 'var(--color-muted)' }}>
                  <span>Fondo de cambio</span><strong>{fondoCaja.toFixed(2)} €</strong>
                </div>
              )}
              <div style={ajusteFila}><span>{fondoCaja > 0 ? '+ ventas' : 'Ventas'} en efectivo</span><strong>{efectivoVentas.toFixed(2)} €</strong></div>
              {cajaPropinasEfectivo > 0 && (
                <div style={{ ...ajusteFila, color: 'var(--color-muted)' }}>
                  <span>+ propinas en efectivo</span><strong>{cajaPropinasEfectivo.toFixed(2)} €</strong>
                </div>
              )}
              {saldoMovs !== 0 && (
                <div style={{ ...ajusteFila, color: 'var(--color-muted)' }}>
                  <span>{saldoMovs > 0 ? '+ entradas' : '− salidas'} de caja ({movsCaja.length})</span>
                  <strong>{saldoMovs > 0 ? '+' : ''}{saldoMovs.toFixed(2)} €</strong>
                </div>
              )}
              <div style={{ ...ajusteFila, fontWeight: 700 }}><span>Efectivo esperado en el cajón</span><strong>{efectivoEsp.toFixed(2)} €</strong></div>
              {descuadre != null && (
                <div style={{ ...ajusteFila, color: Math.abs(descuadre) < 0.005 ? '#10b981' : '#f43f5e' }}>
                  <span>Descuadre</span><strong>{descuadre >= 0 ? '+' : ''}{descuadre.toFixed(2)} €</strong>
                </div>
              )}
              {(() => { const sePuede = ticketsCaja.length > 0 || movsCaja.length > 0; return (
              <button onClick={hacerCierre} disabled={!sePuede} title={sePuede ? '' : 'No hay ni ventas ni movimientos que cerrar'} style={{ width: '100%', marginTop: '0.875rem', background: sePuede ? 'var(--color-accent)' : 'var(--color-surface-3)', color: sePuede ? '#fff' : 'var(--color-text)', border: 'none', borderRadius: '0.5rem', padding: '0.8rem', cursor: sePuede ? 'pointer' : 'not-allowed', fontWeight: 700 }}>
                🔒 Cerrar caja
              </button>
              ) })()}
            </div>

          </div>

          <Plegable icono="🧾" titulo="Tickets del mes" resumen={`${delMes.length} · ${totalMes.toFixed(2)} € facturados`}>
            <TicketsDelMes
              delMes={delMes} dias={dias} porDia={porDia} diaBonito={diaBonito}
              mesNombre={ahora.toLocaleDateString('es-ES', { month: 'long' })}
              totalMes={totalMes} propinasMes={propinasMes} historial={historial}
              devueltoDe={devueltoDe} setDevolviendo={setDevolviendo} setTicket={setTicket}
              reintentarReembolso={reintentarReembolso} />
          </Plegable>

          <Plegable icono="↔" titulo="Entradas y salidas del cajón" resumen={`${movsCaja.length} en esta caja${saldoMovs !== 0 ? ` · ${saldoMovs > 0 ? '+' : ''}${saldoMovs.toFixed(2)} €` : ''}`}>
          {/* ── Entradas y salidas del cajón ────────────────────────────
              Por un cajón pasa mucho más que ventas: el fondo de cambio con
              el que se abre, lo que se saca para pagar al del pan, el cambio
              que se mete a media tarde. Sin apuntarlo, el arqueo no cuadra
              nunca y se deja de mirar. */}
          <div style={ajusteCard}>
            <label style={lblCampo}>Fondo de cambio (queda siempre en el cajón)</label>
            <CampoGuardado valor={local.fondoCaja != null ? String(local.fondoCaja) : ''} onGuardar={v => updateLocal({ fondoCaja: importeDesdeTexto(v) ?? 0 })} placeholder="0.00" style={{ ...inputStyle, marginBottom: '0.9rem' }} />

            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' }}>
              {[['salida', '− Sacar'], ['entrada', '+ Meter']].map(([t2, etiqueta]) => (
                <button key={t2} onClick={() => setMovim(s2 => ({ ...s2, tipo: t2 }))}
                  style={{ flex: 1, background: movim.tipo === t2 ? 'var(--color-accent)' : 'var(--color-surface-2)', color: movim.tipo === t2 ? '#fff' : 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.5rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}>
                  {etiqueta}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' }}>
              <input value={movim.importe} onChange={e => setMovim(s2 => ({ ...s2, importe: e.target.value }))} inputMode="decimal" placeholder="€" style={{ ...inputStyle, flex: '0 1 90px', marginBottom: 0 }} />
              <input value={movim.motivo} onChange={e => setMovim(s2 => ({ ...s2, motivo: e.target.value }))} placeholder="Para qué (proveedor, banco, cambio…)" style={{ ...inputStyle, flex: 1, marginBottom: 0 }} />
            </div>
            <button onClick={apuntarMovimiento} style={{ ...addBtn, width: '100%' }}>Apuntar</button>

            {movsCaja.length > 0 && (
              <div style={{ marginTop: '0.9rem' }}>
                {movsCaja.slice().reverse().map(m => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', background: 'var(--color-inset)', borderRadius: '0.5rem', padding: '0.5rem 0.7rem', marginBottom: '0.35rem', fontSize: '0.82rem' }}>
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {new Date(m.creadoEn).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} · {m.motivo}
                    </span>
                    <strong style={{ color: m.tipo === 'salida' ? '#f43f5e' : '#10b981', whiteSpace: 'nowrap' }}>
                      {m.tipo === 'salida' ? '−' : '+'}{Number(m.importe).toFixed(2)} €
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </div>

          </Plegable>

          {/* Sin ningún cierre todavía no hay nada que consultar: un plegable
              que se abre y está vacío es una promesa incumplida. */}
          {cierres.length > 0 && (
          <Plegable icono="🔒" titulo="Cierres anteriores" resumen={`${cierres.length} cierre(s)`}>
            <div style={ajusteCard}>
            {cierres.length > 0 && (
              <>
                  {cierres.slice().reverse().map(z => (
                  <div key={z.id} style={{ background: 'var(--color-inset)', borderRadius: '0.5rem', padding: '0.6rem 0.75rem', marginBottom: '0.4rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.85rem' }}>
                      <span>{new Date(z.hasta).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      <span style={{ color: 'var(--color-accent)' }}>{z.total.toFixed(2)} €</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>
                      {z.nTickets} ticket(s)
                      {metodosDe(z.pagos).map(k => ` · ${METODO_EMOJI[k] || '💰'} ${z.pagos[k].toFixed(2)}`).join('')}
                      {z.descuadre != null && Math.abs(z.descuadre) >= 0.005 && <span style={{ color: '#f43f5e' }}> · descuadre {z.descuadre >= 0 ? '+' : ''}{z.descuadre.toFixed(2)} €</span>}
                    </div>
                  </div>
                ))}
              </>
            )}            </div>
          </Plegable>
          )}

          {/* Cambiar un precio es la forma en que el dinero se va de un bar
              sin que nadie robe nada. Se mira aquí, al lado de las
              anulaciones, porque se miran por lo mismo y a la vez. */}
          <Plegable icono="💶" titulo="Cambios de precio" resumen={`${(cambiosPrecio || []).length} en total`}>
          <div style={ajusteCard}>
            {(cambiosPrecio || []).length === 0
              ? <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>Sin cambios de precio registrados.</p>
              : (
                <>
                  <div style={{ ...ajusteFila, fontWeight: 700 }}>
                    <span>Diferencia acumulada</span>
                    {(() => {
                      const d = (cambiosPrecio || []).reduce((s2, x) => s2 + (x.diferencia || 0), 0)
                      return <span style={{ color: d < 0 ? '#f43f5e' : '#10b981' }}>{d > 0 ? '+' : ''}{d.toFixed(2)} €</span>
                    })()}
                  </div>
                  {(cambiosPrecio || []).slice(-15).reverse().map(x => (
                    <div key={x.id} style={{ background: 'var(--color-inset)', borderRadius: '0.5rem', padding: '0.55rem 0.75rem', marginBottom: '0.4rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 700, gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span>M{x.mesaNumero} · {x.cantidad}× {x.nombre}</span>
                        <span style={{ color: (x.diferencia || 0) < 0 ? '#f43f5e' : '#10b981' }}>
                          {(x.antes || 0).toFixed(2)} → {(x.despues || 0).toFixed(2)} €
                        </span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>
                        {new Date(x.fecha).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                        {x.por ? ` · 👤 ${x.por}` : ''} · «{x.motivo}»
                      </div>
                    </div>
                  ))}
                  <p style={{ fontSize: '0.68rem', color: 'var(--color-faint)', marginTop: '0.25rem' }}>Se muestran los últimos 15.</p>
                </>
              )}
          </div>
          </Plegable>

          <Plegable icono="⊘" titulo="Anulaciones" resumen={`${(anulaciones || []).length} en total`}>
          {/* Auditoría de anulaciones */}
          <div style={ajusteCard}>
            {(anulaciones || []).length === 0
              ? <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>Sin anulaciones registradas.</p>
              : (
                <>
                  <div style={{ ...ajusteFila, fontWeight: 700 }}>
                    <span>Importe anulado (total)</span>
                    <span style={{ color: '#f43f5e' }}>{(anulaciones || []).reduce((s, a) => s + (a.importe || 0), 0).toFixed(2)} €</span>
                  </div>
                  {(anulaciones || []).slice(-15).reverse().map(a => (
                    <div key={a.id} style={{ background: 'var(--color-inset)', borderRadius: '0.5rem', padding: '0.55rem 0.75rem', marginBottom: '0.4rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 700 }}>
                        <span>M{a.mesaNumero} · {a.cantidad}× {a.nombre}{a.enviado ? ' 🔥' : ''}</span>
                        <span style={{ color: '#f43f5e' }}>−{(a.importe || 0).toFixed(2)} €</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>
                        {new Date(a.fecha).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                        {a.por ? ` · 👤 ${a.por}` : ''} · «{a.motivo}»
                      </div>
                    </div>
                  ))}
                  <p style={{ fontSize: '0.68rem', color: 'var(--color-faint)', marginTop: '0.25rem' }}>🔥 = ya estaba enviada a cocina/barra. Se muestran las últimas 15.</p>
                </>
              )}
          </div>
          </Plegable>
          </>
        )}

        {/* Tab Dispositivos: quién puede entrar al TPV de este bar. Tiene
            pestaña propia a propósito — es lo que hay que encontrar rápido
            cuando un aparato se queda fuera. */}
        {tab === 'dispositivos' && <Dispositivos />}

        {/* Tab Local (identidad del negocio) */}
        {tab === 'local' && (<>
          {/* Un hueco vacío aquí no se nota hasta que sale un ticket sin
              dirección o un «Llámanos» que no lleva a ningún sitio. Arriba del
              todo, y diciendo DÓNDE se nota cada uno. */}
          <LoQueFalta local={local} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', alignItems: 'start' }}>
            <div style={ajusteCard}>
              <h3 style={ajusteTitulo}>Datos del local</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '0.9rem' }}>Aparecen en los tickets, las cabeceras y la página de reservas.</p>
              <label style={lblCampo}>Nombre del local</label>
              <CampoGuardado valor={local.nombre || ''} onGuardar={v => updateLocal({ nombre: v })} placeholder="Mi Bar" style={{ ...inputStyle, marginBottom: '0.7rem' }} />
              <label style={lblCampo}>Subtítulo</label>
              <CampoGuardado valor={local.subtitulo || ''} onGuardar={v => updateLocal({ subtitulo: v })} placeholder="Bar · Cafetería" style={{ ...inputStyle, marginBottom: '0.7rem' }} />
              <label style={lblCampo}>Dirección</label>
              <CampoGuardado valor={local.direccion || ''} onGuardar={v => updateLocal({ direccion: v })} placeholder="Calle, número, ciudad" style={{ ...inputStyle, marginBottom: '0.7rem' }} />
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={lblCampo}>Teléfono</label>
                  <CampoGuardado valor={local.telefono || ''} onGuardar={v => updateLocal({ telefono: v })} placeholder="600 000 000" style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={lblCampo}>CIF / NIF</label>
                  <CampoGuardado valor={local.cif || ''} onGuardar={v => updateLocal({ cif: v })} placeholder="B12345678" style={inputStyle} />
                </div>
              </div>
            </div>

            <div style={ajusteCard}>
              <h3 style={ajusteTitulo}>Facturación y ticket</h3>
              <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.7rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={lblCampo}>IVA incluido (%)</label>
                  {/* `type="number"` se COME la coma: en un teclado español,
                      escribir «10,5» dejaba el campo vacío, y vacío se guardaba
                      como 0 → todos los tickets con «IVA (0%)». Igual que el
                      efectivo contado del arqueo, va como texto decimal. */}
                  <CampoGuardado valor={local.ivaPct ?? ''} onGuardar={v => updateLocal({ ivaPct: v })} inputMode="decimal" placeholder="10" style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={lblCampo}>Moneda</label>
                  <CampoGuardado valor={local.moneda || ''} onGuardar={v => updateLocal({ moneda: v })} placeholder="€" style={inputStyle} />
                </div>
              </div>
              <label style={lblCampo}>Razón social (ticket)</label>
              <CampoGuardado valor={local.razonSocial || ''} onGuardar={v => updateLocal({ razonSocial: v })} placeholder="Si difiere del nombre comercial" style={{ ...inputStyle, marginBottom: '0.7rem' }} />
              <label style={lblCampo}>Dirección fiscal (ticket)</label>
              <CampoGuardado valor={local.direccionFiscal || ''} onGuardar={v => updateLocal({ direccionFiscal: v })} placeholder="Si difiere de la dirección" style={{ ...inputStyle, marginBottom: '0.7rem' }} />
              <label style={lblCampo}>URL de reseñas (QR del ticket)</label>
              <CampoGuardado valor={local.urlResena || ''} onGuardar={v => updateLocal({ urlResena: v })} placeholder="https://g.page/r/... (vacío = QR a la carta)" style={{ ...inputStyle, marginBottom: '0.7rem' }} />
              <label style={lblCampo}>Pie del ticket</label>
              <CampoGuardado valor={local.pieTicket || ''} onGuardar={v => updateLocal({ pieTicket: v })} placeholder="¡Gracias por su visita!" style={{ ...inputStyle, marginBottom: '1rem' }} />

              {/* Vista previa del encabezado del ticket */}
              <div style={{ background: '#fff', color: '#111', borderRadius: '0.4rem', padding: '0.9rem', fontFamily: '"Courier New", monospace', textAlign: 'center', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.05em' }}>{(local.nombre || 'Mi Local').toUpperCase()}</div>
                {local.subtitulo && <div style={{ fontSize: '0.72rem', color: '#444' }}>{local.subtitulo}</div>}
                {local.direccion && <div style={{ fontSize: '0.72rem', color: '#444' }}>{local.direccion}</div>}
                {local.cif && <div style={{ fontSize: '0.72rem', color: '#444' }}>CIF: {local.cif}</div>}
                <div style={{ borderTop: '1px dashed #999', margin: '0.5rem 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700 }}><span>TOTAL</span><span>10,00 {local.moneda || '€'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#555' }}><span>IVA ({local.ivaPct || 0}%) incluido</span><span>{desgloseIVA(10, local.ivaPct).iva.toFixed(2)} {local.moneda || '€'}</span></div>
                <div style={{ borderTop: '1px dashed #999', margin: '0.5rem 0' }} />
                <div style={{ fontSize: '0.72rem' }}>{local.pieTicket || '¡Gracias por su visita!'}</div>
              </div>
            </div>
          </div>

          {/* La impresión sí vive aquí: es cómo está montado este bar y se toca
              al montarlo. Los DISPOSITIVOS volvieron a su pestaña — son la
              salida de emergencia cuando alguien se queda fuera, y ahí dentro
              costaba encontrarlos justo en el peor momento. */}
          <Plegable icono="🖨" titulo="Impresión" resumen="cómo imprime ESTE dispositivo">
            <div style={{ maxWidth: '640px' }}><ConfigImpresora /></div>
          </Plegable>
        </>)}

        {/* Tab Informes */}
        {/* Los informes ya no reciben el historial: los calcula el servidor por
            rango de fechas, así que valen para cualquier periodo y no solo para
            el trozo que este aparato tenga descargado. */}
        {tab === 'informes' && <Informes moneda={local.moneda || '€'} />}

        {/* Tab Fichajes (registro de jornada) */}
        {/* Tab Personal (empleados y accesos) */}
        {tab === 'personal' && (
          <PersonalTab empleados={empleados} addEmpleado={addEmpleado} updateEmpleado={updateEmpleado} removeEmpleado={removeEmpleado}
            fichajes={fichajes} crearFichaje={crearFichaje} editarFichaje={editarFichaje} borrarFichaje={borrarFichaje}
            local={local} pedirFichajesDe={pedirFichajesDe} />
        )}

        {/* Tab Tickets del mes */}
        {devolviendo && (
          <Devolver ticket={devolviendo.ticket} pendiente={devolviendo.pendiente}
            onCerrar={() => setDevolviendo(null)} />
        )}

      </div>

      {ticket && <Ticket tipo="cuenta" mesa={ticket} rectifica={ticket.rectifica} onClose={() => setTicket(null)} />}
    </div>
  )
}

// Formatea una fecha ISO al valor de un <input type="datetime-local"> (hora local).
const isoALocal = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const off = d.getTimezoneOffset() * 60000
  return new Date(d - off).toISOString().slice(0, 16)
}
const localAIso = (v) => (v ? new Date(v).toISOString() : null)
const fmtH = (h) => `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m`

// Se guarda al SALIR del campo, no en cada tecla. En la app real cada pulsación
// era una escritura en la BBDD; y en los datos del local, además, un
// leer-modificar-escribir por letra: dos campos seguidos se pisaban entre sí.
// ────────────────────────────────────────────────────────────────────────────
// La sala, por zonas.
//
// Era una rejilla plana de doce tarjetas ordenadas por zona y número: con tres
// zonas no se veía dónde empieza la terraza, y la zona solo existía como un
// texto dentro de cada mesa. Ahora cada zona es una sección con lo suyo a
// mano — cuántas mesas y cuántas plazas tiene (que es su aforo para la reserva
// online), renombrarla, absorberla en otra y añadir mesas ahí dentro.
// ────────────────────────────────────────────────────────────────────────────
function SeccionZona({ grupo, zonas, renombrarZona, moverZona, onAñadir, children }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '1.1rem' }}>{grupo.sinZona ? '❓' : '📍'}</span>
        <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>{grupo.zona}</h3>
        {/* Las plazas de la zona son su aforo en la reserva online: el cliente
            que elige «Terraza» solo puede reservar hasta ese número. */}
        <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
          {grupo.mesas.length} mesa{grupo.mesas.length === 1 ? '' : 's'} · {grupo.plazas} plazas
        </span>
        <div style={{ display: 'flex', gap: '0.2rem', marginLeft: 'auto', alignItems: 'center' }}>
          {!grupo.sinZona && (
            <button onClick={() => setAbierto(v => !v)} title="Editar zona" aria-label={`Editar zona ${grupo.zona}`} style={{ ...iconBtn, color: abierto ? 'var(--color-accent)' : 'inherit' }}>⚙️</button>
          )}
          <button onClick={onAñadir} style={{ background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 0.9rem', minHeight: '40px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
            + Mesa aquí
          </button>
        </div>
      </div>
      {abierto && <EditorZona grupo={grupo} zonas={zonas} onCerrar={() => setAbierto(false)} renombrarZona={renombrarZona} moverZona={moverZona} />}
      {children}
    </div>
  )
}

function EditorZona({ grupo, zonas, onCerrar, renombrarZona, moverZona }) {
  const [nombre, setNombre] = useState(grupo.zona)
  const [absorbiendo, setAbsorbiendo] = useState(false)
  const [destino, setDestino] = useState('')
  const otras = zonas.filter(z => z !== grupo.zona)

  const guardar = () => {
    if (nombre.trim() === grupo.zona) return onCerrar()
    const r = renombrarZona(grupo.zona, nombre)
    if (!r.ok) return toast(r.error, 'error')
    toast(`Zona renombrada en ${grupo.mesas.length} mesa(s)`, 'success')
    onCerrar()
  }
  const absorber = () => {
    const r = moverZona(grupo.zona, destino)
    if (!r.ok) return toast(r.error, 'error')
    toast(`${r.movidas} mesa(s) movidas a «${destino}»`, 'success')
  }

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0.75rem', padding: '0.9rem', marginBottom: '0.9rem' }}>
      <label style={lblCampo}>Nombre de la zona <span style={{ opacity: 0.7 }}>· se cambia en sus {grupo.mesas.length} mesa(s)</span></label>
      <input value={nombre} onChange={e => setNombre(e.target.value)} style={{ ...inputStyle, marginBottom: '0.7rem' }} />
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button onClick={guardar} style={{ ...addBtn, flex: '1 1 8rem' }}>Guardar ✓</button>
        <button onClick={onCerrar} style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.5rem 0.85rem', cursor: 'pointer', fontSize: '0.82rem' }}>Cancelar</button>
        {otras.length > 0 && (
          <button onClick={() => setAbsorbiendo(v => !v)} style={{ background: 'none', color: 'var(--tint-warning-fg)', border: 'none', padding: '0.5rem 0.6rem', cursor: 'pointer', fontSize: '0.82rem', marginLeft: 'auto' }}>📦 Quitar esta zona</button>
        )}
      </div>

      {/* Una zona no es una tabla: es lo que hay escrito en sus mesas. Para
          quitarla hay que decir a dónde van las mesas — borrarlas sería borrar
          la sala. */}
      {absorbiendo && (
        <div style={{ background: 'var(--tint-warning-bg)', border: '1px solid var(--tint-warning-bd)', borderRadius: '0.6rem', padding: '0.75rem', marginTop: '0.7rem' }}>
          <p style={{ fontSize: '0.82rem', color: 'var(--tint-warning-fg)', marginBottom: '0.6rem', lineHeight: 1.5 }}>
            «{grupo.zona}» tiene <strong>{grupo.mesas.length} mesa(s)</strong>. Las mesas no se borran: se mudan a otra zona, y esta desaparece.
          </p>
          <label style={lblCampo}>Se mudan a</label>
          <select value={destino} onChange={e => setDestino(e.target.value)} style={{ ...inputStyle, marginBottom: '0.6rem' }}>
            <option value="">Elige la zona…</option>
            {otras.map(z => <option key={z} value={z}>{z}</option>)}
          </select>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={absorber} disabled={!destino} style={{ background: destino ? 'var(--color-accent)' : 'var(--color-surface-3)', color: destino ? '#fff' : 'var(--color-muted)', border: 'none', borderRadius: '0.5rem', padding: '0.55rem 0.9rem', cursor: destino ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '0.82rem' }}>
              Mover las mesas y quitar la zona
            </button>
            <button onClick={() => setAbsorbiendo(false)} style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.55rem 0.85rem', cursor: 'pointer', fontSize: '0.82rem' }}>Dejarlo</button>
          </div>
        </div>
      )}
    </div>
  )
}

// Una mesa. El QR vive aquí, en la mesa a la que pertenece, y no en otra
// pestaña: cuando cambias una mesa de sitio o la renumeras, su pegatina es lo
// siguiente que hay que reimprimir.
function TarjetaMesa({ m, zonas, updateMesa, renumerarMesa, removeMesa, copiarTexto }) {
  const [verQR, setVerQR] = useState(false)
  const libre = m.estado === 'libre'
  const url = urlDeMesa(m.id)
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0.875rem', padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem' }}>
        <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>Mesa {m.numero}</span>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: libre ? '#10b981' : '#f59e0b' }}>{libre ? 'Libre' : 'Ocupada'}</span>
      </div>
      {/* El número sale en el ticket, en la comanda de cocina y en el QR de la
          pegatina: cambiarlo se comprueba, no se guarda a lo que salga. */}
      <label style={lblCampo}>Número</label>
      <CampoGuardado valor={m.numero} onGuardar={v => { const r = renumerarMesa(m.id, v); if (!r.ok) toast(r.error, 'error'); else toast(`Ahora es la mesa ${v}`, 'success'); return r }} type="number" min="1" style={{ ...inputStyle, marginBottom: '0.5rem' }} />
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.625rem' }}>
        <div style={{ flex: '1 1 60%' }}>
          <label style={lblCampo}>Zona</label>
          <select value={m.zona || ''} onChange={async e => {
            if (e.target.value !== '__nueva') return updateMesa(m.id, { zona: e.target.value })
            const z = await pedirTexto({ titulo: 'Nueva zona', mensaje: '¿Cómo se llama?', placeholder: 'Terraza', confirmar: 'Crear' })
            if (z?.trim()) updateMesa(m.id, { zona: z.trim() })
          }} style={inputStyle}>
            {zonas.map(z => <option key={z} value={z}>{z}</option>)}
            {!m.zona && <option value="">Sin zona</option>}
            <option value="__nueva">➕ Nueva zona…</option>
          </select>
        </div>
        <div style={{ flex: '1 1 40%' }}>
          <label style={lblCampo}>Plazas</label>
          <CampoGuardado valor={m.capacidad} onGuardar={v => updateMesa(m.id, { capacidad: v })} type="number" min="1" style={inputStyle} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.4rem' }}>
        <button onClick={() => setVerQR(v => !v)} style={{ flex: 1, background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.45rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
          {verQR ? '▲ Ocultar QR' : '📱 Ver su QR'}
        </button>
        <button onClick={async () => { if (libre && await confirmar({ titulo: 'Borrar mesa', mensaje: `¿Borrar la mesa ${m.numero}?`, peligro: true, confirmar: 'Borrar' })) { removeMesa(m.id); toast('Mesa borrada', 'success') } }} disabled={!libre} title={libre ? 'Borrar mesa' : 'Está ocupada'} style={{ background: 'none', color: libre ? '#f43f5e' : '#64748b', border: 'none', borderRadius: '0.5rem', padding: '0.45rem 0.7rem', cursor: libre ? 'pointer' : 'not-allowed', fontSize: '0.85rem' }}>🗑️</button>
      </div>

      {verQR && (
        <div style={{ marginTop: '0.7rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ background: 'white', padding: '0.6rem', borderRadius: '0.5rem' }}>
            <QRCodeSVG value={url} size={128} level="M" />
          </div>
          <code style={{ fontSize: '0.62rem', color: '#a78bfa', wordBreak: 'break-all', textAlign: 'center' }}>{url}</code>
          <button onClick={() => copiarTexto(url, 'Dirección')} style={{ width: '100%', background: 'var(--color-surface-2)', color: 'var(--color-muted)', border: '1px solid var(--color-border)', borderRadius: '0.375rem', padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.75rem' }}>
            Copiar enlace
          </button>
        </div>
      )}
    </div>
  )
}

// Alta de mesas: cuántas, de cuántas plazas y en qué zona, de una vez. Montar
// un bar de doce mesas eran doce clics y luego doce ediciones.
function NuevasMesas({ mesas, zonas, addMesa, zonaPorDefecto, onHecho }) {
  const [cuantas, setCuantas] = useState('1')
  const [capacidad, setCapacidad] = useState('4')
  const [zona, setZona] = useState(zonaPorDefecto || zonas[0] || 'Sala')
  const [numero, setNumero] = useState('')
  const siguiente = Math.max(0, ...mesas.map(m => Number(m.numero) || 0)) + 1

  const crear = () => {
    const r = addMesa({ zona, capacidad, cuantas, numero })
    if (!r.ok) return toast(r.error, 'error')
    toast(`${r.creadas} mesa(s) añadidas a «${zona}»`, 'success')
    setCuantas('1'); setNumero('')
    onHecho?.()
  }

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-accent)', borderRadius: '0.75rem', padding: '0.9rem', marginBottom: '1.25rem' }}>
      <h3 style={{ ...ajusteTitulo, marginBottom: '0.7rem' }}>➕ Añadir mesas</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.7rem' }}>
        <label style={{ flex: '1 1 5rem' }}>
          <span style={lblCampo}>Cuántas</span>
          <input type="number" min="1" max="50" value={cuantas} onChange={e => setCuantas(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ flex: '1 1 5rem' }}>
          <span style={lblCampo}>Plazas</span>
          <input type="number" min="1" value={capacidad} onChange={e => setCapacidad(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ flex: '1 1 8rem' }}>
          <span style={lblCampo}>Zona</span>
          {/* Una zona no se crea sola en ninguna parte: es lo que hay escrito
              en sus mesas. Sin esto habría que crear la mesa en otra zona y
              luego moverla, que es como se hacía y no se le ocurre a nadie. */}
          <select value={zona} onChange={async e => {
            if (e.target.value !== '__nueva') return setZona(e.target.value)
            const z = await pedirTexto({ titulo: 'Nueva zona', mensaje: '¿Cómo se llama? Se crea con estas mesas.', placeholder: 'Terraza', confirmar: 'Usarla' })
            if (z?.trim()) setZona(z.trim())
          }} style={inputStyle}>
            {[...new Set([...zonas, zona].filter(Boolean))].map(z => <option key={z} value={z}>{z}</option>)}
            <option value="__nueva">➕ Nueva zona…</option>
          </select>
        </label>
        <label style={{ flex: '1 1 7rem' }}>
          <span style={lblCampo}>Empezar en el nº</span>
          <input type="number" min="1" value={numero} onChange={e => setNumero(e.target.value)} placeholder={String(siguiente)} style={inputStyle} />
        </label>
      </div>
      <p style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginBottom: '0.8rem' }}>
        Se numeran seguidas desde el {numero.trim() || siguiente}. Si alguna de esas ya existe, no se crea ninguna: te lo dice antes.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button onClick={crear} style={{ ...addBtn, flex: 1 }}>Añadir a la sala ✓</button>
        {onHecho && <button onClick={onHecho} style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.5rem 0.85rem', cursor: 'pointer', fontSize: '0.82rem' }}>Cancelar</button>}
      </div>
    </div>
  )
}

// La hoja de pegatinas. Estaba en su propia pestaña, «QR Codes», y es de las
// mesas: cuando renumeras una, su pegatina es lo siguiente que hay que
// reimprimir. Va plegada porque son doce QR y estorban al configurar la sala.
function PegatinasQR({ mesas, local }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <div className="no-print" style={{ marginTop: '1.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '1.25rem' }}>
      <button onClick={() => setAbierto(v => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0.75rem', padding: '0.85rem 1rem', cursor: 'pointer', color: 'var(--color-text)', textAlign: 'left' }}>
        <span style={{ fontSize: '1.1rem' }}>📱</span>
        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Pegatinas QR de las mesas</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{mesas.length} para imprimir y recortar</span>
        <span style={{ marginLeft: 'auto', color: 'var(--color-muted)' }}>{abierto ? '▲' : '▼'}</span>
      </button>

      {abierto && (
        <div style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', margin: 0, flex: '1 1 320px' }}>
              Cada mesa tiene su QR único. Al escanearlo, el cliente abre directamente la carta de esa mesa.
              {' '}Apuntan a <code style={{ fontSize: '0.8rem', color: 'var(--color-accent)' }}>{urlPublica()}</code>
            </p>
            <button onClick={() => window.print()} style={{ background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.6rem 1rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
              🖨 Imprimir las {mesas.length}
            </button>
          </div>
          {/* Sin `url` en el perfil (build genérica) los QR salen con la
              dirección desde la que se abrió Admin, que puede no ser la del
              bar. Mejor decirlo que imprimir doce pegatinas muertas. */}
          {!perfil.url && (
            <div style={{ background: 'var(--tint-warning-bg)', color: 'var(--tint-warning-fg)', border: '1px solid var(--tint-warning-bd)', borderRadius: 'var(--radius)', padding: '0.75rem 0.9rem', marginBottom: '1rem', fontSize: '0.83rem' }}>
              ⚠️ Esta instalación no tiene dirección propia configurada, así que los QR usan <strong>la dirección desde la que has abierto este panel</strong>. Compruébala arriba antes de imprimir.
            </div>
          )}
          <div className="qr-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.875rem' }}>
            {[...mesas].sort((a, b) => a.numero - b.numero).map(m => (
              <div key={m.id} className="qr-tarjeta" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0.75rem', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.625rem' }}>
                <div className="solo-print" style={{ fontWeight: 700, fontSize: '0.9rem' }}>{local.nombre || ''}</div>
                <div style={{ fontWeight: 700 }}>Mesa {m.numero}</div>
                <div style={{ background: 'white', padding: '0.625rem', borderRadius: '0.5rem' }}>
                  <QRCodeSVG value={urlDeMesa(m.id)} size={128} level="M" />
                </div>
                <div className="solo-print" style={{ fontSize: '0.75rem', textAlign: 'center' }}>Escanea para ver la carta y pedir</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Lo que está agotado. Se marca durante el servicio —se acabó la tortilla— y
// se repone al día siguiente, todo de golpe: devolverlo producto por producto
// es la clase de tarea que se olvida, y un plato que sigue «agotado» tres días
// después es dinero que no se vende.
function Agotados({ carta, reponerTodo }) {
  const agotados = agotadosDe(carta)
  if (!agotados.length) return null
  return (
    <div style={{ background: 'var(--tint-warning-bg)', color: 'var(--tint-warning-fg)', border: '1px solid var(--tint-warning-bd)', borderRadius: 'var(--radius)', padding: '0.8rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 14rem', fontSize: '0.85rem' }}>
        <strong>{agotados.length} producto(s) agotado(s)</strong>
        <span style={{ opacity: 0.85 }}> · el cliente no los ve en la carta: {agotados.slice(0, 4).map(p => p.nombre).join(', ')}{agotados.length > 4 ? ` y ${agotados.length - 4} más` : ''}</span>
      </div>
      <button onClick={() => { const r = reponerTodo(); toast(r.ok ? `${r.repuestos} producto(s) de vuelta en la carta` : r.error, r.ok ? 'success' : 'error') }}
        style={{ background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 0.9rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
        🔄 Reponer todo
      </button>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Un apartado de la carta, con todo lo suyo a mano.
//
// Antes: crear y borrar, y solo desde la pestaña Ajustes. Renombrar no se
// podía —una errata obligaba a borrar el apartado y con él sus doce
// bocadillos—, el emoji lo elegía el código y el orden era el de creación,
// que es justo el orden en el que el cliente ve la carta al escanear el QR.
// ────────────────────────────────────────────────────────────────────────────
function CabeceraApartado({ cat, carta, primero, ultimo, editable, onAñadir, updateCategoria, moverCategoria, removeCategoria }) {
  const [abierto, setAbierto] = useState(false)
  const t = TIPOS_APARTADO[cat.tipo] || TIPOS_APARTADO.comida
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '1.1rem' }}>{cat.emoji}</span>
        <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>{cat.nombre}</h3>
        {/* Antes ponía «comida» / «bebida», que no dice nada. Lo que importa
            de ese dato es por qué impresora sale la comanda. */}
        <span title={t.desc} style={{ fontSize: '0.72rem', background: cat.tipo === 'comida' ? 'var(--tint-success-bg)' : 'var(--tint-danger-bg)', color: cat.tipo === 'comida' ? 'var(--tint-success-fg)' : 'var(--tint-danger-fg)', borderRadius: '9999px', padding: '0.15rem 0.55rem', whiteSpace: 'nowrap' }}>
          {t.emoji} {t.label}
        </span>
        <div style={{ display: 'flex', gap: '0.2rem', marginLeft: 'auto', alignItems: 'center' }}>
          {editable && <>
            <button onClick={() => moverCategoria(cat.id, -1)} disabled={primero} title="Subir en la carta" aria-label={`Subir ${cat.nombre}`} style={{ ...iconBtn, opacity: primero ? 0.3 : 1 }}>▲</button>
            <button onClick={() => moverCategoria(cat.id, 1)} disabled={ultimo} title="Bajar en la carta" aria-label={`Bajar ${cat.nombre}`} style={{ ...iconBtn, opacity: ultimo ? 0.3 : 1 }}>▼</button>
            <button onClick={() => setAbierto(v => !v)} title="Editar apartado" aria-label={`Editar apartado ${cat.nombre}`} style={{ ...iconBtn, color: abierto ? 'var(--color-accent)' : 'inherit' }}>⚙️</button>
          </>}
          <button onClick={onAñadir} style={{ background: 'var(--color-accent)', color: 'white', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 0.9rem', minHeight: '40px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
            + Añadir
          </button>
        </div>
      </div>
      {abierto && (
        <EditorApartado cat={cat} carta={carta} onCerrar={() => setAbierto(false)}
          updateCategoria={updateCategoria} removeCategoria={removeCategoria} />
      )}
    </div>
  )
}

function EditorApartado({ cat, carta, onCerrar, updateCategoria, removeCategoria }) {
  const [nombre, setNombre] = useState(cat.nombre)
  const [emoji, setEmoji] = useState(cat.emoji || '')
  const [tipo, setTipo] = useState(cat.tipo)
  const [borrando, setBorrando] = useState(false)
  const [destino, setDestino] = useState('')
  const cuantos = carta.productos.filter(p => p.categoria === cat.id).length
  const otros = carta.categorias.filter(c => c.id !== cat.id)

  const guardar = () => {
    const r = updateCategoria(cat.id, { nombre, emoji, tipo })
    if (!r.ok) return toast(r.error, 'error')
    toast('Apartado guardado', 'success')
    onCerrar()
  }
  const borrar = () => {
    removeCategoria(cat.id, { moverA: destino || undefined })
    toast(destino ? `Apartado borrado · ${cuantos} producto(s) movidos` : 'Apartado borrado', 'success')
  }

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0.75rem', padding: '0.9rem', marginTop: '0.6rem' }}>
      <label style={lblCampo}>Nombre del apartado</label>
      <input value={nombre} onChange={e => setNombre(e.target.value)} style={{ ...inputStyle, marginBottom: '0.7rem' }} />

      <label style={lblCampo}>Icono <span style={{ opacity: 0.7 }}>· lo ve el cliente en la carta</span></label>
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginBottom: '0.4rem' }}>
        <input value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={4} style={{ ...inputStyle, width: '4rem', textAlign: 'center', fontSize: '1.1rem' }} />
        <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>o elige uno:</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.75rem' }}>
        {EMOJIS_APARTADO.map(e => (
          <button key={e} onClick={() => setEmoji(e)} aria-label={`Icono ${e}`} style={{
            background: emoji === e ? 'var(--color-accent)' : 'var(--color-surface-2)',
            border: '1px solid var(--color-border)', borderRadius: '0.45rem',
            width: '2.2rem', height: '2.2rem', cursor: 'pointer', fontSize: '1.05rem', lineHeight: 1,
          }}>{e}</button>
        ))}
      </div>

      <label style={lblCampo}>¿A dónde van sus comandas?</label>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
        {Object.entries(TIPOS_APARTADO).map(([k, v]) => (
          <button key={k} onClick={() => setTipo(k)} style={{
            flex: '1 1 8rem', background: tipo === k ? 'var(--color-accent)' : 'var(--color-surface-2)',
            color: tipo === k ? '#fff' : 'var(--color-text)', border: `1px solid ${tipo === k ? 'var(--color-accent)' : 'var(--color-border)'}`,
            borderRadius: '0.55rem', padding: '0.6rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem',
          }}>{v.emoji} {v.label}</button>
        ))}
      </div>
      {/* Elegirlo mal manda los platos a la impresora de la barra. Decirlo
          aquí cuesta una línea; descubrirlo, un servicio. */}
      <p style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginBottom: '0.9rem', lineHeight: 1.45 }}>
        {(TIPOS_APARTADO[tipo] || TIPOS_APARTADO.comida).desc}.
        {tipo !== cat.tipo && <strong style={{ color: 'var(--tint-warning-fg)' }}> Cambia también los {cuantos} producto(s) que ya tiene.</strong>}
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button onClick={guardar} style={{ ...addBtn, flex: '1 1 8rem' }}>Guardar cambios ✓</button>
        <button onClick={onCerrar} style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.5rem 0.85rem', cursor: 'pointer', fontSize: '0.82rem' }}>Cancelar</button>
        <button onClick={() => setBorrando(v => !v)} style={{ background: 'none', color: '#f43f5e', border: 'none', padding: '0.5rem 0.6rem', cursor: 'pointer', fontSize: '0.82rem', marginLeft: 'auto' }}>🗑️ Borrar apartado</button>
      </div>

      {/* Borrar un apartado se llevaba sus productos por delante sin decir
          cuántos. Aquí se dice, y se pueden salvar pasándolos a otro. */}
      {borrando && (
        <div style={{ background: 'var(--tint-danger-bg)', border: '1px solid var(--tint-danger-bd)', borderRadius: '0.6rem', padding: '0.75rem', marginTop: '0.7rem' }}>
          <p style={{ fontSize: '0.82rem', color: 'var(--tint-danger-fg)', marginBottom: '0.6rem', lineHeight: 1.5 }}>
            {cuantos === 0
              ? <>«{cat.nombre}» está vacío: no se pierde nada.</>
              : <>«{cat.nombre}» tiene <strong>{cuantos} producto(s)</strong>. Si lo borras sin más, se van con él.</>}
          </p>
          {cuantos > 0 && otros.length > 0 && (
            <>
              <label style={lblCampo}>Qué hago con ellos</label>
              <select value={destino} onChange={e => setDestino(e.target.value)} style={{ ...inputStyle, marginBottom: '0.6rem' }}>
                <option value="">Borrarlos también</option>
                {otros.map(c => <option key={c.id} value={c.id}>Moverlos a {c.emoji} {c.nombre}</option>)}
              </select>
            </>
          )}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={borrar} style={{ background: '#7f1d1d', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.55rem 0.9rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem' }}>
              {destino ? 'Mover y borrar el apartado' : 'Borrar apartado y sus productos'}
            </button>
            <button onClick={() => setBorrando(false)} style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.55rem 0.85rem', cursor: 'pointer', fontSize: '0.82rem' }}>Dejarlo</button>
          </div>
        </div>
      )}
    </div>
  )
}

// Crear un apartado, al final de la carta y no escondido en otra pestaña: es
// donde estás mirando cuando te das cuenta de que te falta uno.
function NuevoApartado({ carta, addCategoria }) {
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState('comida')
  const [emoji, setEmoji] = useState('')

  const crear = () => {
    const r = addCategoria(nombre, tipo, emoji || emojiPorTipo(tipo))
    if (!r.ok) return toast(r.error, 'error')
    toast(`Apartado «${nombre.trim()}» creado`, 'success')
    setNombre(''); setEmoji(''); setTipo('comida'); setAbierto(false)
  }

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} style={{ width: '100%', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px dashed var(--color-border)', borderRadius: '0.75rem', padding: '0.9rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
        ➕ Nuevo apartado
      </button>
    )
  }
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-accent)', borderRadius: '0.75rem', padding: '0.9rem' }}>
      <h3 style={{ ...ajusteTitulo, marginBottom: '0.7rem' }}>➕ Nuevo apartado</h3>
      <label style={lblCampo}>Nombre <span style={{ opacity: 0.7 }}>· Bocadillos, Postres, Vinos…</span></label>
      <input value={nombre} onChange={e => setNombre(e.target.value)} autoFocus placeholder="Bocadillos" style={{ ...inputStyle, marginBottom: '0.7rem' }} />

      <label style={lblCampo}>¿A dónde van sus comandas?</label>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
        {Object.entries(TIPOS_APARTADO).map(([k, v]) => (
          <button key={k} onClick={() => setTipo(k)} style={{
            flex: '1 1 8rem', background: tipo === k ? 'var(--color-accent)' : 'var(--color-surface-2)',
            color: tipo === k ? '#fff' : 'var(--color-text)', border: `1px solid ${tipo === k ? 'var(--color-accent)' : 'var(--color-border)'}`,
            borderRadius: '0.55rem', padding: '0.6rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem',
          }}>{v.emoji} {v.label}</button>
        ))}
      </div>
      <p style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginBottom: '0.9rem' }}>{TIPOS_APARTADO[tipo].desc}.</p>

      <label style={lblCampo}>Icono</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.9rem' }}>
        {EMOJIS_APARTADO.map(e => (
          <button key={e} onClick={() => setEmoji(e)} aria-label={`Icono ${e}`} style={{
            background: (emoji || emojiPorTipo(tipo)) === e ? 'var(--color-accent)' : 'var(--color-surface-2)',
            border: '1px solid var(--color-border)', borderRadius: '0.45rem',
            width: '2.2rem', height: '2.2rem', cursor: 'pointer', fontSize: '1.05rem', lineHeight: 1,
          }}>{e}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button onClick={crear} disabled={!nombre.trim()} style={{ ...addBtn, flex: 1, opacity: nombre.trim() ? 1 : 0.5, cursor: nombre.trim() ? 'pointer' : 'not-allowed' }}>Crear apartado ✓</button>
        <button onClick={() => setAbierto(false)} style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.5rem 0.85rem', cursor: 'pointer', fontSize: '0.82rem' }}>Cancelar</button>
      </div>
      {carta.categorias.length === 0 && (
        <p style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: '0.7rem' }}>
          Sin apartados no se pueden dar de alta productos: la carta empieza aquí.
        </p>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Cómo se personaliza un producto: formatos, variedades, añadidos y cómo se
// llaman esos tres grupos en la carta del cliente.
//
// Vivía en la pestaña «Ajustes», al lado de la configuración de la impresora,
// que no tiene nada que ver. Para añadir un formato había que salir de la
// carta, ir a otra pestaña, volver y buscar el producto otra vez. Ahora está
// aquí, plegado, debajo de la carta que estás editando.
// ────────────────────────────────────────────────────────────────────────────
function OpcionesCarta({ carta, etiquetas, addExtra, removeExtra, addTipoPan, removeTipoPan, addFormato, removeFormato, renombrarFormato, updateEtiquetas }) {
  const [abierto, setAbierto] = useState(false)
  const [nuevoExtra, setNuevoExtra] = useState({ nombre: '', precio: '0.20' })
  const [nuevoPan, setNuevoPan] = useState({ nombre: '', sup: '' })
  const [nuevoFormato, setNuevoFormato] = useState('')

  return (
    <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '1.25rem' }}>
      <button onClick={() => setAbierto(v => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0.75rem', padding: '0.85rem 1rem', cursor: 'pointer', color: 'var(--color-text)', textAlign: 'left' }}>
        <span style={{ fontSize: '1.1rem' }}>⚙️</span>
        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Opciones de los productos</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
          {etiquetas.formatos} · {etiquetas.tiposPan} · {etiquetas.extras}
        </span>
        <span style={{ marginLeft: 'auto', color: 'var(--color-muted)' }}>{abierto ? '▲' : '▼'}</span>
      </button>

      {abierto && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', alignItems: 'start', marginTop: '1rem' }}>
          {/* Formatos (tamaños con precio por producto) */}
          <div style={ajusteCard}>
            <h3 style={ajusteTitulo}>{etiquetas.formatos} <span style={sufijoAjuste}>· formatos</span></h3>
            <p style={pieAjuste}>Las columnas de precio de un producto: tamaños, raciones… Un producto «por formatos» tiene un precio para cada uno.</p>
            {carta.formatos.map(f => (
              <div key={f.id} style={ajusteFila}>
                <CampoGuardado valor={f.nombre} onGuardar={v => renombrarFormato(f.id, v)} style={{ ...inputStyle, width: 'auto', flex: 1, marginRight: '0.5rem' }} />
                <button onClick={() => removeFormato(f.id)} disabled={carta.formatos.length <= 1} title={carta.formatos.length <= 1 ? 'Tiene que quedar al menos uno' : 'Borrar'} style={{ ...iconBtn, opacity: carta.formatos.length <= 1 ? 0.4 : 1 }}>🗑️</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem' }}>
              <input value={nuevoFormato} onChange={e => setNuevoFormato(e.target.value)} placeholder="Ración, Media, Tapa…" style={{ ...inputStyle, flex: 1 }} />
              <button onClick={() => { if (nuevoFormato.trim()) { addFormato(nuevoFormato); setNuevoFormato('') } }} style={addBtn}>Añadir</button>
            </div>
          </div>

          {/* Variedades con suplemento */}
          <div style={ajusteCard}>
            <h3 style={ajusteTitulo}>{etiquetas.tiposPan} <span style={sufijoAjuste}>· variedades</span></h3>
            <p style={pieAjuste}>Una sola elección por producto, con suplemento si lo lleva. El cliente la ve al personalizar.</p>
            {carta.tiposPan.map(t => (
              <div key={t.id} style={ajusteFila}>
                <span>{t.nombre} {t.sup > 0 && <span style={{ fontSize: '0.72rem', color: 'var(--color-accent)' }}>+{t.sup.toFixed(2)}€</span>}</span>
                <button onClick={() => removeTipoPan(t.id)} style={iconBtn}>🗑️</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
              <input value={nuevoPan.nombre} onChange={e => setNuevoPan(s => ({ ...s, nombre: e.target.value }))} placeholder="Integral, Sin gluten…" style={{ ...inputStyle, flex: '1 1 110px' }} />
              <input value={nuevoPan.sup} onChange={e => setNuevoPan(s => ({ ...s, sup: e.target.value }))} type="text" inputMode="decimal" placeholder="+€" style={{ ...inputStyle, flex: '0 1 70px' }} />
              <button onClick={() => { if (nuevoPan.nombre.trim()) { addTipoPan(nuevoPan.nombre, nuevoPan.sup); setNuevoPan({ nombre: '', sup: '' }) } }} style={addBtn}>Añadir</button>
            </div>
          </div>

          {/* Añadidos, cada uno con su precio */}
          <div style={ajusteCard}>
            <h3 style={ajusteTitulo}>{etiquetas.extras} <span style={sufijoAjuste}>· añadidos</span></h3>
            <p style={pieAjuste}>Se pueden marcar varios en un mismo producto y cada uno suma su precio.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {carta.extras.map(raw => {
                const ex = normalizarExtra(raw)
                return (
                  <span key={ex.nombre} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'var(--color-inset)', border: '1px solid var(--color-border)', borderRadius: '9999px', padding: '0.2rem 0.5rem 0.2rem 0.7rem', fontSize: '0.8rem' }}>
                    {ex.nombre}{ex.precio > 0 && <span style={{ color: 'var(--color-accent)', fontSize: '0.72rem' }}>+{ex.precio.toFixed(2)}€</span>}
                    <button onClick={() => removeExtra(ex.nombre)} aria-label={`Quitar ${ex.nombre}`} style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer', fontSize: '0.85rem' }}>✕</button>
                  </span>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
              <input value={nuevoExtra.nombre} onChange={e => setNuevoExtra(s => ({ ...s, nombre: e.target.value }))} placeholder="Queso, Huevo…" style={{ ...inputStyle, flex: '1 1 110px' }} />
              <input value={nuevoExtra.precio} onChange={e => setNuevoExtra(s => ({ ...s, precio: e.target.value }))} type="text" inputMode="decimal" placeholder="+€" style={{ ...inputStyle, flex: '0 1 70px' }} />
              <button onClick={() => { if (nuevoExtra.nombre.trim()) { addExtra(nuevoExtra.nombre, nuevoExtra.precio); setNuevoExtra({ nombre: '', precio: '0.20' }) } }} style={addBtn}>Añadir</button>
            </div>
          </div>

          {/* Cómo se llaman esos tres grupos en la carta del cliente */}
          <div style={ajusteCard}>
            <h3 style={ajusteTitulo}>Cómo se llaman en la carta</h3>
            <p style={pieAjuste}>Adapta los nombres a tu negocio: una pizzería diría Tamaño · Masa · Ingredientes.</p>
            {Object.keys(ETIQUETAS_DEFECTO).map(k => (
              <div key={k} style={{ marginBottom: '0.6rem' }}>
                <label style={lblCampo}>{{ formatos: 'Grupo de formatos', tiposPan: 'Grupo de variedades', extras: 'Grupo de añadidos' }[k]}</label>
                <CampoGuardado valor={etiquetas[k]} onGuardar={v => updateEtiquetas({ [k]: v })} placeholder={ETIQUETAS_DEFECTO[k]} style={inputStyle} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const pieAjuste = { fontSize: '0.75rem', color: 'var(--color-muted)', marginBottom: '0.6rem', lineHeight: 1.45 }
const sufijoAjuste = { fontWeight: 400, fontSize: '0.75rem', color: 'var(--color-muted)' }

// Lo que falta por rellenar del local, y dónde se nota. Antes miraba tres
// campos y no decía para qué sirve cada uno; el **CIF y el IVA** son los dos
// que exige una factura simplificada, así que van marcados.
function LoQueFalta({ local }) {
  const faltan = loQueFaltaDelLocal(local)
  if (!faltan.length) return null
  return (
    <div style={{ background: 'var(--tint-warning-bg)', color: 'var(--tint-warning-fg)', border: '1px solid var(--tint-warning-bd)', borderRadius: 'var(--radius)', padding: '0.9rem 1rem', marginBottom: '1.25rem' }}>
      <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
        ⚠️ Falta{faltan.length > 1 ? 'n' : ''} {faltan.length} dato{faltan.length > 1 ? 's' : ''} del local
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.82rem' }}>
        {faltan.map(f => (
          <div key={f.campo}>
            <strong>{f.campo}</strong> · sale en {f.donde}
            {f.fiscal && <span style={{ marginLeft: '0.4rem', fontSize: '0.68rem', fontWeight: 700, background: 'var(--color-surface)', borderRadius: '9999px', padding: '0.05rem 0.45rem' }}>fiscal</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

// Un bloque que se abre. La caja tiene cuatro cosas que se consultan —los
// tickets, el cajón, los cierres y las anulaciones— y una sola que se hace a
// diario: cuadrar y cerrar. Con todo desplegado a la vez, lo de cerrar quedaba
// enterrado entre listas que se miran una vez al mes.
function Plegable({ icono, titulo, resumen, children, abiertoAlPrincipio = false }) {
  const [abierto, setAbierto] = useState(abiertoAlPrincipio)
  return (
    <div style={{ marginTop: '1rem' }}>
      <button onClick={() => setAbierto(v => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0.75rem', padding: '0.85rem 1rem', cursor: 'pointer', color: 'var(--color-text)', textAlign: 'left' }}>
        <span style={{ fontSize: '1.1rem' }}>{icono}</span>
        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{titulo}</span>
        {resumen && <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{resumen}</span>}
        <span style={{ marginLeft: 'auto', color: 'var(--color-muted)' }}>{abierto ? '▲' : '▼'}</span>
      </button>
      {abierto && <div style={{ marginTop: '1rem' }}>{children}</div>}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Los tickets del mes, dentro de Caja.
//
// Tenían su propia pestaña, y un ticket es el justificante de un cobro: se
// viene aquí a reimprimir uno o a DEVOLVER dinero, que es una operación de
// caja — sale del cajón o vuelve a la tarjeta. Tenerlo en otro sitio obligaba
// a saltar de pestaña en mitad de cuadrar.
//
// Y el buscador: con 60 tickets en un mes, encontrar «el nº 47» o «el de la
// mesa 3» era bajar scrolleando. Solo busca en lo que ya está cargado —el
// historial viene por ventana desde el último cierre— así que no promete
// encontrar uno de hace tres meses.
// ────────────────────────────────────────────────────────────────────────────
function TicketsDelMes({ delMes, dias, porDia, diaBonito, mesNombre, totalMes, propinasMes, historial, devueltoDe, setDevolviendo, setTicket, reintentarReembolso }) {
  const [busca, setBusca] = useState('')
  const q = busca.trim().toLowerCase()
  const coincide = (r) => !q || String(r.numero).includes(q) || String(r.mesaNumero ?? '').includes(q)
  const diasVisibles = dias.filter(d => porDia[d].some(coincide))

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
        {[
          { label: `Tickets de ${mesNombre}`, value: delMes.length, color: '#3b82f6' },
          { label: 'Facturado (mes)', value: `${totalMes.toFixed(2)} €`, color: 'var(--color-accent)' },
          { label: 'Propinas (mes)', value: `${propinasMes.toFixed(2)} €`, color: '#10b981' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--color-surface)', borderRadius: '0.75rem', padding: '0.85rem', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginBottom: '0.2rem' }}>{s.label}</div>
            <div style={{ fontWeight: 800, fontSize: '1.25rem', color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ position: 'relative', marginBottom: '1rem' }}>
        <input value={busca} onChange={e => setBusca(e.target.value)} inputMode="numeric" placeholder="🔍 Buscar por nº de ticket o de mesa…" style={{ ...inputStyle, marginBottom: 0 }} />
        {busca && <button onClick={() => setBusca('')} aria-label="Limpiar búsqueda" style={{ ...iconBtn, position: 'absolute', right: '0.2rem', top: '50%', transform: 'translateY(-50%)' }}>✕</button>}
      </div>
      {q && (
        <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '0.75rem' }}>
          {dias.reduce((s, d) => s + porDia[d].filter(coincide).length, 0)} de {delMes.length} tickets coinciden con «{busca}»
        </p>
      )}

      {dias.length === 0 && <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>Aún no hay tickets este mes. Se guardan automáticamente al cerrar una mesa.</p>}
      {diasVisibles.map(dia => {
        const delDia = porDia[dia].filter(coincide)
        return (
        <div key={dia} style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.625rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>{diaBonito(dia)}</span>
            <span style={{ color: 'var(--color-accent)' }}>{delDia.reduce((s, r) => s + r.total, 0).toFixed(2)} €</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.5rem' }}>
            {delDia.map(r => {
              // Una devolución es un ticket más, con importe negativo y
              // apuntando al que corrige. Se distingue a simple vista, y no se
              // le ofrece «Devolver» a una devolución.
              const esDevolucion = !!r.rectificaA
              const devuelto = devueltoDe(r.id)
              const pendiente = pendienteDeDevolver(r, historial.filter(t => t.rectificaA === r.id))
              return (
              <div key={r.id} style={{ background: 'var(--color-surface)', border: `1px solid ${esDevolucion ? 'var(--tint-warning-bd)' : 'var(--color-border)'}`, borderRadius: '0.625rem', padding: '0.75rem 0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                    {esDevolucion ? '↩ Devolución' : `Mesa ${r.mesaNumero}`}
                    <span style={{ fontWeight: 400, color: 'var(--color-muted)', fontSize: '0.75rem' }}> · nº {r.numero}</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: esDevolucion ? 'var(--tint-warning-fg)' : 'var(--color-muted)' }}>
                    {new Date(r.cerradaEn).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} · {r.total.toFixed(2)} €
                  </div>
                  {esDevolucion && r.motivoRectificacion && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.motivoRectificacion}</div>
                  )}
                  {/* Una devolución a tarjeta emitida pero sin que el dinero
                      haya vuelto es lo peor de los dos mundos: hay constancia
                      fiscal y el cliente sigue sin su dinero. Tiene que verse,
                      y poder reintentarse. */}
                  {esDevolucion && r.reembolsoEstado === 'pendiente' && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--tint-warning-fg)', fontWeight: 700 }}>
                      ⏳ el dinero aún no ha vuelto a la tarjeta
                    </div>
                  )}
                  {esDevolucion && r.reembolsoEstado === 'error' && (
                    <div style={{ fontSize: '0.7rem', color: '#f43f5e', fontWeight: 700 }}>
                      ✖ no se pudo devolver a la tarjeta{r.reembolsoError ? `: ${r.reembolsoError}` : ''}
                    </div>
                  )}
                  {esDevolucion && r.reembolsoEstado === 'hecho' && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--tint-success-fg)' }}>
                      ✓ devuelto a la tarjeta
                    </div>
                  )}
                  {!esDevolucion && devuelto < 0 && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--tint-warning-fg)' }}>
                      devuelto {(-devuelto).toFixed(2)} €{pendiente > 0 ? ` · quedan ${pendiente.toFixed(2)} €` : ' · entero'}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                  {esDevolucion && (r.reembolsoEstado === 'pendiente' || r.reembolsoEstado === 'error') && (
                    <button onClick={async () => {
                      const res = await reintentarReembolso(r.id)
                      toast(res?.ok ? 'Devuelto a la tarjeta' : (res?.error || 'Sigue sin poder devolverse'), res?.ok ? 'success' : 'error')
                    }} title="Volver a intentar la devolución a la tarjeta"
                      style={{ background: 'none', color: 'var(--tint-warning-fg)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.4rem 0.6rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>↻ Reintentar</button>
                  )}
                  {!esDevolucion && pendiente > 0 && (
                    <button onClick={() => setDevolviendo({ ticket: r, pendiente })} title="Emitir una factura rectificativa"
                      style={{ background: 'none', color: '#f43f5e', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.4rem 0.6rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>↩ Devolver</button>
                  )}
                  <button onClick={() => setTicket({
                    numero: r.mesaNumero, personas: r.personas,
                    // el desglose de cobro: es lo que dice si el ticket está
                    // pagado (ver Ticket.jsx)
                    pagos: r.pagos,
                    // si es una devolución, el papel tiene que decirlo
                    rectifica: r.rectificaA
                      ? { numero: historial.find(t => t.id === r.rectificaA)?.numero ?? '—', motivo: r.motivoRectificacion }
                      : null,
                  })} style={{ background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.4rem 0.7rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>Ver</button>
                </div>
              </div>
              )
            })}
          </div>
        </div>
        )
      })}
      {q && diasVisibles.length === 0 && delMes.length > 0 && (
        <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>
          Ningún ticket de este mes lleva ese número. Ojo: aquí solo están los del mes en curso.
        </p>
      )}
    </div>
  )
}

function CampoGuardado({ valor, onGuardar, ...props }) {
  const [txt, setTxt] = useState(String(valor ?? ''))
  useEffect(() => { setTxt(String(valor ?? '')) }, [valor])
  return (
    <input {...props} value={txt}
      onChange={e => setTxt(e.target.value)}
      // Si quien guarda RECHAZA el valor (un número de mesa repetido), el campo
      // vuelve a lo que hay de verdad. Dejarlo escrito es enseñar en pantalla
      // algo que no está guardado: la tarjeta seguía diciendo «Mesa 5» y el
      // hueco «6».
      onBlur={async () => {
        if (txt === String(valor ?? '')) return
        const r = await onGuardar(txt)
        if (r && r.ok === false) setTxt(String(valor ?? ''))
      }}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} />
  )
}

// El registro de jornada, dentro de Personal y plegado: es de las personas
// que hay arriba. Tenía su propia pestaña, así que para saber si a alguien se
// le había quedado el turno abierto había que salir del panel de personal,
// elegir el mes y buscar su nombre entre los fichajes de todos.
//
// El mes lo manda la pestaña entera (`mes`), no este bloque: si el resumen de
// cada persona dijera un mes y esta lista otro, los dos números no cuadrarían
// y no habría forma de saber cuál estás mirando.
function RegistroJornada({ mes, setMes, delMes: crudos, empleados = [], crearFichaje, editarFichaje, borrarFichaje, local }) {
  const [visible, setVisible] = useState(false)
  const [edit, setEdit] = useState(null) // { id, entrada, salida } en formato datetime-local
  const [alta, setAlta] = useState(null) // { empleadoId, entrada, salida } al añadir una jornada

  // ojo: comparar en LOCAL. Un turno que entra a la 01:00 del día 1 se guarda
  // como las 23:00 del último día del mes anterior en UTC, y caía en la nómina
  // del mes que no era.
  // En v2 el fichaje solo trae `empleadoId`: sin resolverlo contra la plantilla
  // la lista decía «👤 undefined» y el resumen sumaba las horas de TODOS bajo
  // esa misma clave, que es justo el número que se usa para la nómina.
  const delMes = conNombre(crudos, empleados)
    .slice().sort((a, b) => new Date(b.entrada) - new Date(a.entrada))

  // Horas por empleado
  const porEmpleado = {}
  delMes.forEach(f => { porEmpleado[f.nombre] = (porEmpleado[f.nombre] || 0) + horasEntre(f.entrada, f.salida) })
  const totalHoras = Object.values(porEmpleado).reduce((s, h) => s + h, 0)

  const guardar = () => {
    const r = editarFichaje(edit.id, { entrada: localAIso(edit.entrada), salida: edit.salida ? localAIso(edit.salida) : null })
    if (!r.ok) return toast(r.error, 'error')
    toast('Fichaje corregido', 'success'); setEdit(null)
  }
  const anadir = () => {
    const r = crearFichaje({
      empleadoId: alta.empleadoId,
      entrada: alta.entrada ? localAIso(alta.entrada) : null,
      salida: alta.salida ? localAIso(alta.salida) : null,
    })
    if (!r.ok) return toast(r.error, 'error')
    toast('Jornada añadida', 'success'); setAlta(null)
  }
  const borrar = async (f) => {
    if (await confirmar({ titulo: 'Borrar fichaje', mensaje: `¿Borrar el fichaje de ${f.nombre} del ${new Date(f.entrada).toLocaleDateString('es-ES')}?`, peligro: true, confirmar: 'Borrar' })) {
      borrarFichaje(f.id); toast('Fichaje borrado', 'success')
    }
  }
  const exportarCSV = () => {
    // «Registro» distingue lo fichado por el trabajador de lo puesto a mano: es
    // lo primero que mira quien audita una jornada.
    const filas = [['Empleado', 'Fecha', 'Entrada', 'Salida', 'Horas', 'Registro']]
    delMes.slice().reverse().forEach(f => {
      const e = new Date(f.entrada)
      filas.push([
        f.nombre,
        e.toLocaleDateString('es-ES'),
        e.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        f.salida ? new Date(f.salida).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '(abierto)',
        f.salida ? horasEntre(f.entrada, f.salida).toFixed(2) : '',
        f.editadoPor ? `a mano (${f.editadoPor})` : 'fichado',
      ])
    })
    const csv = filas.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = `fichajes-${(local?.nombre || 'local').replace(/\s+/g, '_')}-${mes}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  if (!visible) {
    return (
      <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '1.25rem' }}>
        <button onClick={() => setVisible(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0.75rem', padding: '0.85rem 1rem', cursor: 'pointer', color: 'var(--color-text)', textAlign: 'left' }}>
          <span style={{ fontSize: '1.1rem' }}>⏱</span>
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Registro de jornada</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{delMes.length} fichaje(s) · {fmtH(totalHoras)} este mes</span>
          <span style={{ marginLeft: 'auto', color: 'var(--color-muted)' }}>▼</span>
        </button>
      </div>
    )
  }

  return (
    <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <span style={{ fontSize: '1.1rem' }}>⏱</span>
        <h3 style={{ fontWeight: 700, fontSize: '0.95rem' }}>Registro de jornada</h3>
        <input type="month" value={mes} onChange={e => setMes(e.target.value)} style={{ ...inputStyle, width: 'auto' }} />
        <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>{delMes.length} fichaje(s) · <strong style={{ color: 'var(--color-accent)' }}>{fmtH(totalHoras)}</strong> en total</span>
        <button onClick={() => setVisible(false)} style={{ ...iconBtn, marginLeft: 'auto' }} title="Plegar">▲</button>
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <button onClick={exportarCSV} disabled={delMes.length === 0} style={{ ...addBtn, opacity: delMes.length ? 1 : 0.5 }}>⬇ Exportar CSV</button>
      </div>

      <p style={{ fontSize: '0.75rem', color: 'var(--color-faint)', marginBottom: '1rem' }}>Registro de jornada obligatorio (RD-ley 8/2019): conservar 4 años. El personal ficha desde su PDA (pestaña Turno). Aquí puedes corregir errores y añadir una jornada que nadie llegó a fichar.</p>

      {/* Alta manual. Se podía corregir un fichaje pero no crearlo: si alguien
          olvidaba fichar la entrada del todo, esa jornada no existía para el
          registro y no había forma de meterla. */}
      <div style={{ ...ajusteCard, marginBottom: '1.25rem' }}>
        {!alta ? (
          <button onClick={() => setAlta({ empleadoId: empleados[0]?.id || '', entrada: '', salida: '' })} style={addBtn}>+ Añadir jornada</button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <h3 style={ajusteTitulo}>Añadir una jornada</h3>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 150px' }}>
                <label style={lblCampo}>Empleado</label>
                <select value={alta.empleadoId} onChange={e => setAlta(s2 => ({ ...s2, empleadoId: e.target.value }))} style={inputStyle}>
                  {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
              <div style={{ flex: '1 1 170px' }}>
                <label style={lblCampo}>Entrada</label>
                <input type="datetime-local" value={alta.entrada} onChange={e => setAlta(s2 => ({ ...s2, entrada: e.target.value }))} style={inputStyle} />
              </div>
              <div style={{ flex: '1 1 170px' }}>
                <label style={lblCampo}>Salida (vacío = turno abierto)</label>
                <input type="datetime-local" value={alta.salida} onChange={e => setAlta(s2 => ({ ...s2, salida: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--color-faint)', margin: 0 }}>Quedará marcada como <strong>añadida por el encargado</strong>: en el registro tiene que verse qué marcó el trabajador y qué se puso a mano.</p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setAlta(null)} style={{ background: 'var(--color-surface-3)', color: 'var(--color-text)', border: 'none', borderRadius: '0.5rem', padding: '0.4rem 0.9rem', cursor: 'pointer', fontSize: '0.82rem' }}>Cancelar</button>
              <button onClick={anadir} style={addBtn}>Guardar jornada</button>
            </div>
          </div>
        )}
      </div>

      {/* Detalle */}
      {delMes.length === 0
        ? <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>Sin fichajes este mes.</p>
        : delMes.map(f => {
          const abierto = !f.salida
          return (
            <div key={f.id} style={{ background: 'var(--color-surface)', border: `1px solid ${abierto ? '#10b981' : 'var(--color-border)'}66`, borderRadius: '0.625rem', padding: '0.7rem 0.85rem', marginBottom: '0.5rem' }}>
              {edit?.id === f.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                      <label style={lblCampo}>Entrada</label>
                      <input type="datetime-local" value={edit.entrada} onChange={e => setEdit(s => ({ ...s, entrada: e.target.value }))} style={inputStyle} />
                    </div>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                      <label style={lblCampo}>Salida {abierto && '(vacío = turno abierto)'}</label>
                      <input type="datetime-local" value={edit.salida} onChange={e => setEdit(s => ({ ...s, salida: e.target.value }))} style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button onClick={() => setEdit(null)} style={{ background: 'var(--color-surface-3)', color: 'var(--color-text)', border: 'none', borderRadius: '0.5rem', padding: '0.4rem 0.9rem', cursor: 'pointer', fontSize: '0.82rem' }}>Cancelar</button>
                    <button onClick={guardar} style={addBtn}>Guardar</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>👤 {f.nombre} <span style={{ fontWeight: 400, color: 'var(--color-muted)', fontSize: '0.78rem' }}>· {new Date(f.entrada).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                      {/* Un registro de jornada tiene que distinguir lo que
                          marcó el trabajador de lo que puso el encargado. */}
                      {f.editadoPor && <span style={{ marginLeft: '0.4rem', fontSize: '0.68rem', fontWeight: 700, background: 'var(--tint-warning-bg)', color: 'var(--tint-warning-fg)', borderRadius: '9999px', padding: '0.1rem 0.5rem', whiteSpace: 'nowrap' }}>✍️ a mano</span>}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>
                      🟢 {new Date(f.entrada).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      {' → '}
                      {abierto ? <span style={{ color: '#10b981' }}>en curso</span> : `🔴 ${new Date(f.salida).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`}
                      {!abierto && <strong style={{ color: 'var(--color-accent)', marginLeft: '0.5rem' }}>· {fmtH(horasEntre(f.entrada, f.salida))}</strong>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button onClick={() => setEdit({ id: f.id, entrada: isoALocal(f.entrada), salida: isoALocal(f.salida) })} title="Corregir" style={iconBtn}>✏️</button>
                    <button onClick={() => borrar(f)} title="Borrar" style={iconBtn}>🗑️</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// El personal del bar.
//
// Era una fila apretada por empleado —nombre, rol, PIN, activo y la papelera,
// todo junto— y el registro de jornada vivía en OTRA pestaña. Para saber si
// María se había dejado el turno abierto había que salir de aquí, elegir el
// mes y buscar su nombre entre los fichajes de todos.
//
// Ahora cada persona es una ficha que dice lo que hace falta saber de un
// vistazo: si está en turno ahora mismo y cuántas horas lleva en el mes que se
// está mirando. Lo demás —cambiarle el rol, el PIN o darle de baja— vive
// detrás de su ⚙️, que son cosas que se hacen una vez.
// ────────────────────────────────────────────────────────────────────────────
function PersonalTab({ empleados, addEmpleado, updateEmpleado, removeEmpleado, fichajes, crearFichaje, editarFichaje, borrarFichaje, local, pedirFichajesDe }) {
  const [alta, setAlta] = useState(false)
  const [verBajas, setVerBajas] = useState(false)
  const [mes, setMes] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })

  // El mes lo manda esta pestaña entera, no cada bloque: si el resumen de una
  // persona dijera «este mes» y el registro de abajo estuviera enseñando otro,
  // los dos números no cuadrarían y no habría forma de saber cuál miras.
  useEffect(() => { pedirFichajesDe?.(mes) }, [mes, pedirFichajesDe])
  const delMes = useMemo(() => fichajes.filter(f => esDelMes(f.entrada, mes)), [fichajes, mes])

  const activos = empleados.filter(e => e.activo)
  const bajas = empleados.filter(e => !e.activo)
  const enTurno = activos.filter(e => jornadaDe(delMes, e.id).abierto).length

  return (
    <div style={{ maxWidth: '760px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', margin: 0, flex: '1 1 240px' }}>
          Quién trabaja aquí y qué abre su PIN. {enTurno > 0 && <strong style={{ color: '#10b981' }}>{enTurno} en turno ahora.</strong>}
        </p>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--color-muted)' }}>
          Jornada de
          <input type="month" value={mes} onChange={e => setMes(e.target.value)} style={{ ...inputStyle, width: 'auto' }} />
        </label>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
        {activos.map(e => (
          <FichaEmpleado key={e.id} e={e} jornada={jornadaDe(delMes, e.id)}
            updateEmpleado={updateEmpleado} removeEmpleado={removeEmpleado} />
        ))}
        {activos.length === 0 && (
          <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>No hay nadie activo. Sin personal activo, nadie puede entrar con su PIN.</p>
        )}
      </div>

      {!alta ? (
        <button onClick={() => setAlta(true)} style={{ width: '100%', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px dashed var(--color-border)', borderRadius: '0.75rem', padding: '0.9rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
          ➕ Dar de alta a alguien
        </button>
      ) : (
        <NuevoEmpleado addEmpleado={addEmpleado} onHecho={() => setAlta(false)} />
      )}

      {/* Quien ya no trabaja aquí no se borra: su ficha sigue haciendo falta
          para el registro de jornada, que hay que conservar cuatro años. Pero
          tampoco tiene que estorbar entre los que sí están. */}
      {bajas.length > 0 && (
        <div style={{ marginTop: '1.25rem' }}>
          <button onClick={() => setVerBajas(v => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0.75rem', padding: '0.7rem 1rem', cursor: 'pointer', color: 'var(--color-muted)', textAlign: 'left', fontSize: '0.85rem' }}>
            <span>⏸</span>
            <span style={{ fontWeight: 700 }}>Sin turno: {bajas.length}</span>
            <span style={{ fontSize: '0.75rem' }}>no entran con su PIN, pero conservan su ficha</span>
            <span style={{ marginLeft: 'auto' }}>{verBajas ? '▲' : '▼'}</span>
          </button>
          {verBajas && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.6rem' }}>
              {bajas.map(e => (
                <FichaEmpleado key={e.id} e={e} jornada={jornadaDe(delMes, e.id)}
                  updateEmpleado={updateEmpleado} removeEmpleado={removeEmpleado} />
              ))}
            </div>
          )}
        </div>
      )}

      <RegistroJornada mes={mes} setMes={setMes} delMes={delMes} empleados={empleados}
        crearFichaje={crearFichaje} editarFichaje={editarFichaje} borrarFichaje={borrarFichaje} local={local} />
    </div>
  )
}

function FichaEmpleado({ e, jornada, updateEmpleado, removeEmpleado }) {
  const [abierto, setAbierto] = useState(false)
  const [pinDraft, setPinDraft] = useState('')
  const rol = ROLES[rolDe(e.rol)]

  const guardar = (cambios, hecho) => {
    const r = updateEmpleado(e.id, cambios)
    if (!r.ok) { toast(r.error, 'error'); return r }
    if (hecho) toast(hecho, 'success')
    return r
  }
  const onPin = (val) => {
    if (!/^\d{0,4}$/.test(val)) return
    setPinDraft(val)
    if (val.length === 4) {
      const r = guardar({ pin: val }, `PIN de ${e.nombre} cambiado`)
      if (r.ok) setPinDraft('')
    }
  }
  const borrar = async () => {
    if (!(await confirmar({ titulo: 'Eliminar empleado', mensaje: `¿Eliminar a ${e.nombre}? Perderá el acceso. Si solo se va de turno, es mejor dejarlo «sin turno»: su ficha hace falta para el registro de jornada.`, peligro: true, confirmar: 'Eliminar' }))) return
    const r = removeEmpleado(e.id)
    if (!r.ok) toast(r.error, 'error')
    else toast(`${e.nombre} eliminado`, 'success')
  }

  return (
    <div style={{ ...ajusteCard, padding: '0.85rem', opacity: e.activo ? 1 : 0.7 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '1.05rem' }}>{rol.emoji}</span>
        <strong style={{ fontSize: '0.95rem' }}>{e.nombre}</strong>
        <span title={rol.desc} style={{ fontSize: '0.7rem', color: 'var(--color-muted)', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '9999px', padding: '0.1rem 0.5rem' }}>{rol.label}</span>
        {/* Lo primero que se quiere saber de una plantilla: quién está dentro
            ahora mismo, y quién se dejó el turno abierto anteayer. */}
        {jornada.abierto && (
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#10b981', background: 'var(--tint-success-bg)', borderRadius: '9999px', padding: '0.1rem 0.5rem', whiteSpace: 'nowrap' }}>
            🟢 En turno desde {new Date(jornada.abierto.entrada).toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
          </span>
        )}
        <div style={{ display: 'flex', gap: '0.2rem', marginLeft: 'auto', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
            {jornada.jornadas > 0 ? <>⏱ <strong style={{ color: 'var(--color-accent)' }}>{fmtH(jornada.horas)}</strong></> : '⏱ —'}
          </span>
          <button onClick={() => setAbierto(v => !v)} title="Editar ficha" aria-label={`Editar ficha de ${e.nombre}`} style={{ ...iconBtn, color: abierto ? 'var(--color-accent)' : 'inherit' }}>⚙️</button>
        </div>
      </div>

      {abierto && (
        <div style={{ marginTop: '0.8rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.8rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.7rem' }}>
            <div style={{ flex: '2 1 150px' }}>
              <label style={lblCampo}>Nombre</label>
              {/* Se guardaba en CADA TECLA: escribir «María» eran cinco
                  peticiones al servidor, y la que llegara la última mandaba
                  —podía quedarse en «Marí». Ahora al salir del campo. */}
              <CampoGuardado valor={e.nombre} onGuardar={v => guardar({ nombre: v }, 'Nombre guardado')} style={inputStyle} />
            </div>
            <div style={{ flex: '1 1 130px' }}>
              <label style={lblCampo}>Rol</label>
              <select value={rolDe(e.rol)} onChange={ev => guardar({ rol: ev.target.value }, 'Rol cambiado')} style={inputStyle}>
                {ROLES_ORDENADOS.map(r => <option key={r} value={r}>{ROLES[r].label}</option>)}
              </select>
            </div>
            <div style={{ flex: '0 1 110px' }}>
              <label style={lblCampo}>PIN</label>
              {/* El PIN se guarda cifrado en el servidor y NO vuelve al
                  navegador: el hueco sale vacío aunque el empleado tenga el
                  suyo. Sin decirlo, parece que se ha perdido. */}
              <input value={pinDraft} onChange={ev => onPin(ev.target.value)} inputMode="numeric" maxLength={4} placeholder="••••" style={{ ...inputStyle, letterSpacing: '0.2em', fontWeight: 700 }} />
            </div>
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginBottom: '0.8rem', lineHeight: 1.45 }}>
            {rol.desc}. El PIN no se muestra: escribe 4 dígitos nuevos para cambiarlo.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button onClick={() => guardar({ activo: !e.activo }, e.activo ? `${e.nombre} queda sin turno` : `${e.nombre} vuelve al turno`)}
              style={{ background: e.activo ? 'var(--color-surface-3)' : 'var(--tint-success-bg)', color: e.activo ? 'var(--tint-warning-fg)' : 'var(--tint-success-fg)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.5rem 0.85rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}>
              {e.activo ? '⏸ Dejar sin turno' : '🟢 Devolverle el turno'}
            </button>
            <button onClick={borrar} style={{ background: 'none', color: '#f43f5e', border: 'none', padding: '0.5rem 0.6rem', cursor: 'pointer', fontSize: '0.82rem', marginLeft: 'auto' }}>🗑️ Eliminar</button>
          </div>
        </div>
      )}
    </div>
  )
}

function NuevoEmpleado({ addEmpleado, onHecho }) {
  const [nuevo, setNuevo] = useState({ nombre: '', rol: 'camarero', pin: '' })
  const crear = () => {
    const r = addEmpleado(nuevo)
    if (!r.ok) return toast(r.error, 'error')
    toast(`${nuevo.nombre.trim()} dado de alta`, 'success')
    setNuevo({ nombre: '', rol: 'camarero', pin: '' })
    onHecho()
  }
  return (
    <div style={{ ...ajusteCard, borderColor: 'var(--color-accent)' }}>
      <h3 style={{ ...ajusteTitulo, marginBottom: '0.7rem' }}>➕ Nuevo empleado</h3>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.7rem' }}>
        <div style={{ flex: '2 1 160px' }}>
          <label style={lblCampo}>Nombre</label>
          <input value={nuevo.nombre} onChange={e => setNuevo(s => ({ ...s, nombre: e.target.value }))} autoFocus placeholder="María" style={inputStyle} />
        </div>
        <div style={{ flex: '1 1 130px' }}>
          <label style={lblCampo}>Rol</label>
          <select value={nuevo.rol} onChange={e => setNuevo(s => ({ ...s, rol: e.target.value }))} style={inputStyle}>
            {ROLES_ORDENADOS.map(r => <option key={r} value={r}>{ROLES[r].label}</option>)}
          </select>
        </div>
        <div style={{ flex: '0 1 110px' }}>
          <label style={lblCampo}>PIN (4 díg.)</label>
          <input value={nuevo.pin} onChange={e => { if (/^\d{0,4}$/.test(e.target.value)) setNuevo(s => ({ ...s, pin: e.target.value })) }} inputMode="numeric" maxLength={4} placeholder="0000" style={{ ...inputStyle, letterSpacing: '0.2em', fontWeight: 700 }} />
        </div>
      </div>
      <p style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginBottom: '0.8rem' }}>{ROLES[rolDe(nuevo.rol)].desc}. Con ese PIN entrará en sus pantallas.</p>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button onClick={crear} disabled={!nuevo.nombre.trim()} style={{ ...addBtn, flex: 1, opacity: nuevo.nombre.trim() ? 1 : 0.5, cursor: nuevo.nombre.trim() ? 'pointer' : 'not-allowed' }}>Dar de alta ✓</button>
        <button onClick={onHecho} style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.5rem 0.85rem', cursor: 'pointer', fontSize: '0.82rem' }}>Cancelar</button>
      </div>
    </div>
  )
}

function FormProducto({ carta, form, setForm, onGuardar, onCancelar, titulo }) {
  const set = (campo) => (e) => setForm(f => ({ ...f, [campo]: e.target.value }))
  // Un bar da de alta un producto con NOMBRE y PRECIO. Lo demás (foto,
  // alérgenos, tamaños, menú) es útil pero no puede estorbar al alta rápida:
  // se despliega a mano, o solo si el producto ya lo trae relleno.
  const traeAvanzado = !!(form.imagen || form.descripcion || (form.alergenos || []).length || form.conFormatos || form.menu?.grupos?.length)
  const [verAvanzado, setVerAvanzado] = useState(traeAvanzado)
  const puedeGuardar = form.nombre.trim() && (form.conFormatos
    ? Object.values(form.precios || {}).some(v => String(v).trim())
    : String(form.precio ?? '').trim())
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-accent)', borderRadius: '0.625rem', padding: '1rem', marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.625rem', gridColumn: '1 / -1' }}>
      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-accent)' }}>{titulo}</div>
      {/* Lo imprescindible: nombre, precio y dónde va */}
      <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
        <input value={form.nombre} onChange={set('nombre')} placeholder="Nombre del producto" autoFocus style={{ ...inputStyle, flex: '2 1 180px', minHeight: '44px' }} />
        {form.conFormatos
          ? carta.formatos.map(f => (
              <input key={f.id} value={form.precios[f.id] ?? ''} onChange={e => setForm(x => ({ ...x, precios: { ...x.precios, [f.id]: e.target.value } }))} placeholder={`€ ${f.nombre}`} type="text" inputMode="decimal" style={{ ...inputStyle, flex: '1 1 90px', minHeight: '44px' }} />
            ))
          : <input value={form.precio} onChange={set('precio')} placeholder="€ Precio" type="text" inputMode="decimal" style={{ ...inputStyle, flex: '1 1 100px', minHeight: '44px' }} />}
        <select value={form.categoria} onChange={set('categoria')} style={{ ...inputStyle, flex: '1 1 140px', minHeight: '44px' }}>
          {carta.categorias.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.nombre}</option>)}
        </select>
      </div>

      <button type="button" onClick={() => setVerAvanzado(v => !v)}
        style={{ background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', fontSize: '0.82rem', textAlign: 'left', padding: '0.35rem 0', minHeight: '40px' }}>
        {verAvanzado ? '▾' : '▸'} Más opciones (descripción, foto, alérgenos, tamaños, menú)
      </button>

      {verAvanzado && (<>
        {/* El IVA vive aquí y no arriba a propósito: casi todo lo que vende un
            bar va al tipo del local, y pedirlo en el alta rápida sería estorbar
            en el 95 % de los casos para acertar en el 5 %. Pero ese 5 % —una
            botella para llevar al 21 %, pan al 4 %— sale en el ticket y en lo
            que consta en Hacienda. */}
        <label style={lblCampo}>IVA de este producto</label>
        <select value={form.ivaPct} onChange={set('ivaPct')} style={{ ...inputStyle, minHeight: '44px', alignSelf: 'flex-start', minWidth: '15rem' }}>
          <option value="">El del local (lo normal)</option>
          <option value="4">4 % — pan, leche, fruta, huevos</option>
          <option value="10">10 % — hostelería</option>
          <option value="21">21 % — el resto</option>
        </select>

        <button type="button" onClick={() => setForm(f => ({ ...f, conFormatos: !f.conFormatos }))}
          style={{ background: form.conFormatos ? '#7c3aed' : 'var(--color-inset)', color: form.conFormatos ? '#fff' : 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.5rem 0.75rem', minHeight: '44px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, alignSelf: 'flex-start' }}>
          {form.conFormatos ? '📐 Varios tamaños (pitufo, viena…)' : '💶 Precio único'}
        </button>
        <input value={form.descripcion} onChange={set('descripcion')} placeholder="Descripción (qué lleva)" style={{ ...inputStyle, minHeight: '44px' }} />
        {/* La carta en inglés traduce sola los ingredientes corrientes; esto es
            para lo tuyo, que ningún diccionario puede adivinar. */}
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <input value={form.nombreEn} onChange={set('nombreEn')} placeholder="🇬🇧 Nombre en inglés (opcional)" style={{ ...inputStyle, flex: '1 1 160px', minHeight: '44px' }} />
          <input value={form.descripcionEn} onChange={set('descripcionEn')} placeholder="🇬🇧 Descripción en inglés (opcional)" style={{ ...inputStyle, flex: '2 1 200px', minHeight: '44px' }} />
        </div>
        {/* Foto del producto (URL) */}
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <input value={form.imagen} onChange={set('imagen')} placeholder="📷 URL de la foto (opcional)" style={{ ...inputStyle, flex: 1, minHeight: '44px' }} />
          {form.imagen?.trim() && <img src={form.imagen} alt="" onError={e => { e.currentTarget.style.display = 'none' }} style={{ width: '2.6rem', height: '2.6rem', objectFit: 'cover', borderRadius: '0.5rem', border: '1px solid var(--color-border)' }} />}
        </div>
        {/* Menú del día / combo (opcional) */}
        <EditorMenu menu={form.menu} onChange={(m) => setForm(f => ({ ...f, menu: m }))} />
        {/* Alérgenos (14 UE) */}
        <div>
          <p style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Alérgenos</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {ALERGENOS.map(a => {
              const on = (form.alergenos || []).includes(a.id)
              return (
                <button key={a.id} type="button" onClick={() => setForm(f => ({ ...f, alergenos: on ? f.alergenos.filter(x => x !== a.id) : [...(f.alergenos || []), a.id] }))}
                  style={{ background: on ? '#7c2d12' : 'var(--color-inset)', color: on ? '#fdba74' : 'var(--color-muted)', border: `1px solid ${on ? 'var(--color-accent)' : 'var(--color-border)'}`, borderRadius: '9999px', padding: '0.4rem 0.7rem', minHeight: '40px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                  {a.emoji} {a.nombre}
                </button>
              )
            })}
          </div>
        </div>
      </>)}
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button onClick={onCancelar} style={{ background: 'var(--color-surface-3)', color: 'var(--color-text)', border: 'none', borderRadius: '0.5rem', padding: '0.6rem 1rem', minHeight: '44px', cursor: 'pointer', fontSize: '0.85rem' }}>Cancelar</button>
        <button onClick={onGuardar} disabled={!puedeGuardar} title={puedeGuardar ? '' : 'Pon al menos nombre y precio'}
          style={{ background: puedeGuardar ? 'var(--color-accent)' : 'var(--color-surface-3)', color: puedeGuardar ? 'white' : 'var(--color-faint)', border: 'none', borderRadius: '0.5rem', padding: '0.6rem 1.25rem', minHeight: '44px', cursor: puedeGuardar ? 'pointer' : 'not-allowed', fontSize: '0.85rem', fontWeight: 600 }}>Guardar</button>
      </div>
    </div>
  )
}

const inputStyle = {
  background: 'var(--color-inset)',
  border: '1px solid var(--color-border)',
  borderRadius: '0.5rem',
  padding: '0.5rem 0.75rem',
  color: 'var(--color-text)',
  fontSize: '0.85rem',
  width: '100%',
}

// La referencia de Stripe son ~60 caracteres: en una fila se enseña el
// principio y el final, y al tocarla se abre entera para poder seleccionarla a
// mano —que es lo que queda cuando el navegador no deja copiar—.
function Referencia({ texto }) {
  const [entera, setEntera] = useState(false)
  return (
    <code
      onClick={() => setEntera(v => !v)}
      title={entera ? 'Tocar para acortar' : texto}
      style={{
        flex: '1 1 120px', opacity: 0.75, cursor: 'pointer',
        userSelect: entera ? 'all' : 'auto',
        wordBreak: entera ? 'break-all' : 'normal',
        overflow: entera ? 'visible' : 'hidden', textOverflow: 'ellipsis',
      }}
    >{entera ? texto : refCorta(texto)}</code>
  )
}

// Acciones de fila (agotado, editar, borrar). Eran de 29x23 px y pegadas: con
// el dedo, «borrar» caía a un milímetro de «editar». Ahora 40x40 y con aire.
const iconBtn = {
  background: 'none',
  border: '1px solid transparent',
  borderRadius: '0.5rem',
  cursor: 'pointer',
  fontSize: '1.05rem',
  width: '2.5rem',
  height: '2.5rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  lineHeight: 1,
  flexShrink: 0,
}

const lblCampo = { display: 'block', fontSize: '0.72rem', color: 'var(--color-muted)', marginBottom: '0.25rem' }
const ajusteCard = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0.875rem', padding: '1.1rem' }
const ajusteTitulo = { fontWeight: 700, fontSize: '1rem', marginBottom: '0.75rem' }
const ajusteFila = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0', borderBottom: '1px solid var(--color-border)', fontSize: '0.875rem' }
const addBtn = { background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 0.85rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap' }
