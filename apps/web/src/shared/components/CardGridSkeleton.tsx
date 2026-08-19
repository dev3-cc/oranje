import { Skeleton, cn } from '@oranje/ui'
import type { ReactNode } from 'react'

/**
 * Esqueleto de rejilla de tarjetas: la forma de la cartera de clientes, el
 * dashboard y toda vista que pinta tarjetas en columnas.
 */
export function CardGridSkeleton({
  cards = 4,
  className = 'grid-cols-1 xl:grid-cols-2',
}: {
  cards?: number
  className?: string
}): ReactNode {
  return (
    <div aria-hidden className={cn('grid items-start gap-6', className)}>
      {Array.from({ length: cards }, (_, card) => (
        <div
          key={card}
          className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-6"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/6" />
          <Skeleton className="h-4 w-3/6" />
        </div>
      ))}
    </div>
  )
}
