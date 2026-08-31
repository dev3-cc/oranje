import { Skeleton } from '@oranje/ui'
import type { ReactNode } from 'react'

/**
 * Los esqueletos del apartado del Colaborador, con la silueta de cada
 * pantalla: la persona ve la forma de lo que viene, no una naranja girando
 * (una sola señal de carga, como pide la skill de UX).
 */
export function WorkerSkeleton({
  variant,
}: {
  variant: 'home' | 'punch' | 'profile' | 'list'
}): ReactNode {
  if (variant === 'home') {
    return (
      <div className="flex flex-col gap-5" aria-busy aria-label="Cargando">
        <Skeleton className="-mx-5 -mt-5 h-80 rounded-none rounded-b-[28px]" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    )
  }
  if (variant === 'punch') {
    return (
      <div className="flex flex-col items-center gap-6" aria-busy aria-label="Cargando">
        <div className="flex w-full flex-col gap-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-12 w-44" />
        <Skeleton className="size-36 rounded-full" />
        <Skeleton className="h-36 w-full rounded-xl" />
      </div>
    )
  }
  if (variant === 'profile') {
    return (
      <div className="flex flex-col gap-5" aria-busy aria-label="Cargando">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="size-24 rounded-full" />
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-52" />
        </div>
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-52 rounded-xl" />
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2" aria-busy aria-label="Cargando">
      {[0, 1, 2, 3].map((row) => (
        <Skeleton key={row} className="h-16 rounded-lg" />
      ))}
    </div>
  )
}
