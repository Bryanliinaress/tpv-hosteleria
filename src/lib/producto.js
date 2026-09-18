// ────────────────────────────────────────────────────────────────────────────
// Cómo se llama el software.
//
// No confundir con la marca del LOCAL (`lib/perfil.js`): esa cambia con cada
// bar, y esta no. Casa Loli es el bar; Marchando es el TPV que usa.
//
// Estaba escrito a pelo en el PDF de las facturas («Marchando TPV») y en
// ningún sitio más, así que la portada acababa repitiendo el nombre del bar
// donde debería ir el del producto.
// ────────────────────────────────────────────────────────────────────────────

export const PRODUCTO = 'Marchando'

/** Para metadatos donde conviene decir que es un TPV (PDF, manifest…). */
export const PRODUCTO_LARGO = `${PRODUCTO} TPV`
