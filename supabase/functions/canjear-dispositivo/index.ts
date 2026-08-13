// Edge Function (Supabase / Deno): convierte un dispositivo APROBADO en una
// sesión de verdad.
//
// POR QUÉ EXISTE: conectar un aparato pedía el correo y la contraseña del
// local. En un TPV que se monta bar por bar, eso es una credencial que alguien
// tiene que custodiar — y que se olvida. Ahora el aparato pide permiso, el
// encargado se lo da desde su panel, y aquí se le entrega su sesión.
//
// Cada dispositivo recibe SU PROPIA cuenta. Si compartieran una, revocar un
// aparato echaría a todos los del bar. Con una cada uno, revocar es borrar esa
// cuenta y sus sesiones mueren con ella.
//
// Crear cuentas exige la service_role key, por eso vive aquí y no en una RPC.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const admin = createClient(URL, SERVICE)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// Contraseña larga y aleatoria que NADIE ve: solo sirve para que el servidor
// pueda pedir la sesión del dispositivo y entregársela.
const claveAlAzar = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  try {
    const { secreto } = await req.json()
    if (!secreto || typeof secreto !== 'string') return json({ error: 'falta el secreto' }, 400)

    // El secreto se guarda hasheado, así que la comparación la hace Postgres.
    const { data: filas, error: eBusca } = await admin
      .rpc('dispositivo_por_secreto', { p_secreto: secreto })
    if (eBusca) throw eBusca

    const disp = Array.isArray(filas) ? filas[0] : filas
    if (!disp) return json({ error: 'desconocido' }, 404)
    if (disp.estado === 'revocado') return json({ error: 'revocado' }, 403)
    if (disp.estado !== 'aprobado') return json({ estado: disp.estado }, 202)  // aún pendiente

    // Su cuenta: se crea la primera vez que canjea.
    let email = disp.email as string | null
    const clave = claveAlAzar()

    if (!disp.user_id) {
      email = `dispositivo-${disp.id}@marchando.local`
      const { data: creado, error: eUser } = await admin.auth.admin.createUser({
        email, password: clave, email_confirm: true,
        app_metadata: { local_id: disp.local_id, dispositivo_id: disp.id },
      })
      if (eUser) throw eUser
      const { error: eLink } = await admin.rpc('vincular_dispositivo_usuario', {
        p_id: disp.id, p_user: creado.user.id,
      })
      if (eLink) throw eLink
    } else {
      // Ya tenía cuenta (reinstalación, cambio de navegador): se le rota la
      // contraseña para poder entrar sin conocer la anterior.
      const { error: eUpd } = await admin.auth.admin.updateUserById(disp.user_id as string, { password: clave })
      if (eUpd) throw eUpd
    }

    const { data: sesion, error: eLogin } = await admin.auth.signInWithPassword({ email: email!, password: clave })
    if (eLogin) throw eLogin

    await admin.rpc('dispositivo_visto', { p_id: disp.id })

    return json({
      estado: 'aprobado',
      nombre: disp.nombre,
      session: {
        access_token: sesion.session?.access_token,
        refresh_token: sesion.session?.refresh_token,
      },
    })
  } catch (e) {
    const detalle = (e as { message?: string })?.message ?? JSON.stringify(e)
    console.error('canjear-dispositivo:', detalle, e)
    return json({ error: detalle }, 500)
  }
})
