import { cn } from '@oranje/ui'
import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Modal centrado con backdrop. No usa `<dialog>` nativo: su `::backdrop` no
 * acepta los tokens y el comportamiento de cierre varía entre navegadores.
 *
 * Se encarga de lo que un modal tiene que hacer para no ser una trampa:
 * cerrar con Escape, cerrar al hacer clic fuera, bloquear el scroll del fondo
 * y llevarse el foco al abrir.
 */
export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  className?: string
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: ModalProps): ReactNode {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return undefined

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      {/* Backdrop tintado con --ink, no negro puro: coherente con las sombras */}
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/45"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className={cn(
          'relative z-10 flex max-h-full w-full max-w-2xl flex-col gap-5 overflow-y-auto',
          'rounded-lg bg-surface p-7 shadow-lg outline-none',
          className,
        )}
      >
        <header className="flex flex-col gap-2">
          <h2 id="modal-title" className="text-xl font-bold text-ink">
            {title}
          </h2>
          {description && <p className="text-sm leading-relaxed text-ink-3">{description}</p>}
        </header>

        {children}

        {footer && <footer className="flex items-center justify-end gap-3">{footer}</footer>}
      </div>
    </div>
  )
}
