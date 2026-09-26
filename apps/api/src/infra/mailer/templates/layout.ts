/**
 * El marco de todo correo que sale de Oranje.
 *
 * Escrito con tablas y estilos en línea a propósito: los clientes de correo
 * no son navegadores — Outlook renderiza con el motor de Word y descarta
 * hojas de estilo, flexbox y grid. Lo que aquí parece anticuado es lo único
 * que llega igual a todas partes.
 *
 * Los colores salen de `packages/ui/tokens.ts` y se copian a mano porque el
 * API no depende del paquete del front; si allá cambian, aquí se actualizan.
 */

/** Tokens de marca. Espejo de `packages/ui/tokens.ts`. */
const COLOR = {
  o50: '#FFF6E8',
  o300: '#FFA64D',
  o500: '#FF8000',
  surface: '#FFFFFF',
  surface2: '#FBFAF8',
  line: '#E3DDD5',
  ink: '#1A1108',
  ink2: '#4A3F35',
  ink3: '#7A6D60',
} as const

export interface LayoutParts {
  /**
   * El personaje que acompaña al correo (CID de `assets.ts`). Opcional: un
   * correo sin ilustración sigue siendo un correo completo.
   */
  illustrationCid?: string
  /** El título grande dentro del correo, no el asunto. */
  heading: string
  /** Lo que se lee en la bandeja antes de abrir: si falta, el cliente inventa. */
  preheader: string
  /** Párrafos del cuerpo, ya en texto plano; el HTML lo pone esta función. */
  paragraphs: string[]
  action?: { label: string; url: string }
  /** Lo chico del final: por qué recibes esto y qué hacer si no era para ti. */
  footnote: string
}

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * El botón va como tabla y no como `<a>` con relleno: en Outlook un enlace
 * con padding pierde el fondo y queda un texto naranja suelto.
 */
function button(label: string, url: string): string {
  return `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0;">
        <tr>
          <td align="center" bgcolor="${COLOR.o300}" style="border-radius:12px;">
            <a href="${escapeHtml(url)}"
               style="display:inline-block;padding:14px 28px;font-family:Montserrat,Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;color:${COLOR.ink};text-decoration:none;border-radius:12px;">
              ${escapeHtml(label)}
            </a>
          </td>
        </tr>
      </table>`
}

export function renderHtml(parts: LayoutParts): string {
  const body = parts.paragraphs
    .map(
      (text) =>
        `      <p style="margin:0 0 16px;font-family:Montserrat,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:${COLOR.ink2};">${escapeHtml(text)}</p>`,
    )
    .join('\n')

  /* El personaje centrado, antes del título: es acompañamiento, no contenido —
     por eso lleva alt vacío y los lectores de pantalla lo saltan. */
  const illustration = parts.illustrationCid
    ? `              <img src="cid:${parts.illustrationCid}" width="160" alt="" style="display:block;margin:0 auto 24px;width:160px;height:auto;border:0;">\n`
    : ''

  /* El enlace también va escrito completo debajo del botón: hay clientes que
     no pintan botones, y hay gente que desconfía de ellos con razón. */
  const fallbackLink = parts.action
    ? `      <p style="margin:0 0 8px;font-family:Montserrat,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:${COLOR.ink3};">Si el botón no funciona, copia esta dirección en tu navegador:</p>
      <p style="margin:0 0 24px;font-family:Montserrat,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;word-break:break-all;"><a href="${escapeHtml(parts.action.url)}" style="color:${COLOR.o500};">${escapeHtml(parts.action.url)}</a></p>`
    : ''

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(parts.heading)}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLOR.surface2};">
  <!-- El preheader: se lee en la bandeja y no se ve al abrir. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(parts.preheader)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLOR.surface2};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:${COLOR.surface};border:1px solid ${COLOR.line};border-radius:18px;overflow:hidden;">
          <tr>
            <td align="center" style="background-color:${COLOR.o500};padding:22px 32px;">
              <!-- El logo va adjunto por CID: las imágenes remotas se bloquean, las adjuntas no. -->
              <img src="cid:oranje-logo" width="140" alt="Oranje" style="display:block;width:140px;height:auto;border:0;">
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
${illustration}              <h1 style="margin:0 0 20px;font-family:Montserrat,Helvetica,Arial,sans-serif;font-size:22px;line-height:1.3;color:${COLOR.ink};">${escapeHtml(parts.heading)}</h1>
${body}
${parts.action ? button(parts.action.label, parts.action.url) : ''}
${fallbackLink}
            </td>
          </tr>
          <tr>
            <td style="background-color:${COLOR.o50};padding:20px 32px;">
              <p style="margin:0;font-family:Montserrat,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:${COLOR.ink3};">${escapeHtml(parts.footnote)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/**
 * La versión en texto. No es un lujo: un correo sin `text/plain` puntúa peor
 * en los filtros de spam, y hay quien lee el correo sin HTML.
 */
export function renderText(parts: LayoutParts): string {
  const lines = [parts.heading, '', ...parts.paragraphs]

  if (parts.action) lines.push('', `${parts.action.label}: ${parts.action.url}`)

  lines.push('', '—', parts.footnote)

  return lines.join('\n')
}
