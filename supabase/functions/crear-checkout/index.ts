// Edge Function (Supabase / Deno): crea una sesión de Stripe Checkout para
// cobrar "la parte" de un comensal. La clave secreta de Stripe vive aquí como
// secreto del proyecto (STRIPE_SECRET_KEY), nunca en el cliente.
import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

// Para preguntarle a la BBDD cuánto se debe: el importe NO puede venir del
// navegador (si el cliente elige cuánto paga, paga 0,50 € de una cuenta de 45).
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  try {
    const { descripcion, mesaId, personaId, returnUrl, localId, propina } = await req.json()
    if (!mesaId) return json({ error: 'Falta la mesa' }, 400)

    // Lo que se cobra lo dice el servidor; del cliente solo se acepta la
    // propina, que es un extra voluntario por encima de la cuenta.
    const { data: pendiente, error: eP } = await supabase.rpc('pendiente_de_pago', {
      p_mesa: mesaId,
      p_comensal: personaId && personaId !== '__todo__' ? personaId : null,
    })
    if (eP) return json({ error: 'No se pudo calcular la cuenta' }, 400)
    const extra = Math.max(0, Number(propina) || 0)
    const cents = Math.round((Number(pendiente ?? 0) + extra) * 100)
    if (!cents || cents < 50) return json({ error: 'Importe inválido (mínimo 0,50 €)' }, 400)

    // El retorno tiene que ser al sitio desde el que se paga: si lo eligiera el
    // cuerpo de la petición, se podría devolver al cliente a otro dominio.
    const origen = req.headers.get('Origin') ?? ''
    const pedido = String(returnUrl || '')
    if (origen && !pedido.startsWith(origen)) return json({ error: 'Retorno no válido' }, 400)
    const base = pedido.split('#')[0].split('?')[0]
    const q = `pago=ok&mesa=${encodeURIComponent(mesaId)}&persona=${encodeURIComponent(personaId)}`

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // Sin payment_method_types: Stripe Checkout usa automáticamente los
      // métodos activos en tu panel (tarjeta por defecto; Bizum al activarlo).
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: descripcion || 'Cuenta TPV' },
          unit_amount: cents,
        },
        quantity: 1,
      }],
      success_url: `${base}?${q}#/mesa/${mesaId}`,
      cancel_url: `${base}?pago=cancel#/mesa/${mesaId}`,
      // El webhook (fuente fiable del cobro) necesita saber qué se ha pagado:
      // el retorno del navegador ya no decide nada.
      // Solo lo que tiene valor: los metadatos de Stripe son texto, y un campo
      // vacío llega al webhook como «""», que no es un uuid válido. Mejor que
      // no exista a que exista mintiendo.
      metadata: Object.fromEntries(Object.entries({
        mesaId: mesaId ?? '',
        personaId: personaId ?? '',
        localId: localId ?? '',
        propina: String(propina ?? 0),
      }).filter(([, v]) => String(v).trim() !== '').map(([k, v]) => [k, String(v)])),
    })

    return json({ url: session.url })
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 400)
  }
})
