import { cn, MaterialIcon } from '@oranje/ui'
import type { ReactNode } from 'react'

/**
 * Miniatura de hotel para filas de lista: la foto de Places (D-34) recortada
 * a un cuadrado redondeado, o un ícono de respaldo si no hay foto — mismo
 * patrón en toda lista que muestra hoteles (Hugo, 2026-09-15: «en toda lista
 * donde tenga info de hotel debe ir igual foto»). Para el hero de una sola
 * tarjeta grande sigue siendo `HotelPhotoBackdrop`; esta es la versión chica
 * para una fila entre varias.
 */
export function HotelThumbnail({
  photoUrl,
  className = 'size-11',
}: {
  photoUrl: string | null | undefined
  className?: string
}): ReactNode {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt=""
        aria-hidden
        loading="lazy"
        className={cn('shrink-0 rounded-lg object-cover', className)}
      />
    )
  }
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg bg-o-50 text-ink-3',
        className,
      )}
    >
      <MaterialIcon name="apartment" className="text-xl" />
    </span>
  )
}
