// ────────────────────────────────────────────────────────────────────────────
// Herramienta de locales: ver los que hay y compilarlos.
//
//   npm run locales                    → lista los locales dados de alta
//   npm run locales build bar-manolo   → compila SOLO ese bar
//   npm run locales build --todos      → compila todos (lo que hace el deploy)
//
// Funciona igual en PowerShell y en bash: no hace falta `LOCAL=x npm run build`,
// aunque esa forma también vale en bash/CI.
// ────────────────────────────────────────────────────────────────────────────
import { spawnSync } from 'node:child_process'
import { listarLocales, cargarPerfil, RAIZ } from './lib/perfiles.mjs'

const [cmd, ...args] = process.argv.slice(2)

function listar() {
  const slugs = listarLocales()
  if (!slugs.length) {
    console.log('No hay ningún local todavía. Copia locales/_plantilla/ a locales/<slug>/.')
    return
  }
  console.log(`${slugs.length} local(es):\n`)
  for (const slug of slugs) {
    const p = cargarPerfil(slug)
    const donde = p.publicado ? (p.despliegue.url || '(sin dominio)') : '— fuera del deploy —'
    console.log(`  ${slug.padEnd(18)} ${p.marca.nombre.padEnd(22)} ${donde}`)
    console.log(`  ${''.padEnd(18)} supabase: ${p.supabase.ref || '—'} · backend ${p.backend}` +
      `${p.fiscal ? ` · ${p.fiscal}` : ''} → ${p.despliegue.salida}\n`)
  }
}

function compilar(slug) {
  const p = cargarPerfil(slug)
  console.log(`\n▶ ${p.marca.nombre} (${slug}) → ${p.despliegue.salida}`)
  const r = spawnSync('npm', ['run', 'build', '--', '--outDir', p.despliegue.salida, '--emptyOutDir'], {
    cwd: RAIZ,
    stdio: 'inherit',
    shell: process.platform === 'win32',   // en Windows npm es un .cmd
    env: { ...process.env, LOCAL: slug },
  })
  if (r.status !== 0) {
    console.error(`✖ falló el build de ${slug}`)
    process.exit(r.status || 1)
  }
}

if (!cmd || cmd === 'list') {
  listar()
} else if (cmd === 'build') {
  // `--todos` = los PUBLICADOS (lo que compila el deploy). Nombrar un local a
  // mano lo compila igual, aunque no esté publicado: así se puede levantar en
  // local uno que no queremos colgado en internet.
  let slugs = args.includes('--todos')
    ? listarLocales().filter(s => cargarPerfil(s).publicado)
    : args.filter(a => !a.startsWith('-'))
  if (!slugs.length) { console.error('Uso: npm run locales build <slug> | --todos'); process.exit(1) }
  // Los builds anidados (dist/app) van DESPUÉS del que los contiene (dist),
  // porque cada build vacía su carpeta de salida.
  slugs = slugs.sort((a, b) =>
    cargarPerfil(a).despliegue.salida.split('/').length - cargarPerfil(b).despliegue.salida.split('/').length)
  slugs.forEach(compilar)
  console.log(`\n✔ ${slugs.length} local(es) compilados: ${slugs.join(', ')}`)
} else {
  console.error(`Comando desconocido: ${cmd}\nUso: npm run locales [list|build <slug>|build --todos]`)
  process.exit(1)
}
