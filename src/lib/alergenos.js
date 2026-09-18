// ────────────────────────────────────────────────────────────────────────────
// Los 14 alérgenos de declaración obligatoria en la UE (Reglamento 1169/2011).
//
// Vivían dentro de `store/useStore.js`, que importa zustand y no se puede
// cargar desde Node. Eso dejaba a los scripts sin forma de comprobar que un
// alérgeno existe: el cargador de cartas habría tenido que repetir la lista, y
// una lista repetida es una lista que un día deja de coincidir — con el
// agravante de que aquí la que fallara sería la que le dice a un celíaco si
// puede comerse un plato.
//
// Aquí no se importa nada, así que lo lee igual el navegador que un script.
// ────────────────────────────────────────────────────────────────────────────

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

/** ¿Es uno de los 14? Lo usa el cargador de cartas antes de escribir nada. */
export const esAlergeno = (id) => Object.hasOwn(ALERGENO_INFO, id)
