/**
 * El QR impreso en el acceso del hotel no lleva el código pelón: lleva una
 * liga a la pantalla de Ponchar con el código adentro. Así el mismo cuadro
 * sirve para dos cosas — con la cámara del teléfono abre la app en Ponchar
 * (pasando por el login si hace falta), y dentro del lector de la app sigue
 * siendo el código que valida el servidor. El API no cambia: recibe el
 * código, no la liga.
 */
const PUNCH_PATH = '/colaborador/ponchar'
const QR_PARAM = 'qr'

export function buildPunchQrLink(payload: string, origin = window.location.origin): string {
  return `${origin}${PUNCH_PATH}?${QR_PARAM}=${encodeURIComponent(payload)}`
}

/** Lo que leyó el lector puede ser la liga nueva o un código de una hoja vieja. */
export function readPunchQrCode(scanned: string): string {
  try {
    const url = new URL(scanned)
    const code = url.searchParams.get(QR_PARAM)
    if (code) return code
  } catch {
    /* no era una URL: es el código tal cual */
  }
  return scanned
}

export const PUNCH_QR_PARAM = QR_PARAM
