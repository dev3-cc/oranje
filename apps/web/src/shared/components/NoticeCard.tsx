import { cn } from '@oranje/ui'
import type { ReactNode } from 'react'

/**
 * Un aviso que pide algo (o cuenta algo) con una de las ilustraciones de la
 * marca a la izquierda, chica como un icono grande: la skill de UX limita
 * a 1–2 piezas animadas o ilustradas por vista, así que aquí la ilustración
 * acompaña, no protagoniza. `tone` decide el marco: `action` (naranja
 * punteado, hay algo que hacer), `warning` (amarillo, urge) y `info`.
 */
export function NoticeCard({
  image,
  title,
  children,
  action,
  tone = 'info',
  role,
}: {
  image: string
  title: string
  children: ReactNode
  action?: ReactNode
  tone?: 'action' | 'warning' | 'info'
  role?: 'alert' | 'status'
}): ReactNode {
  return (
    <section
      role={role}
      className={cn(
        'flex gap-4 rounded-xl p-4',
        tone === 'action' && 'border border-dashed border-o-500/60 bg-o-50',
        tone === 'warning' && 'border border-yellow bg-yellow/15',
        tone === 'info' && 'bg-surface-2',
      )}
    >
      <img src={image} alt="" aria-hidden className="h-20 w-auto shrink-0 self-center" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">{children}</p>
        {action !== undefined && <div className="mt-3">{action}</div>}
      </div>
    </section>
  )
}
