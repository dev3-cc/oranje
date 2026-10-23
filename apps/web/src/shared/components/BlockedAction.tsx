import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@oranje/ui'
import type { ReactNode } from 'react'

/**
 * Un botón deshabilitado dice POR QUÉ (Hugo, 2026-10-23): «ya llené los campos
 * y no me deja enviar» — faltaba el cuadro de tarifas, que estaba más abajo y
 * nadie lo decía. Sin razones, deja el botón tal cual; con razones, lo envuelve
 * en un tooltip con la lista. El `span` es necesario: un botón deshabilitado no
 * dispara eventos de mouse, así que el tooltip se cuelga de su contenedor.
 * Mismo patrón que «Cerrar semana» en Contabilidad.
 */
export function BlockedAction({
  reasons,
  title,
  children,
}: {
  reasons: readonly string[]
  /** Encabezado de la lista, p. ej. «Antes de enviar:». */
  title: string
  children: ReactNode
}): ReactNode {
  if (reasons.length === 0) return children

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex" tabIndex={0}>
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-72">
          <ReasonList reasons={reasons} title={title} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/** La misma lista, visible en rojo junto a los botones: no todos pasan el mouse por encima. */
export function BlockedReasons({
  reasons,
  title,
}: {
  reasons: readonly string[]
  title: string
}): ReactNode {
  if (reasons.length === 0) return null

  return (
    <div role="status" className="text-sm text-red">
      <ReasonList reasons={reasons} title={title} />
    </div>
  )
}

function ReasonList({ reasons, title }: { reasons: readonly string[]; title: string }): ReactNode {
  return (
    <div className="flex flex-col gap-1">
      <p className="font-semibold">{title}</p>
      <ul className="list-disc pl-4">
        {reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </div>
  )
}
