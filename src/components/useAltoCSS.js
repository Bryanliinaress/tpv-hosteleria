import { useEffect, useRef } from 'react'

// ────────────────────────────────────────────────────────────────────────────
// Publica el alto real de un elemento en una variable CSS del documento.
//
// Hace falta para apilar barras pegajosas. Tres elementos con `top: 0` en el
// mismo contenedor no se apilan: se superponen, y gana el que tenga más
// z-index. Pasaba con la banda de demostración (z 9999), la cabecera del panel
// (z 20) y la tira de pestañas (z 15): al bajar, la banda cortaba el título por
// la mitad y las pestañas desaparecían detrás de la cabecera.
//
// El alto no se puede escribir a mano porque cambia: la banda se acorta en
// móvil y la cabecera reparte sus botones en dos líneas (`flexWrap`) según lo
// largo que sea el nombre del local. Por eso se mide.
//
// Cuando el elemento no está (`ref` vacía, p. ej. sin banda porque el local no
// es una demostración) la variable queda en 0px, que es justo lo que hace falta
// para que `top: var(--alto-aviso, 0px)` siga valiendo.
// ────────────────────────────────────────────────────────────────────────────
export function useAltoCSS(nombreVar) {
  const ref = useRef(null)

  useEffect(() => {
    const raiz = document.documentElement
    const el = ref.current
    if (!el) { raiz.style.setProperty(nombreVar, '0px'); return }

    const medir = () => raiz.style.setProperty(nombreVar, `${Math.round(el.getBoundingClientRect().height)}px`)
    medir()

    // ResizeObserver no existe en navegadores viejos; sin él la medida inicial
    // ya es correcta y solo se pierde el reajuste al girar la tablet.
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => { ro.disconnect(); raiz.style.setProperty(nombreVar, '0px') }
  }, [nombreVar])

  return ref
}
