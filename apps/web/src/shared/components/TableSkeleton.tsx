import { Skeleton } from '@oranje/ui'
import type { ReactNode } from 'react'

/**
 * Esqueleto de tabla: encabezado + filas con la primera columna más ancha,
 * como toda tabla del sistema (folio o nombre primero). Sustituye a los
 * «Cargando…» de texto en las vistas de lista.
 *
 * UNA sola señal de carga (skill): el skeleton previsualiza la estructura y
 * su pulso ya dice «vivo» — la animación de datos (DataLoader) es para las
 * cargas SIN estructura que anticipar, nunca encimada aquí.
 */
export function TableSkeleton({
  rows = 6,
  columns = 5,
}: {
  rows?: number
  columns?: number
}): ReactNode {
  return (
    <div aria-hidden className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <div className="flex gap-4">
        {Array.from({ length: columns }, (_, column) => (
          <Skeleton key={column} className={column === 0 ? 'h-4 w-40' : 'h-4 w-24'} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex items-center gap-4 border-t border-line pt-3">
          {Array.from({ length: columns }, (_, column) => (
            <Skeleton key={column} className={column === 0 ? 'h-5 w-40' : 'h-5 w-24'} />
          ))}
        </div>
      ))}
    </div>
  )
}
