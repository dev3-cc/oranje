import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  cn,
} from '@oranje/ui'
import type { ReactNode } from 'react'

/**
 * Modal de la app, implementado SOBRE el `Dialog` de shadcn/Radix (D-16). La
 * API (`isOpen`/`onClose`/`title`/`footer`) no cambia: ningún consumidor se
 * entera. Radix se encarga de lo que el modal hecho a mano resolvía por su
 * cuenta —Escape, clic fuera, bloqueo de scroll, foco atrapado— y de lo que
 * no: devolver el foco al cerrar.
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
  /**
   * El DialogContent de shadcn se auto-limita a `sm:max-w-lg` (512px). Los
   * modales de la app declaran su ancho con `max-w-*` SIN breakpoint, que en
   * ≥sm perdería contra ese tope: aquí se espeja cada `max-w-*` del caller a
   * su variante `sm:` para que el ancho pedido gane en todos los tamaños.
   */
  const widthOverrides = (className ?? '')
    .split(/\s+/)
    .filter((item) => item.startsWith('max-w-'))
    .map((item) => `sm:${item}`)
    .join(' ')

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        className={cn(
          'max-h-[calc(100vh-3rem)] gap-5 overflow-y-auto',
          'sm:max-w-2xl',
          className,
          widthOverrides,
        )}
        /* Sin descripción, Radix avisa en consola; se apaga el aria explícitamente. */
        {...(description === undefined ? { 'aria-describedby': undefined } : {})}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-ink">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-sm leading-relaxed text-ink-3">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        {children}

        {footer && <DialogFooter className="items-center gap-3">{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  )
}
