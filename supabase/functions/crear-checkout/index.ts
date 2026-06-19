// Edge Function (Supabase / Deno): crea una sesión de Stripe Checkout para
// cobrar "la parte" de un comensal. La clave secreta de Stripe vive aquí como
// secreto del proyecto (STRIPE_SECRET_KEY), nunca en el cliente.
import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

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
    const { importe, descripcion, mesaId, personaId, returnUrl } = await req.json()
    const cents = Math.round(Number(importe) * 100)
    if (!cents || cents < 50) return json({ error: 'Importe inválido (mínimo 0,50 €)' }, 400)

    const base = String(returnUrl || '').split('#')[0].split('?')[0]
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
    })

    return json({ url: session.url })
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 400)
  }
})
