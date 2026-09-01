// ────────────────────────────────────────────────────────────────────────────
// Llamar la atención de alguien que no está mirando la pantalla.
//
// Es el caso de las dos pantallas que avisan: la PDA va en el bolsillo del
// camarero, y el KDS cuelga de una pared con el cocinero de espaldas, en la
// plancha. Si la comanda solo «aparece», puede estar minutos sin que nadie la
// vea — y en una cocina eso es un plato frío o un cliente esperando.
//
// Se hace con un oscilador y no con un fichero de audio: no hay que descargar
// nada, funciona sin conexión y suena igual en cualquier aparato. Si el
// navegador no deja (una pestaña que aún no ha recibido un toque bloquea el
// audio), no pasa nada: el aviso visual va aparte y no depende de esto.
// ────────────────────────────────────────────────────────────────────────────

/** Un pitido corto. `veces` para insistir un poco más en la cocina. */
export function pitar({ veces = 1, hz = 880, ms = 180, separacion = 220, ctxFn } = {}) {
  try {
    const Ctx = ctxFn || (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext))
    if (!Ctx) return false
    const ctx = new Ctx()
    for (let i = 0; i < veces; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.frequency.value = hz
      g.gain.value = 0.08
      const t0 = ctx.currentTime + (i * separacion) / 1000
      o.start(t0); o.stop(t0 + ms / 1000)
    }
    return true
  } catch {
    return false   // sin audio: el aviso visual sigue estando
  }
}

/** Vibra, si el aparato puede. En una tablet colgada no hace nada, y da igual. */
export const vibrar = (patron = [120, 60, 120]) => {
  try { return !!navigator.vibrate?.(patron) } catch { return false }
}

/** Aviso completo. Devuelve si sonó, para poder probarlo. */
export function avisar(opts) {
  const sono = pitar(opts)
  vibrar(opts?.patron)
  return sono
}

/**
 * ¿Hay algo en `ids` que no estuviera en `antes`?
 *
 * Se compara por id y no por cuántos hay: si entra una comanda y se sirve otra
 * a la vez, el total no cambia y el aviso no sonaría.
 */
export function hayNuevos(antes, ahora) {
  if (antes == null) return false          // primera vez: no se avisa de lo que ya había
  const yaEstaban = new Set(String(antes).split('|').filter(Boolean))
  return String(ahora).split('|').filter(Boolean).some(id => !yaEstaban.has(id))
}

/** Clave estable de una lista de pedidos, para comparar entre renders. */
export const claveDe = (pedidos = []) =>
  (pedidos || []).map(p => p?.id).filter(Boolean).sort().join('|')
