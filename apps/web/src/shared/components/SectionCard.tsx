import { cn } from '@oranje/ui'
import type { ReactNode } from 'react'

/**
 * Tarjeta con título que agrupa cada bloque del detalle del prospecto.
 *
 * `action` va en la misma línea del título: es donde el usuario espera el botón
 * que actúa sobre ESTA tarjeta —el lápiz de editar, por ejemplo— y no perdido
 * al final del contenido.
 */
export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}): ReactNode {
  return (
    <section className={cn('rounded-lg border border-line bg-surface p-6', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          {subtitle && <p className="mt-1 text-xs text-ink-3">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}
