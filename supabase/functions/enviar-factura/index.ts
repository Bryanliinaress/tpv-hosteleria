// Edge Function (Supabase / Deno): manda una factura por correo con el PDF
// adjunto, a través de Resend.
//
// Por qué aquí y no desde el navegador: EmailJS solo adjunta archivos en sus
// planes de pago, y el correo que lleva un documento fiscal no debería salir
// de una clave que viaja en la web. Aquí la clave vive como secreto del
// proyecto y el correo sale del DOMINIO del bar (facturas@su-bar.es), que es
// lo que hace que llegue a la bandeja de entrada y no a spam.
//
// Secretos (Supabase → Edge Functions → Secrets), NUNCA en el repositorio:
//   RESEND_API_KEY     la clave de Resend
//   CORREO_REMITENTE   quién envía, con un dominio verificado en Resend:
//                      «Bar Loli <facturas@barloli.es>»
//
// Sin ellos responde `sin_configurar` y la pantalla ofrece Compartir el PDF.
//
// Uso: POST { facturaId, para, pdf }   (pdf = el PDF en base64)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const REMITENTE = Deno.env.get('CORREO_REMITENTE') ?? ''

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

// El local sale del PROPIO token del aparato (app_metadata.local_id), igual que
// en `registrar-fiscal`: nunca del cuerpo de la petición.
async function localDelLlamante(req: Request): Promise<string | null> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) return null
  const meta = (data.user.app_metadata ?? {}) as Record<string, string>
  return meta.local_id ?? null
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
// Una factura de un bar son unos KB; 2 MB de PDF es ya una señal de que eso
// no es una factura nuestra. En base64 ocupa un tercio más.
const MAX_PDF_BASE64 = 2_800_000

const euros = (n: number) => `${(Math.round(n * 100) / 100).toFixed(2).replace('.', ',')} €`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ ok: false, motivo: 'metodo' }, 405)

  // Sin configurar no es un error del bar: la pantalla ofrece Compartir.
  if (!RESEND_API_KEY || !REMITENTE) return json({ ok: false, motivo: 'sin_configurar' })

  const local = await localDelLlamante(req)
  if (!local) return json({ ok: false, motivo: 'sin_sesion' }, 401)

  let cuerpo: Record<string, unknown>
  try { cuerpo = await req.json() } catch { return json({ ok: false, motivo: 'peticion' }, 400) }
  const facturaId = String(cuerpo.facturaId ?? '')
  const para = String(cuerpo.para ?? '').trim()
  const pdf = String(cuerpo.pdf ?? '')

  if (!EMAIL.test(para)) return json({ ok: false, motivo: 'email_invalido' }, 400)
  if (!pdf || pdf.length > MAX_PDF_BASE64) return json({ ok: false, motivo: 'pdf_invalido' }, 400)
  // Tiene que ser un PDF de verdad: «%PDF-» en base64 empieza por «JVBERi0».
  if (!pdf.startsWith('JVBERi0')) return json({ ok: false, motivo: 'pdf_invalido' }, 400)

  const { data: f } = await supabase
    .from('facturas')
    .select('id, local_id, serie, numero, total, emisor, cliente_nombre, fiscal_estado')
    .eq('id', facturaId)
    .maybeSingle()
  if (!f || f.local_id !== local) return json({ ok: false, motivo: 'factura_no_existe' }, 403)
  // Una rechazada por Hacienda no vale: mandarla sería dar por buena una
  // factura que no consta. Primero se corrige.
  if (f.fiscal_estado === 'error') return json({ ok: false, motivo: 'factura_rechazada' }, 409)

  // El texto lo escribe el SERVIDOR con los datos de la factura, no la
  // pantalla: así este dominio solo puede mandar facturas, no cualquier cosa.
  const e = (f.emisor ?? {}) as Record<string, string>
  const quien = e.razonSocial || e.nombre || 'el local'
  const numero = `${f.serie}-${f.numero}`
  const asunto = `Factura ${numero} de ${quien}`
  const texto = [
    `Hola${f.cliente_nombre ? `, ${f.cliente_nombre}` : ''}:`,
    '',
    `Te adjuntamos en PDF la factura ${numero} de ${quien}, por importe de ${euros(Number(f.total))}.`,
    '',
    'Un saludo,',
    `${quien}${e.cif ? ` · NIF ${e.cif}` : ''}`,
  ].join('\n')

  let res: Response
  let r: Record<string, unknown> = {}
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: REMITENTE,
        to: [para],
        subject: asunto,
        text: texto,
        attachments: [{ filename: `Factura-${numero}.pdf`, content: pdf }],
      }),
    })
    r = await res.json().catch(() => ({}))
  } catch (err) {
    await supabase.from('envios_factura').insert({
      local_id: local, factura_id: f.id, para, estado: 'error', error: `Sin conexión con Resend: ${err}`.slice(0, 300),
    })
    return json({ ok: false, motivo: 'proveedor', error: 'Sin conexión con el servicio de correo' }, 502)
  }

  // Cada envío queda apuntado: «¿se la mandaste?» tiene respuesta.
  await supabase.from('envios_factura').insert({
    local_id: local, factura_id: f.id, para,
    estado: res.ok ? 'enviado' : 'error',
    proveedor_id: (r.id as string) ?? null,
    error: res.ok ? null : String(r.message ?? `HTTP ${res.status}`).slice(0, 300),
  })

  return res.ok
    ? json({ ok: true, id: r.id ?? null })
    : json({ ok: false, motivo: 'proveedor', error: String(r.message ?? `HTTP ${res.status}`) }, 502)
})
