import { cn, statusLight, type StatusLightToken } from '@oranje/ui'
import type { ReactNode } from 'react'

/** 15 % de opacidad en hexadecimal: el color del semáforo, apenas insinuado. */
const TINT_ALPHA = '26'

/**
 * Variante suave del chip de semáforo: fondo teñido y punto de color, frente al
 * relleno sólido de `SemaforoBadge`. Se usa donde hay varios chips a la vez y
 * el relleno lleno competiría con el contenido.
 *
 * Recibe token y etiqueta —la misma API que `SemaforoBadge`— y no un estado
 * concreto: sirve a los siete semáforos, y el nombre del estado lo pone quien
 * lo usa, porque un mismo color significa cosas distintas en cada uno.
 *
 * ⚠ El texto va en `--ink-2` y NO en el color del estado, aunque las maquetas
 * lo pinten de color: `--st-azul-claro` sobre blanco da 2.1:1 y el amarillo es
 * peor. El color sigue en el punto y el fondo, que es señal redundante y no la
 * única portadora del significado.
 *
 * ⚠ Su sitio natural es `packages/ui`, al lado de `SemaforoBadge`. Está aquí
 * porque ese paquete está fuera del alcance acordado.
 */
/**
 * El blanco teñido al 15% sobre un fondo blanco no se ve: ese chip se dibuja
 * con borde. Sin esto, «Blanco» quedaría como texto suelto y parecería que le
 * falta el estado.
 */
const OUTLINED_TOKENS: readonly StatusLightToken[] = ['st-blanco']

export function SemaforoSoftBadge({
  token,
  label,
}: {
  token: StatusLightToken
  label: string
}): ReactNode {
  const color = statusLight[token]
  const isOutlined = OUTLINED_TOKENS.includes(token)

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap text-ink-2',
        isOutlined && 'border border-line',
      )}
      style={{ backgroundColor: `${color}${TINT_ALPHA}` }}
    >
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {label}
    </span>
  )
}
