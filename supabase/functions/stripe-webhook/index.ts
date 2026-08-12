// Edge Function (Supabase / Deno): webhook de Stripe.
//
// POR QUÉ EXISTE: hasta ahora la app marcaba una cuenta como pagada porque el
// NAVEGADOR volvía diciendo "he pagado". Eso es fiarse del cliente: si cierra
// el móvil justo después de pagar no nos enteramos, y una URL manipulada podía
// marcar como pagada una cuenta sin cobrar. Stripe avisa aquí, servidor a
// servidor y con firma criptográfica: esta es la fuente fiable.
//
// Secretos del proyecto: STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET.
import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})
const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  // 1) Verificar la firma: sin esto cualquiera podría fingir un pago
  const firma = req.headers.get('stripe-signature')
  const cuerpo = await req.text()
  let evento: Stripe.Event
  try {
    evento = await stripe.webhooks.constructEventAsync(cuerpo, firma!, WEBHOOK_SECRET, undefined, Stripe.createSubtleCryptoProvider())
  } catch (e) {
    console.error('firma inválida:', e)
    return json({ error: 'firma inválida' }, 400)
  }

  // 2) Solo nos interesa el pago completado
  if (evento.type !== 'checkout.session.completed') return json({ recibido: true })

  const sesion = evento.data.object as Stripe.Checkout.Session
  if (sesion.payment_status !== 'paid') return json({ recibido: true, ignorado: 'no pagado' })

  const { mesaId, personaId, localId } = (sesion.metadata ?? {}) as Record<string, string>
  const propina = Number(sesion.metadata?.propina ?? 0)
  if (!mesaId) return json({ error: 'sesión sin mesa' }, 400)

  // Los metadatos de Stripe son SIEMPRE texto: lo que no existe llega como
  // cadena vacía, no como null. Y `??` no la convierte —solo mira null y
  // undefined—, así que a `p_local uuid` le llegaba «""» y Postgres cortaba
  // con «invalid input syntax for type uuid» antes de mirar nada. El cliente
  // nunca manda localId, así que esto pasaba en TODOS los cobros: el 100 % de
  // los avisos de Stripe moría aquí y ninguna mesa se cerró jamás sola.
  const uuidODenull = (v?: string) => (v && v.trim() !== '' ? v : null)

  try {
    // 3) Registrar el cobro en la base de datos (idempotente: si Stripe
    //    reintenta el aviso, no se cobra dos veces)
    const { data, error } = await supabase.rpc('registrar_pago_online', {
      p_mesa: mesaId,
      p_comensal: personaId && personaId !== '__todo__' ? personaId : null,
      p_importe: (sesion.amount_total ?? 0) / 100,
      p_propina: propina,
      p_referencia: sesion.id,
      p_local: uuidODenull(localId),
    })
    if (error) throw error
    console.log('pago registrado', sesion.id, data)
    return json({ recibido: true, resultado: data })
  } catch (e) {
    // `String(e)` sobre un error de supabase-js da «[object Object]»: el panel
    // de Stripe enseñaba justo eso y no había forma de saber qué fallaba.
    const detalle = (e as { message?: string })?.message ?? JSON.stringify(e)
    console.error('no se pudo registrar el pago:', detalle, e)
    // 500 hace que Stripe reintente: mejor que dar por bueno un cobro perdido
    return json({ error: detalle }, 500)
  }
})
