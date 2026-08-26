// Edge Function (Supabase / Deno): devuelve a la tarjeta del cliente el dinero
// de una rectificativa.
//
// POR QUÉ EXISTE: se podía emitir la rectificativa de un ticket pagado por
// Stripe, pero el dinero NO volvía a la tarjeta. Quedaba constancia fiscal y el
// arqueo descuadrado, y el cliente se iba sin su dinero creyendo que ya estaba.
//
// La clave secreta de Stripe vive aquí como secreto del proyecto
// (STRIPE_SECRET_KEY), nunca en el navegador.
//
// Uso: POST { rectificativaId }  → { ok, devuelto, refunds }
//
// El reembolso NO puede darse por hecho a la ligera: si Stripe falla, la
// rectificativa se queda en 'error' y se ve en Admin para reintentarla. Es el
// mismo patrón que el registro fiscal — nunca se pierde de vista.
import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// Esta función trabaja con service_role y se salta RLS: sin comprobar de qué
// local es quien llama, cualquiera con la clave anon (que es pública) podría
// devolver el dinero de OTRO bar.
//
// El local sale del PROPIO token, que es la misma fuente que usa `local_actual()`
// en la base (el `app_metadata.local_id` que se le puso a la cuenta del
// dispositivo al autorizarlo). Se hace con el cliente que ya existe y no
// creando otro: montar un segundo cliente aquí revienta el runtime
// («Deno.core.runMicrotasks() is not supported») y la función respondía «hace
// falta sesión» aunque la sesión fuera perfecta.
async function localDelLlamante(req: Request): Promise<string | null> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) return null
  const meta = (data.user.app_metadata ?? {}) as Record<string, string>
  return meta.local_id ?? null
}

const cents = (n: number) => Math.round(n * 100)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  let rectificativaId = ''
  try {
    const cuerpo = await req.json()
    rectificativaId = String(cuerpo?.rectificativaId ?? '')
    if (!rectificativaId) return json({ error: 'Falta la rectificativa' }, 400)

    const local = await localDelLlamante(req)
    if (!local) return json({ error: 'Hace falta sesión del local' }, 401)

    // La rectificativa, y que sea de QUIEN llama.
    const { data: rect, error: eRect } = await supabase
      .from('tickets')
      .select('id, local_id, total, numero, rectifica_a, reembolso_estado')
      .eq('id', rectificativaId)
      .single()
    if (eRect || !rect) return json({ error: 'No existe esa devolución' }, 404)
    if (rect.local_id !== local) return json({ error: 'Esa devolución no es de tu local' }, 403)
    if (!rect.rectifica_a) return json({ error: 'Eso no es una devolución' }, 400)
    if (rect.reembolso_estado === 'hecho') return json({ ok: true, yaHecho: true })

    // El ticket original, para saber qué cobros hay detrás.
    const { data: orig } = await supabase
      .from('tickets').select('numero').eq('id', rect.rectifica_a).single()
    if (!orig) return json({ error: 'No existe el ticket corregido' }, 404)

    const pendiente = Math.abs(Number(rect.total))

    // Los cobros con tarjeta del ticket y lo que queda por devolver de cada uno.
    // Va por RPC y no leyendo la tabla para que el filtro por local lo ponga el
    // servidor, no esta función.
    const { data: pagos, error: ePagos } = await supabase.rpc('pagos_devolubles_de', {
      p_local: local, p_numero: orig.numero,
    })
    if (ePagos) throw ePagos
    const disponibles = (pagos ?? []) as Array<{ id: string; referencia: string; disponible: number }>

    const total = disponibles.reduce((s, p) => s + Number(p.disponible), 0)
    if (total + 0.001 < pendiente) {
      const msg = `Solo quedan ${total.toFixed(2)} € devolubles con tarjeta de ese ticket`
      await supabase.rpc('anotar_reembolso', {
        p_rectificativa: rectificativaId, p_estado: 'error', p_error: msg,
      })
      return json({ error: msg }, 400)
    }

    // Se devuelve cobro a cobro, del más antiguo al más nuevo, hasta cubrirlo.
    let porDevolver = pendiente
    const reparto: Array<{ pago: string; importe: number }> = []
    const refunds: string[] = []

    for (const pago of disponibles) {
      if (porDevolver <= 0.001) break
      const importe = Math.min(porDevolver, Number(pago.disponible))

      // La referencia guardada es la sesión de Checkout; para devolver hace
      // falta su intención de pago.
      const sesion = await stripe.checkout.sessions.retrieve(pago.referencia)
      const intent = typeof sesion.payment_intent === 'string'
        ? sesion.payment_intent
        : sesion.payment_intent?.id
      if (!intent) throw new Error(`El cobro ${pago.referencia} no tiene pago que devolver`)

      const refund = await stripe.refunds.create({
        payment_intent: intent,
        amount: cents(importe),
        // Si esto se reintenta, Stripe no devuelve dos veces: la clave es la
        // rectificativa y el cobro, que no cambian entre reintentos.
        metadata: { rectificativa: rectificativaId, pago: pago.id },
      }, { idempotencyKey: `dev-${rectificativaId}-${pago.id}` })

      refunds.push(refund.id)
      reparto.push({ pago: pago.id, importe })
      porDevolver = Math.round((porDevolver - importe) * 100) / 100
    }

    await supabase.rpc('anotar_reembolso', {
      p_rectificativa: rectificativaId,
      p_estado: 'hecho',
      p_ref: refunds.join(','),
      p_reparto: reparto,
    })

    return json({ ok: true, devuelto: pendiente, refunds })
  } catch (e) {
    // `String(e)` sobre un error de supabase-js da «[object Object]»: hay que
    // sacar el mensaje o el panel enseña justo eso y no se sabe qué falló.
    const detalle = (e as { message?: string })?.message ?? JSON.stringify(e)
    console.error('devolver-pago:', detalle, e)
    if (rectificativaId) {
      await supabase.rpc('anotar_reembolso', {
        p_rectificativa: rectificativaId, p_estado: 'error', p_error: detalle,
      }).catch(() => {})
    }
    return json({ error: detalle }, 500)
  }
})
