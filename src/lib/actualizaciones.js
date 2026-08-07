import { create } from 'zustand'

// ────────────────────────────────────────────────────────────────────────────
// Actualizaciones de la app instalada.
//
// El problema: un TPV se queda abierto todo el servicio (o toda la semana). El
// service worker solo comprueba si hay versión nueva al CARGAR la página, así
// que un arreglo desplegado el martes podía no llegar al bar hasta que a
// alguien se le ocurriera recargar.
//
// Y el problema contrario: recargar solo, sin avisar, en mitad de una comanda
// es peor. Por eso se avisa y **decide el personal cuándo**.
// ────────────────────────────────────────────────────────────────────────────

const CADA = 30 * 60 * 1000   // se pregunta cada media hora

export const useActualizacion = create((set) => ({
  hayNueva: false,
  aplicar: () => {},                       // lo rellena registrarActualizaciones()
  _marcar: (aplicar) => set({ hayNueva: true, aplicar }),
}))

/**
 * Arranca la vigilancia de versiones. Silenciosa si no hay service worker
 * (desarrollo, tests, navegador sin soporte): nunca debe romper el arranque.
 */
export async function registrarActualizaciones({ cada = CADA } = {}) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    const { registerSW } = await import('virtual:pwa-register')
    const actualizar = registerSW({
      immediate: true,
      onNeedRefresh() {
        // hay versión nueva esperando: que lo decida quien esté en barra
        useActualizacion.getState()._marcar(() => actualizar(true))
      },
      onRegisteredSW(url, registro) {
        if (!registro) return
        setInterval(() => {
          // sin red no se pregunta: ahorra ruido y errores en consola
          if (navigator.onLine === false) return
          registro.update().catch(() => {})
        }, cada)
      },
    })
    return actualizar
  } catch {
    return null   // en dev el módulo virtual no existe: no pasa nada
  }
}
