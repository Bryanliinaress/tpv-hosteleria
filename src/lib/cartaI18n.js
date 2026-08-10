// ────────────────────────────────────────────────────────────────────────────
// La CARTA en el idioma del cliente.
//
// La carta la escribe el local en su idioma, así que cambiar a inglés dejaba
// los platos y sus ingredientes en español: el turista leía «Book a table» y
// justo debajo «Jamón york, Mantequilla». Aquí se traduce lo que se puede sin
// pedirle nada al bar:
//
//   1. Si el producto trae traducción propia (`nombreEn`, `descripcionEn`), esa
//      manda siempre: la escribe el dueño y sabe lo que vende.
//   2. Si no, se busca en este diccionario de términos de bar, que cubre lo
//      habitual en España (ingredientes, panes, extras).
//   3. Si tampoco, se deja tal cual. Nunca se inventa una traducción.
//
// Se traduce término a término, separando por comas, porque las descripciones
// de la carta son listas de ingredientes («Jamón serrano, Tomate, Aceite»).
// ────────────────────────────────────────────────────────────────────────────

// Clave: término en español, normalizado (minúsculas y sin tildes).
const EN = {
  // Carnes y embutidos
  'jamon york': 'Cooked ham',
  'jamon york pata': 'Cooked ham (bone-in)',
  'jamon serrano': 'Serrano ham',
  'jamon iberico': 'Iberian ham',
  'lomo en manteca': 'Pork loin in lard',
  'lomo adobado': 'Marinated pork loin',
  'salchichon': 'Salchichón (cured sausage)',
  'sobrasada': 'Sobrasada (soft cured sausage)',
  'zurrapa': 'Zurrapa (pork lard pâté)',
  'chorizo': 'Chorizo',
  'pavo': 'Turkey',
  'beicon': 'Bacon',
  'bacon': 'Bacon',
  'filete de pollo': 'Chicken fillet',
  'pollo': 'Chicken',
  'cerdo': 'Pork',
  'carne (pollo o cerdo)': 'Meat (chicken or pork)',
  'serranito (pollo o cerdo)': 'Serranito (chicken or pork)',
  'lomo': 'Pork loin',
  'atun': 'Tuna',
  'anchoas': 'Anchovies',
  // Lácteos y huevo
  'queso': 'Cheese',
  'queso manchego': 'Manchego cheese',
  'mantequilla': 'Butter',
  'huevo': 'Egg',
  'huevos': 'Eggs',
  'tortilla francesa': 'Plain omelette',
  'tortilla de patatas': 'Spanish omelette',
  'tortilla francesa completa': 'Plain omelette with the works',
  // Verduras y aliños
  'tomate': 'Tomato',
  'aceite': 'Olive oil',
  'lechuga': 'Lettuce',
  'pimiento': 'Pepper',
  'pimientos': 'Peppers',
  'cebolla': 'Onion',
  'mayonesa': 'Mayonnaise',
  'alioli': 'Garlic mayonnaise',
  'vegetales': 'Vegetables',
  'aguacate': 'Avocado',
  'especial de la casa': 'House special',
  // Nombres de bocadillo que en España significan lo mismo en cualquier barra
  'mixto': 'Ham & cheese',
  'mixto vegetal': 'Veggie & cheese',
  'catalana': 'Tomato & Serrano ham',
  'catalana con queso manchego': 'Tomato, Serrano ham & Manchego',
  'beicon completo': 'Bacon & egg',
  'lomo adobado completo': 'Marinated pork loin with the works',
  'york pata': 'Cooked ham (bone-in)',
  'pepito': 'Steak sandwich',
  'vegetal': 'Veggie',
  'completo': 'With the works',
  // Categorías habituales de una carta española
  'desayunos': 'Breakfast',
  'cafes': 'Coffee',
  'bebidas': 'Drinks',
  'refrescos': 'Soft drinks',
  'cervezas': 'Beers',
  'vinos': 'Wines',
  'tapas': 'Tapas',
  'raciones': 'Sharing plates',
  'entrantes': 'Starters',
  'ensaladas': 'Salads',
  'carnes': 'Meat',
  'pescados': 'Fish',
  'postres': 'Desserts',
  'bocadillos': 'Sandwiches',
  'montaditos': 'Small sandwiches',
  'menu del dia': 'Set menu',
  // Rótulos configurables de la carta (el local puede renombrarlos)
  'pan': 'Bread',
  'tipo de pan': 'Bread type',
  'extras': 'Extras',
  'tamano': 'Size',
  'masa': 'Base',
  'ingredientes': 'Toppings',
  'variedad': 'Variety',
  'formato': 'Size',
  // Panes y formatos
  'normal': 'Plain',
  'mollete': 'Mollete (soft bun)',
  'pan de centeno': 'Rye bread',
  'multicereal': 'Multigrain',
  'integral': 'Wholemeal',
  'sin gluten': 'Gluten free',
  'pitufo': 'Small roll',
  'viena': 'Vienna roll',
  'barra': 'Baguette',
  'media': 'Half',
  // Bebidas y cafés que suelen escribirse igual en toda España
  'cafe solo (espresso)': 'Espresso',
  'cafe solo con mas agua': 'Long black coffee',
  'entre solo y largo': 'Between espresso and long',
  'mitad cafe, mitad leche': 'Half coffee, half milk',
  'un poco menos de leche que el corto': 'A little less milk than «corto»',
  'cafe con un poco de leche': 'Coffee with a dash of milk',
  'leche con un toque de cafe': 'Milk with a touch of coffee',
  'leche con una nube de cafe': 'Milk with a cloud of coffee',
  'lata/botellin 33cl': 'Can/bottle 33cl',
  'agua mineral': 'Mineral water',
  'cerveza': 'Beer',
  'refresco': 'Soft drink',
  'zumo': 'Juice',
  'infusion': 'Herbal tea',
  'te': 'Tea',
  'leche': 'Milk',
  'tostada': 'Toast',
}

/** minúsculas, sin tildes y sin espacios de más: así casan «Jamón York» y «jamon york». */
// los diacríticos se escriben con su código: en el fichero se verían como
// caracteres invisibles pegados al corchete
const SIN_TILDE = new RegExp('[\u0300-\u036f]', 'g')
const clave = (s) => (s || '').toLowerCase().normalize('NFD').replace(SIN_TILDE, '').trim()

// Devuelve el término traducido conservando la mayúscula inicial del original.
function unTermino(texto) {
  const t = (texto || '').trim()
  if (!t) return t
  const en = EN[clave(t)]
  if (!en) return t
  return /^[a-záéíóúñ]/.test(t) ? en.charAt(0).toLowerCase() + en.slice(1) : en
}

/**
 * Traduce un texto de carta al idioma pedido. En español devuelve el original.
 * Prueba el texto entero y, si no está, término a término separando por comas
 * (las descripciones de la carta son listas de ingredientes).
 */
export function traducirCarta(idioma, texto) {
  if (idioma !== 'en' || !texto) return texto
  // el texto entero puede ser un término con coma («Mitad café, mitad leche»)
  if (EN[clave(texto)]) return unTermino(texto)

  // Los nombres de bocadillo son listas: «Jamón york y mantequilla»,
  // «Aceite, tomate». Se parte conservando los separadores para recomponer.
  const trozos = texto.split(/(\s*,\s*|\s+y\s+|\s+e\s+)/i)
  if (trozos.length === 1) return unTermino(texto)

  let algunoTraducido = false
  const salida = trozos.map((tz, i) => {
    if (i % 2 === 1) return tz.includes(',') ? ', ' : ' and '
    const t = unTermino(tz)
    if (t !== tz.trim()) algunoTraducido = true
    return t
  })
  // si no se reconoció nada, se devuelve el original intacto
  return algunoTraducido ? salida.join('') : texto
}

/** Nombre del producto: manda la traducción que haya escrito el local. */
export const nombreProducto = (idioma, prod) =>
  (idioma === 'en' && prod?.nombreEn?.trim()) ? prod.nombreEn.trim() : traducirCarta(idioma, prod?.nombre)

/**
 * Descripción que se enseña. `texto` es lo que la pantalla iba a pintar (puede
 * venir recortado por `descripcionUtil`); la traducción del local gana.
 */
export const descripcionProducto = (idioma, prod, texto = prod?.descripcion) =>
  (idioma === 'en' && prod?.descripcionEn?.trim()) ? prod.descripcionEn.trim() : traducirCarta(idioma, texto)

/**
 * Texto extra por el que se puede buscar un producto: su traducción. Con la
 * carta en inglés, teclear «cheese» no encontraba nada porque se buscaba solo
 * en el español.
 */
export const textoBuscable = (idioma, prod) => {
  if (idioma !== 'en' || !prod) return ''
  return [
    nombreProducto(idioma, prod),
    descripcionProducto(idioma, prod),
    ...(prod.ingredientes || []).map(i => traducirCarta(idioma, i)),
  ].filter(Boolean).join(' ')
}

/** Cuántos términos del diccionario hay (para los tests y el panel). */
export const terminosConocidos = () => Object.keys(EN).length
