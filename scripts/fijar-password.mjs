// Fija la contraseña del usuario admin DIRECTAMENTE (sin enlaces de email,
// que redirigen al Site URL y fallan si no hay app desplegada todavía).
//
// Ejecútalo TÚ en tu terminal (la contraseña no sale de tu máquina):
//
//   $env:SUPABASE_ACCESS_TOKEN="sbp_xxx"
//   $env:ADMIN_EMAIL="tu@email.com"
//   $env:NUEVA_PASSWORD="tu-contraseña-fuerte"
//   node scripts/fijar-password.mjs
//
const REF = process.env.PROJECT_REF || 'tesilntyomnovjcuieho'
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const EMAIL = process.env.ADMIN_EMAIL
const PASS = process.env.NUEVA_PASSWORD
if (!TOKEN || !EMAIL || !PASS) {
  console.error('Faltan variables: SUPABASE_ACCESS_TOKEN, ADMIN_EMAIL y NUEVA_PASSWORD')
  process.exit(1)
}
if (PASS.length < 8) { console.error('La contraseña debe tener al menos 8 caracteres'); process.exit(1) }

// service_role key vía Management API
const keys = await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys`, {
  headers: { Authorization: `Bearer ${TOKEN}` },
}).then(r => r.json())
const service = keys.find?.(k => k.name === 'service_role')?.api_key
if (!service) { console.error('No pude obtener la service_role key:', JSON.stringify(keys).slice(0, 200)); process.exit(1) }

const authApi = `https://${REF}.supabase.co/auth/v1`
const hdr = { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' }

const lista = await fetch(`${authApi}/admin/users?page=1&per_page=50`, { headers: hdr }).then(r => r.json())
const user = (lista.users || []).find(u => u.email === EMAIL)
if (!user) { console.error(`No existe el usuario ${EMAIL} — ejecuta antes provisionar-produccion.mjs`); process.exit(1) }

const res = await fetch(`${authApi}/admin/users/${user.id}`, {
  method: 'PUT', headers: hdr,
  body: JSON.stringify({ password: PASS, email_confirm: true }),
}).then(r => r.json())
if (res.id) {
  console.log(`✔ Contraseña fijada para ${EMAIL}`)
  // comprobación real: login con la nueva contraseña usando la anon key NO sirve
  // aquí (no la tenemos); probamos con la propia service apikey como gateway
  const login = await fetch(`${authApi}/token?grant_type=password`, {
    method: 'POST', headers: hdr,
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  }).then(r => r.json())
  if (login.access_token) {
    const meta = JSON.parse(Buffer.from(login.access_token.split('.')[1], 'base64').toString())
    console.log(`✔ Login verificado — JWT lleva local_id: ${meta.app_metadata?.local_id || '⚠ FALTA'}`)
  } else {
    console.log('⚠ La contraseña se fijó pero el login de prueba falló:', JSON.stringify(login).slice(0, 200))
  }
} else {
  console.error('Error:', JSON.stringify(res).slice(0, 300))
}
