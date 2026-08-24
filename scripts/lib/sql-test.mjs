import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// ────────────────────────────────────────────────────────────────────────────
// Arnés para probar el SQL de verdad.
//
// Por qué existe: las 2.400 líneas de PL/pgSQL donde vive el dinero
// (`pendiente_de_pago`, `_debe_por_comensal`, `cobrar_mesa`, `pagar_parte`,
// `registrar_pago_online`) no las tocaba ningún test. Se verificaron a mano
// UNA vez. Es la parte del producto que no se puede permitir un fallo.
//
// Cómo funciona sin Docker y sin ensuciar nada: cada prueba se manda como UN
// solo `do $$ … $$`, que Postgres ejecuta en su propia transacción. Al final el
// bloque lanza una excepción a propósito, así que **todo se deshace**: lo que
// escribe la prueba no llega a existir. Si la excepción es la esperada, la
// prueba pasó; cualquier otra es el fallo, con su mensaje.
//
// Se apoya en la Management API igual que el resto de scripts del repo (con
// `curl`/fetch pasa el bloqueo de Cloudflare que sí frena al cliente de Python).
// ────────────────────────────────────────────────────────────────────────────

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

export function entorno() {
  try {
    for (const linea of readFileSync(join(RAIZ, '.env.puente'), 'utf8').split(/\r?\n/)) {
      const m = linea.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch { /* sin fichero: lo que haya en el entorno */ }
  const token = process.env.SUPABASE_ACCESS_TOKEN
  const ref = process.env.PROJECT_REF || 'tesilntyomnovjcuieho'
  return { token, ref }
}

export async function consulta({ token, ref }, query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return { ok: r.ok, body: await r.json().catch(() => null) }
}

// La marca que dice «hasta aquí todo bien, ahora deshazlo todo».
export const FIN = 'PRUEBA_OK'

/**
 * Envuelve el cuerpo de una prueba.
 *
 * Dentro hay dos ayudas:
 *   · `comprobar(condicion, mensaje)` — falla con ese mensaje si no se cumple
 *   · `v_local` — el id del local de pruebas, con la sesión ya simulada
 */
export const envolver = (cuerpo, slug = 'marchando') => `
do $$
declare
  v_local uuid;
  v_mesa uuid;
  v_com uuid;
  v_com2 uuid;
  v_com3 uuid;
  v_prod uuid;
  v_num bigint;
  v_dato numeric;
  v_json jsonb;
  v_fila record;
begin
  select id into v_local from locales where slug = ${sqlLit(slug)};
  if v_local is null then raise exception 'no existe el local de pruebas %', ${sqlLit(slug)}; end if;

  -- El SQL del dinero resuelve el local leyendo el JWT (local_actual), y
  -- aquí no hay sesión de nadie: se simula, y solo dentro de esta transacción.
  perform set_config('request.jwt.claims',
    json_build_object('app_metadata', json_build_object('local_id', v_local))::text, true);

${cuerpo}

  raise exception '${FIN}';
end $$;`

export const sqlLit = (s) => `'${String(s).replace(/'/g, "''")}'`

// Un `%` dentro del mensaje se lo come RAISE como marcador de parámetro («too
// few parameters specified for RAISE»), y en pruebas de IVA los mensajes están
// llenos de porcentajes. Se escapa aquí y no a mano en cada texto.
const escaparPct = (m) => String(m).replace(/%/g, '%%')
const mensajeSql = (m) => sqlLit(escaparPct(m))

/** `comprobar` en PL/pgSQL, para escribir aserciones legibles dentro del cuerpo. */
export const comprobar = (condicion, mensaje) =>
  `  if not (${condicion}) then raise exception ${mensajeSql('FALLO: ' + mensaje)}; end if;`

/** Igual, pero enseñando el valor obtenido cuando falla (que es lo que importa). */
export const comprobarIgual = (expr, esperado, mensaje) =>
  `  if (${expr}) is distinct from (${esperado}) then
    raise exception ${sqlLit(escaparPct('FALLO: ' + mensaje) + ' — esperaba %, obtuve %')}, ${esperado}, (${expr});
  end if;`
