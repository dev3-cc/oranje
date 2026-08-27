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
  /**
   * Sin marco: ni encabezado ni padding — los hijos son dueños de todo el
   * lienzo (mapas, heros). El título queda solo para lectores de pantalla,
   * que Radix lo exige y con razón.
   */
  chromeless?: boolean
}

/**
 * Elegir una sugerencia de Google Places no debe cerrar el diálogo: el
 * desplegable vive fuera del contenido y Radix lo trata como «clic afuera».
 */
function keepPlacesInteraction(event: {
  target: EventTarget | null
  preventDefault: () => void
}): void {
  const target = event.target as Element | null
  if (target?.closest('.pac-container')) event.preventDefault()
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  chromeless = false,
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

  if (chromeless) {
    return (
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) onClose()
        }}
      >
        <DialogContent
          className={cn(
            'w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] overflow-hidden p-0',
            'sm:max-w-2xl',
            className,
            widthOverrides,
          )}
          aria-describedby={undefined}
          onInteractOutside={keepPlacesInteraction}
          onPointerDownOutside={keepPlacesInteraction}
        >
          <DialogTitle className="sr-only">{title}</DialogTitle>
          {children}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        className={cn(
          'w-[calc(100%-2rem)] max-w-[calc(100%-2rem)] max-h-[calc(100dvh-3rem)] gap-5 overflow-x-hidden overflow-y-auto',
          'sm:max-w-2xl',
          className,
          widthOverrides,
        )}
        onInteractOutside={keepPlacesInteraction}
        onPointerDownOutside={keepPlacesInteraction}
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
