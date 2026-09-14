import { pedirTexto, confirmar, toast } from '../store/useUI'
import { hayConsumo } from '../lib/borradores'
import { pendienteDeMesa } from '../lib/dinero'

/**
 * El diálogo de «Cerrar mesa sin cobrar», igual en el Mostrador y en la PDA.
 *
 * Antes cada pantalla lo hacía a su manera, y la PDA cerraba de un toque sin
 * preguntar nada: la cuenta desaparecía. Ahora, si hay algo pedido, se pide el
 * MOTIVO —sin él no se cierra— y la cuenta queda guardada en Admin › Caja ›
 * Borradores. Una mesa sin nada pedido solo pide confirmación.
 *
 * Devuelve `true` si la mesa se cerró.
 */
export async function pedirCierreSinCobrar({ mesa, cerrarMesaSinCobrar, por }) {
  if (!mesa) return false

  if (!hayConsumo(mesa)) {
    const ok = await confirmar({
      titulo: `Cerrar la Mesa ${mesa.numero}`,
      mensaje: 'No tiene nada pedido. Se libera y queda lista para el siguiente cliente.',
      confirmar: 'Cerrar mesa',
    })
    if (!ok) return false
    const r = cerrarMesaSinCobrar(mesa.id, { por })
    if (!r?.ok) { toast(r?.error || 'No se pudo cerrar la mesa', 'error'); return false }
    return true
  }

  const pendiente = pendienteDeMesa(mesa)
  let mensaje = `Quedan ${pendiente.toFixed(2)} € sin cobrar. No se cobra a nadie, pero la cuenta queda guardada en Admin › Caja › Borradores con este motivo.`
  for (;;) {
    const motivo = await pedirTexto({
      titulo: `Cerrar la Mesa ${mesa.numero} sin cobrar`,
      mensaje,
      placeholder: 'Se fue sin pagar, invitación, abierta por error…',
      confirmar: 'Cerrar sin cobrar',
    })
    if (motivo === null) return false
    const r = cerrarMesaSinCobrar(mesa.id, { motivo, por })
    if (r?.ok) {
      toast(`Mesa ${mesa.numero} cerrada · la cuenta queda en Borradores`, 'success')
      return true
    }
    // Sin motivo (o demasiado largo): se vuelve a pedir diciendo por qué.
    mensaje = r?.error || mensaje
  }
}
