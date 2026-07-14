import { create } from 'zustand'

// Servicio de UI global: avisos (toasts) y diálogos (confirmar / pedir texto)
// propios, para no usar los alert/confirm/prompt nativos del navegador.
let contador = 0

// ── Tema (claro/oscuro) ─ preferencia POR DISPOSITIVO, no del local sincronizado.
const TEMA_KEY = 'tpv-tema'
function temaInicial() {
  try { return localStorage.getItem(TEMA_KEY) === 'claro' ? 'claro' : 'oscuro' } catch { return 'oscuro' }
}
export function aplicarTema(t) {
  const root = document.documentElement
  if (t === 'claro') root.setAttribute('data-theme', 'light')
  else root.removeAttribute('data-theme')
}
// Se aplica ya en la carga del módulo para evitar parpadeo antes del primer render.
aplicarTema(temaInicial())

export const useUI = create((set, get) => ({
  toasts: [],
  dialogo: null, // { tipo:'confirm'|'prompt', titulo, mensaje, ..., resolver }

  tema: temaInicial(),
  toggleTema: () => {
    const tema = get().tema === 'claro' ? 'oscuro' : 'claro'
    try { localStorage.setItem(TEMA_KEY, tema) } catch { /* almacenamiento no disponible */ }
    aplicarTema(tema)
    set({ tema })
  },

  toast: (mensaje, tipo = 'info', ms = 3200) => {
    const id = ++contador
    set(s => ({ toasts: [...s.toasts, { id, mensaje, tipo }] }))
    if (ms) setTimeout(() => get().cerrarToast(id), ms)
    return id
  },
  cerrarToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),

  confirmar: (opts) => new Promise(resolver => {
    const o = typeof opts === 'string' ? { mensaje: opts } : (opts || {})
    set({ dialogo: { tipo: 'confirm', titulo: o.titulo || 'Confirmar', mensaje: o.mensaje || '', confirmar: o.confirmar || 'Aceptar', cancelar: o.cancelar || 'Cancelar', peligro: !!o.peligro, resolver } })
  }),
  pedirTexto: (opts) => new Promise(resolver => {
    const o = typeof opts === 'string' ? { titulo: opts } : (opts || {})
    set({ dialogo: { tipo: 'prompt', titulo: o.titulo || '', mensaje: o.mensaje || '', placeholder: o.placeholder || '', valor: o.valor || '', confirmar: o.confirmar || 'Aceptar', cancelar: o.cancelar || 'Cancelar', resolver } })
  }),
  responder: (valor) => {
    const d = get().dialogo
    if (d) d.resolver(valor)
    set({ dialogo: null })
  },
}))

// Atajos imperativos para usar desde cualquier sitio (también fuera de React).
export const toast = (mensaje, tipo, ms) => useUI.getState().toast(mensaje, tipo, ms)
export const confirmar = (opts) => useUI.getState().confirmar(opts)
export const pedirTexto = (opts) => useUI.getState().pedirTexto(opts)
