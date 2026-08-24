import { createHash } from 'node:crypto'

// ────────────────────────────────────────────────────────────────────────────
// Registro de migraciones aplicadas.
//
// Hasta ahora no había ninguno: los scripts re-ejecutaban las 28 migraciones
// confiando en que todas son idempotentes, y no dejaban rastro. Con un bar se
// aguanta; con diez no hay forma de saber en qué esquema está cada uno, y la
// primera migración que no sea idempotente —un backfill, un `alter` sin
// `if not exists`— rompe en silencio.
//
// Se guarda la HUELLA del contenido, no solo el nombre: una migración editada
// después de haberse aplicado es un bar con un esquema que ya no es el que dice
// el repo, y eso hay que verlo.
// ────────────────────────────────────────────────────────────────────────────

export const TABLA = 'schema_migraciones'

export const BOOTSTRAP = `
create table if not exists ${TABLA} (
  fichero     text primary key,
  huella      text not null,
  aplicada_en timestamptz not null default now()
);
alter table ${TABLA} enable row level security;
revoke all on table ${TABLA} from anon, authenticated;`

/** Huella del contenido. Los saltos de línea se normalizan: CRLF vs LF no es un cambio. */
export const huella = (sql) =>
  createHash('sha256').update(String(sql).replace(/\r\n/g, '\n')).digest('hex').slice(0, 16)

/** El número de la migración a partir del nombre del fichero (`…T14_x.sql` → `14`). */
export const numeroDe = (fichero) => (fichero.match(/T(\d+)_/) || [])[1] || null

/**
 * Qué hacer con cada migración, comparando el repo con lo que dice la base.
 *
 *  · `nueva`    → nunca se aplicó aquí
 *  · `aplicada` → está y coincide: no se toca
 *  · `cambiada` → está pero el fichero es otro; el esquema del bar y el repo
 *                 han dejado de decir lo mismo
 */
export function planificar(ficheros, aplicadas) {
  const porFichero = new Map(aplicadas.map(a => [a.fichero, a.huella]))
  return ficheros.map(({ fichero, sql }) => {
    const h = huella(sql)
    const previa = porFichero.get(fichero)
    const estado = previa === undefined ? 'nueva' : previa === h ? 'aplicada' : 'cambiada'
    return { fichero, numero: numeroDe(fichero), huella: h, estado }
  })
}

/** Migraciones que están en la base pero ya no en el repo (alguien las borró). */
export function huerfanas(ficheros, aplicadas) {
  const enRepo = new Set(ficheros.map(f => f.fichero))
  return aplicadas.filter(a => !enRepo.has(a.fichero)).map(a => a.fichero)
}

/** SQL para dejar constancia de una migración aplicada. */
export const registrar = (fichero, h) => `
insert into ${TABLA} (fichero, huella) values (${lit(fichero)}, ${lit(h)})
on conflict (fichero) do update set huella = excluded.huella, aplicada_en = now();`

// Literal SQL seguro: los nombres de fichero los ponemos nosotros, pero esto
// no debe poder inyectar nada aunque algún día vengan de fuera.
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`
