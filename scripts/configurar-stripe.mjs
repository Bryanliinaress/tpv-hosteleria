// ────────────────────────────────────────────────────────────────────────────
// Deja el cobro con tarjeta listo en el proyecto de un local.
//
//   node scripts/configurar-stripe.mjs casa-loli
//
// Hace tres cosas: guarda las claves como SECRETOS del proyecto, despliega el
// webhook (que es quien confirma el cobro) y comprueba que quedó activo.
//
// Las claves se teclean aquí y se pasan directas a Supabase: no se escriben en
// ningún fichero, no se enseñan por pantalla y no quedan en el historial del
// terminal. La `sk_` de Stripe permite mover dinero de tu cuenta: no la pegues
// en un chat ni en un correo, ni la subas al repo.
// ────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const slug = process.argv[2]

if (!slug) {
  console.error('Uso: node scripts/configurar-stripe.mjs <slug-del-local>')
  console.error('Ejemplo: node scripts/configurar-stripe.mjs casa-loli')
  process.exit(1)
}

let perfil
try {
  perfil = JSON.parse(readFileSync(join(RAIZ, 'locales', slug, 'perfil.json'), 'utf8'))
} catch {
  console.error(`No encuentro locales/${slug}/perfil.json`)
  process.exit(1)
}

const ref = perfil.supabase?.ref
if (!ref) {
  console.error(`El perfil de ${slug} no tiene supabase.ref`)
  process.exit(1)
}
if (perfil.modulos?.pagosOnline !== true) {
  console.error(`⚠️  ${slug} tiene el pago online APAGADO en su perfil.`)
  console.error('   Pon "pagosOnline": true en modulos y vuelve a intentarlo.')
  process.exit(1)
}

const rl = createInterface({ input: process.stdin, output: process.stdout })
const preguntar = (t) => new Promise(r => rl.question(t, (v) => r(v.trim())))

// Lee sin mostrar lo tecleado (para las claves)
const preguntarOculto = (t) => new Promise((resolve) => {
  process.stdout.write(t)
  const stdin = process.stdin
  const eraRaw = stdin.isRaw
  if (stdin.setRawMode) stdin.setRawMode(true)
  let valor = ''
  const alPulsar = (buf) => {
    const ch = buf.toString('utf8')
    if (ch === '\r' || ch === '\n') {
      stdin.removeListener('data', alPulsar)
      if (stdin.setRawMode) stdin.setRawMode(eraRaw)
      process.stdout.write('\n')
      resolve(valor.trim())
    } else if (ch === '') {           // Ctrl+C
      process.exit(1)
    } else if (ch === '' || ch === '\b') {
      valor = valor.slice(0, -1)
    } else {
      valor += ch
    }
  }
  stdin.on('data', alPulsar)
})

const correr = (args, env) => new Promise((resolve, reject) => {
  const p = spawn('npx', ['--yes', 'supabase@latest', ...args], {
    env: { ...process.env, ...env }, shell: true,
  })
  let salida = ''
  p.stdout.on('data', d => { salida += d; process.stdout.write(d) })
  p.stderr.on('data', d => { salida += d })
  p.on('error', reject)
  p.on('close', (code) => code === 0 ? resolve(salida) : reject(new Error(salida.slice(-500))))
})

console.log(`\nCobro con tarjeta para «${perfil.marca?.nombre || slug}» (proyecto ${ref})\n`)
console.log('Necesitas, del panel de Stripe:')
console.log('  · la clave secreta      → https://dashboard.stripe.com/apikeys        (sk_…)')
console.log('  · el secreto del webhook → https://dashboard.stripe.com/webhooks       (whsec_…)')
console.log('\nPara el webhook, crea un endpoint con el evento «checkout.session.completed» apuntando a:')
console.log(`  https://${ref}.supabase.co/functions/v1/stripe-webhook\n`)

const token = await preguntarOculto('Token de Supabase (sbp_…, no se guarda): ')
if (!token.startsWith('sbp_')) { console.error('Ese token no parece de Supabase'); process.exit(1) }

const sk = await preguntarOculto('Clave secreta de Stripe (sk_…): ')
if (!/^sk_(test|live)_/.test(sk)) { console.error('La clave debe empezar por sk_test_ o sk_live_'); process.exit(1) }
if (sk.startsWith('sk_live_')) console.log('⚠️  Es una clave de PRODUCCIÓN: los cobros serán reales.')

const whsec = await preguntarOculto('Secreto del webhook (whsec_…): ')
if (!whsec.startsWith('whsec_')) { console.error('El secreto debe empezar por whsec_'); process.exit(1) }
rl.close()

const env = { SUPABASE_ACCESS_TOKEN: token }

try {
  console.log('\n1/3 · Guardando las claves como secretos del proyecto…')
  await correr(['secrets', 'set', `STRIPE_SECRET_KEY=${sk}`, `STRIPE_WEBHOOK_SECRET=${whsec}`, '--project-ref', ref], env)

  console.log('\n2/3 · Desplegando el webhook (sin exigir sesión: lo llama Stripe, no un usuario)…')
  await correr(['functions', 'deploy', 'stripe-webhook', '--project-ref', ref, '--no-verify-jwt'], env)

  console.log('\n3/3 · Comprobando…')
  const lista = await correr(['functions', 'list', '--project-ref', ref], env)
  const ok = /stripe-webhook/.test(lista) && /crear-checkout/.test(lista)

  console.log(ok
    ? '\n✅ Listo. El cliente ya puede pagar con tarjeta y el webhook confirma el cobro.'
    : '\n⚠️  Revisa la lista de arriba: falta alguna función por desplegar.')
  console.log('\nPruébalo con una tarjeta de test (4242 4242 4242 4242) antes de cobrar de verdad.')
} catch (e) {
  console.error('\n❌ No se pudo terminar:', e.message)
  process.exit(1)
}
