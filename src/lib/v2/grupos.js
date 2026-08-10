// ────────────────────────────────────────────────────────────────────────────
// Grupos de mesas (dos mesas de cuatro juntas para un grupo de ocho).
//
// En el backend real lo que une las mesas es la columna `unida_a`: los
// comensales SE QUEDAN en su mesa y al cobrar el servidor recoge el grupo
// entero. Por eso cualquier operación sobre una mesa unida tiene que pensar en
// el grupo: liberar solo la cabeza dejaba las demás con gente sentada, marcadas
// como libres y con su consumo sin cobrar.
// ────────────────────────────────────────────────────────────────────────────

/** La mesa que manda en el grupo. Una mesa suelta es su propia cabeza. */
export const cabezaDe = (mesa, mesas = []) =>
  (mesa?.unidaA ? mesas.find(m => m.id === mesa.unidaA) || mesa : mesa)

/** Ids de la cabeza y de todas las mesas colgadas de ella. */
export const miembrosDe = (cabeza, mesas = []) =>
  (cabeza ? [cabeza.id, ...mesas.filter(m => m.unidaA === cabeza.id).map(m => m.id)] : [])

/** Ids del grupo al que pertenece una mesa, se le pase la cabeza o una unida. */
export function grupoDe(mesaId, mesas = []) {
  const mesa = mesas.find(m => m.id === mesaId)
  if (!mesa) return mesaId ? [mesaId] : []
  return miembrosDe(cabezaDe(mesa, mesas), mesas)
}
