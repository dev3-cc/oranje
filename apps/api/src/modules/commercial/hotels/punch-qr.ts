import { randomBytes } from 'node:crypto'

/**
 * Lo que va DENTRO del QR impreso del hotel. Lleva el id del hotel y su secreto
 * vigente: al ponchar, el servidor compara los dos contra el hotel de la
 * asignación. El prefijo con versión de formato permite cambiar el esquema del
 * código sin que los impresos viejos se lean como basura indistinguible.
 */
const PREFIX = 'oranje:punch:1:'

export const PUNCH_METHODS = ['SELFIE', 'QR'] as const
export type PunchMethod = (typeof PUNCH_METHODS)[number]

export function newPunchQrSecret(): string {
  return randomBytes(24).toString('base64url')
}

export function buildPunchQrPayload(hotelId: string, secret: string): string {
  return `${PREFIX}${hotelId}:${secret}`
}

/** `null` si el código no tiene la forma de un QR de ponche de Oranje. */
export function parsePunchQrPayload(code: string): { hotelId: string; secret: string } | null {
  if (!code.startsWith(PREFIX)) return null
  const rest = code.slice(PREFIX.length)
  const separator = rest.indexOf(':')
  if (separator <= 0) return null
  const hotelId = rest.slice(0, separator)
  const secret = rest.slice(separator + 1)
  return hotelId && secret ? { hotelId, secret } : null
}
