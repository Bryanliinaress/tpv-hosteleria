// ────────────────────────────────────────────────────────────────────────────
// Qué hacer en pantalla con la respuesta de `enviar-factura`.
//
// El correo con la factura sale del servidor (Resend). La pantalla solo tiene
// que distinguir tres casos, y equivocarse en cualquiera sale caro:
//
//   · enviado          → decirlo, con a quién;
//   · sin configurar   → NO es un error: el bar aún no ha puesto su correo, y
//                        se ofrece Compartir el PDF como hasta ahora;
//   · error de verdad  → decir cuál, con palabras de barra, sin abrir
//                        Compartir como si nada: el encargado cree que salió.
// ────────────────────────────────────────────────────────────────────────────

const MOTIVOS = {
  factura_rechazada: 'Hacienda rechazó esta factura: corrígela antes de mandarla',
  factura_no_existe: 'Esa factura no es de este local',
  sin_sesion: 'Este aparato no tiene sesión para enviar facturas',
  email_invalido: 'Ese correo no parece válido',
  pdf_invalido: 'No se pudo preparar el PDF de la factura',
}

/**
 * @returns {{ enviado: boolean, alternativa: boolean, error: string|null }}
 */
export function interpretarEnvio(cuerpo, status) {
  const c = cuerpo || {}
  if (status >= 200 && status < 300 && c.ok) return { enviado: true, alternativa: false, error: null }
  if (c.motivo === 'sin_configurar') return { enviado: false, alternativa: true, error: null }
  if (MOTIVOS[c.motivo]) return { enviado: false, alternativa: false, error: MOTIVOS[c.motivo] }
  if (status === 401 || status === 403) return { enviado: false, alternativa: false, error: MOTIVOS.sin_sesion }
  const detalle = c.error ? `: ${c.error}` : ''
  return { enviado: false, alternativa: false, error: `No se pudo enviar el correo${detalle}` }
}
