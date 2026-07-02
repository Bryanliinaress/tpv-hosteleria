// Entorno mínimo para probar el store en Node: stub de localStorage
// (lo usa zustand/persist) sin necesidad de jsdom.
const almacen = new Map()
globalThis.localStorage = {
  getItem: (k) => (almacen.has(k) ? almacen.get(k) : null),
  setItem: (k, v) => almacen.set(k, String(v)),
  removeItem: (k) => almacen.delete(k),
  clear: () => almacen.clear(),
  key: (i) => [...almacen.keys()][i] ?? null,
  get length() { return almacen.size },
}
