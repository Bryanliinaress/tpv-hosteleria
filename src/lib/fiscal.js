import { supabase } from './supabase'

// ────────────────────────────────────────────────────────────────────────────
// Registro fiscal Verifactu (RD 1007/2023) vía la Edge Function `registrar-fiscal`.
//
// Regla de oro: registrar en la AEAT NUNCA debe bloquear el cobro. Si falla
// (sin red, AEAT caída, NIF sin configurar), el ticket queda pendiente y se
// reintenta; el bar sigue cobrando con normalidad.
// ────────────────────────────────────────────────────────────────────────────

const URL = import.meta.env.VITE_SUPABASE_URL
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Se activa a propósito: sin esto no se llama a la pasarela fiscal.
export const fiscalActivo = import.meta.env.VITE_FISCAL === 'verifactu'

async function llamar(cuerpo) {
  const { data: sesion } = await supabase.auth.getSession()
  const token = sesion?.session?.access_token || KEY
  const res = await fetch(`${URL}/functions/v1/registrar-fiscal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: KEY },
    body: JSON.stringify(cuerpo),
  })
  return res.json().catch(() => ({}))
}

// Registra un ticket recién cobrado. No lanza: los fallos se reintentan.
export async function registrarTicket(ticketId) {
  if (!fiscalActivo || !ticketId) return null
  try { return await llamar({ ticketId }) } catch (e) { console.warn('fiscal:', e); return null }
}

// Reintenta los tickets que quedaron sin registrar (al abrir Admin o a mano).
export async function reintentarPendientes(localId) {
  if (!fiscalActivo) return null
  try { return await llamar({ pendientes: true, localId }) } catch (e) { console.warn('fiscal:', e); return null }
}

// Tickets sin registrar, para avisar al dueño en el panel.
export async function pendientesFiscales() {
  if (!fiscalActivo) return []
  const { data, error } = await supabase.rpc('tickets_fiscal_pendientes')
  return error ? [] : (data || [])
}
