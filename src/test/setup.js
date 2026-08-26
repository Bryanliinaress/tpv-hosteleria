// Entorno de los tests.
//
// La mayoría corren en Node (lógica pura, store, SQL leído como texto) y solo
// necesitan un `localStorage` de mentira, que es lo que usa zustand/persist.
// Los tests de PANTALLA declaran `@vitest-environment jsdom` en su cabecera y
// ahí `localStorage` ya existe de verdad: no hay que pisarlo.
if (!globalThis.localStorage) {
  const almacen = new Map()
  globalThis.localStorage = {
    getItem: (k) => (almacen.has(k) ? almacen.get(k) : null),
    setItem: (k, v) => almacen.set(k, String(v)),
    removeItem: (k) => almacen.delete(k),
    clear: () => almacen.clear(),
    key: (i) => [...almacen.keys()][i] ?? null,
    get length() { return almacen.size },
  }
}

// jsdom no trae `ResizeObserver` y varias pantallas lo usan para medir (la
// barra de categorías de la carta, por ejemplo). Un doble que no hace nada
// basta: lo que se prueba es lo que se ve, no cuánto mide.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
