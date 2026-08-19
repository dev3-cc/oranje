import { Skeleton } from '@oranje/ui'
import type { ReactNode } from 'react'

/**
 * Esqueleto de ficha: título + metadatos + dos tarjetas de contenido. La
 * forma genérica de todo detalle del sistema (prospecto, requisición,
 * contrato, propuesta).
 */
export function DetailSkeleton(): ReactNode {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-72" />
        <div className="flex gap-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-20" />
        </div>
      </div>
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        {[0, 1].map((card) => (
          <div
            key={card}
            className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-6"
          >
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
            <Skeleton className="h-4 w-3/6" />
          </div>
        ))}
      </div>
    </div>
  )
}
