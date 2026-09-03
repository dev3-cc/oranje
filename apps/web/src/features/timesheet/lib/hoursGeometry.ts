/**
 * Geometría de la vista Horas: el lienzo va de 06:00 a 22:00 y cada hora mide
 * `HOUR_PX`. Lo que caiga fuera se RECORTA al borde en vez de desbordar la
 * tarjeta; una jornada completamente fuera no se dibuja.
 */

export const HOURS_START = 6
export const HOURS_END = 22
export const HOUR_PX = 44
export const GRID_HEIGHT = (HOURS_END - HOURS_START) * HOUR_PX

/** `07:30` → 450. `null` si no es `HH:mm`. */
export function minutesOf(hhmm: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

/**
 * Posición del bloque de una jornada. Una salida después del fin del lienzo —o
 * al día siguiente, cuando `end <= start`— pinta hasta el fondo; la altura
 * mínima garantiza que hasta una jornada de minutos se pueda picar.
 */
export function blockRect(start: string, end: string): { top: number; height: number } | null {
  const startMin = minutesOf(start)
  const endMin = minutesOf(end)
  if (startMin === null || endMin === null) return null

  const floor = HOURS_START * 60
  const ceiling = HOURS_END * 60
  const from = Math.max(startMin, floor)
  const to = Math.min(endMin <= startMin ? ceiling : endMin, ceiling)
  if (to <= from) return null

  return {
    top: ((from - floor) / 60) * HOUR_PX,
    height: Math.max(((to - from) / 60) * HOUR_PX, 22),
  }
}

/** Offset de la línea de «ahora»; `null` si la hora cae fuera del lienzo. */
export function nowOffset(minutes: number): number | null {
  const floor = HOURS_START * 60
  const ceiling = HOURS_END * 60
  if (minutes < floor || minutes > ceiling) return null
  return ((minutes - floor) / 60) * HOUR_PX
}
