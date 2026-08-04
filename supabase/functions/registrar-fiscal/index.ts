// Edge Function (Supabase / Deno): registra un ticket en la AEAT vía Verifacti
// (Verifactu, RD 1007/2023) y guarda el QR verificable en el propio ticket.
//
// La API key de Verifacti vive aquí como secreto del proyecto
// (VERIFACTI_API_KEY), nunca en el navegador.
//
// Uso: POST { ticketId }  → { estado, qr, url, numero }
//      POST { pendientes: true }  → reintenta los tickets que fallaron
//
// Importante: el cobro NO depende de esto. Si la AEAT o la red fallan, el
// ticket queda 'pendiente'/'error' y se reintenta; el bar sigue cobrando.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const VERIFACTI_URL = Deno.env.get('VERIFACTI_URL') ?? 'https://api.verifacti.com'
const API_KEY = Deno.env.get('VERIFACTI_API_KEY') ?? ''

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

// dd-mm-aaaa, como espera Verifacti
const fechaES = (iso: string) => {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`
}
const dec = (n: number) => (Math.round(n * 100) / 100).toFixed(2)

// Un ticket de bar es una FACTURA SIMPLIFICADA (F2). Los precios de la carta
// llevan el IVA incluido, así que hay que desglosar base y cuota por tipo.
function componerFactura(t: Record<string, unknown>) {
  const emisor = t.emisor as Record<string, string>
  const total = Number(t.total)
  const ivaPct = Number(emisor.ivaPct ?? 10)
  const base = total / (1 + ivaPct / 100)
  const cuota = total - base

  // OJO: en factura simplificada (F2) NO se identifica al destinatario; los
  // campos nif/nombre son del CLIENTE y la AEAT los rechaza aquí. El emisor
  // va implícito en la API key (cada NIF tiene la suya).
  return {
    serie: emisor.serie || 'TPV',
    numero: String(t.numero),
    fecha_expedicion: fechaES(String(t.fecha)),
    tipo_factura: 'F2',                       // factura simplificada (ticket)
    descripcion: 'Consumicion en local',
    lineas: [{
      base_imponible: dec(base),
      tipo_impositivo: String(ivaPct),
      cuota_repercutida: dec(cuota),
    }],
    importe_total: dec(total),
  }
}

async function registrar(ticketId: string) {
  const { data: t, error } = await supabase.rpc('ticket_para_fiscal', { p_ticket: ticketId })
  if (error || !t) return { ok: false, motivo: 'ticket_no_encontrado' }
  if (t.estado === 'enviado') return { ok: true, yaEnviado: true, qr: null }

  const emisor = t.emisor as Record<string, string>
  if (!emisor?.nif) {
    // sin NIF configurado no se puede registrar: se marca y se avisa en Admin
    await supabase.rpc('fiscal_resultado', {
      p_ticket: ticketId, p_estado: 'error', p_error: 'Falta el CIF/NIF del local (Admin → Local)',
    })
    return { ok: false, motivo: 'sin_nif' }
  }

  const factura = componerFactura(t)
  try {
    const res = await fetch(`${VERIFACTI_URL}/verifactu/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify(factura),
    })
    const cuerpo = await res.json().catch(() => ({}))

    if (!res.ok) {
      const msg = cuerpo?.message || cuerpo?.error || `HTTP ${res.status}`
      await supabase.rpc('fiscal_resultado', {
        p_ticket: ticketId, p_estado: 'error', p_error: String(msg).slice(0, 300),
      })
      return { ok: false, motivo: msg }
    }

    await supabase.rpc('fiscal_resultado', {
      p_ticket: ticketId, p_estado: 'enviado',
      p_uuid: cuerpo.uuid ?? null,
      p_qr: cuerpo.qr ?? cuerpo.qr_base64 ?? null,
      p_url: cuerpo.url ?? cuerpo.qr_url ?? null,
    })
    return { ok: true, uuid: cuerpo.uuid, qr: cuerpo.qr ?? cuerpo.qr_base64 ?? null, url: cuerpo.url ?? null }
  } catch (e) {
    await supabase.rpc('fiscal_resultado', {
      p_ticket: ticketId, p_estado: 'pendiente', p_error: `Sin conexión con Verifacti: ${e}`.slice(0, 300),
    })
    return { ok: false, motivo: 'sin_conexion' }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)
  if (!API_KEY) return json({ error: 'VERIFACTI_API_KEY no configurada' }, 500)

  try {
    const { ticketId, pendientes, localId } = await req.json()

    // reintento en lote de lo que quedó sin registrar
    if (pendientes) {
      const { data } = await supabase
        .from('tickets')
        .select('id')
        .in('fiscal_estado', ['pendiente', 'error'])
        .lt('fiscal_intentos', 10)
        .eq(localId ? 'local_id' : 'fiscal_estado', localId ?? 'pendiente')
        .limit(25)
      const ids = (data ?? []).map((r: { id: string }) => r.id)
      const res = []
      for (const id of ids) res.push({ id, ...(await registrar(id)) })
      return json({ procesados: res.length, resultados: res })
    }

    if (!ticketId) return json({ error: 'Falta ticketId' }, 400)
    const r = await registrar(ticketId)
    return json(r, r.ok ? 200 : 202)   // 202: aceptado pero pendiente de reintento
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
