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
  /**
   * `false` para diálogos con terceros que portan al `<body>` fuera del
   * control de Radix (Google Places, y cualquier cosa parecida) — un Select
   * normal ya se cubre con la lista de abajo, pero un widget de un tercero
   * puede dejar nodos o eventos que Radix no sabe atribuir de vuelta al
   * diálogo, y cada uno es un caso nuevo por perseguir. Mientras exista uno
   * de esos en el contenido, el diálogo solo se cierra por Escape o por un
   * botón explícito — nunca por clic o foco "afuera". Por defecto `true`
   * (el comportamiento de Radix, con la excepción de portales conocidos).
   */
  dismissOnOutsideInteraction?: boolean
}

/**
 * Un Select/Popover/Dropdown de Radix dentro del diálogo se porta a
 * `document.body`, FUERA del árbol de `DialogContent` — Radix lo trata como
 * «clic afuera» y cierra el modal completo al elegir una opción (reportado
 * con el selector de Zona del alta de prospecto). Mismo caso que Google
 * Places, generalizado a los tres portales que ya usa la app.
 */
function keepPortaledInteraction(
  dismissOnOutsideInteraction: boolean,
): (event: { target: EventTarget | null; preventDefault: () => void }) => void {
  return (event) => {
    if (!dismissOnOutsideInteraction) {
      event.preventDefault()
      return
    }
    const target = event.target as Element | null
    if (
      target?.closest(
        '.pac-container, [data-slot="select-content"], [data-slot="popover-content"], [data-slot="dropdown-menu-content"]',
      )
    ) {
      event.preventDefault()
    }
  }
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
  dismissOnOutsideInteraction = true,
}: ModalProps): ReactNode {
  const onInteract = keepPortaledInteraction(dismissOnOutsideInteraction)
  /**
   * El DialogContent de shadcn se auto-limita a `sm:max-w-lg` (512px). Los
   * modales de la app declaran su ancho con `max-w-*` SIN breakpoint, que en
   * ≥sm perdería contra ese tope: aquí se espeja cada `max-w-*` del caller a
   * su variante `sm:` para que el ancho pedido gane en todos los tamaños.
   *
   * Y el `max-w-*` pelón se RETIRA del className: si se dejara, twMerge lo
   * haría ganar sobre el `max-w-[calc(100%-2rem)]` base y en un teléfono el
   * modal saldría de 48rem en una pantalla de 390 px, cortado por la derecha
   * (Hugo, 2026-09-21: «las tablas no se ven bien en móvil» era esto, en la
   * auditoría y en cualquier modal ancho). Bajo `sm` manda siempre el ancho
   * de la pantalla.
   *
   * `sm:${item}` armado en tiempo de ejecución NUNCA llega a Tailwind: el
   * build solo escanea TEXTO en busca de nombres de clase completos, así que
   * una cadena que solo existe como concatenación en el navegador no genera
   * CSS — la clase queda en el DOM sin efecto, en silencio (descubierto el
   * 2026-09-22 con Playwright: el ancho pedido nunca se aplicaba pese a que
   * la clase «correcta» aparecía en el elemento). El mapa de abajo escribe
   * cada `sm:max-w-*` como texto literal a propósito: son los únicos anchos
   * que un modal puede pedir — uno nuevo se agrega aquí, nunca se sintetiza.
   */
  const WIDTH_VARIANTS: Record<string, string> = {
    'max-w-lg': 'sm:max-w-lg',
    'max-w-xl': 'sm:max-w-xl',
    'max-w-2xl': 'sm:max-w-2xl',
    'max-w-3xl': 'sm:max-w-3xl',
    'max-w-4xl': 'sm:max-w-4xl',
    'max-w-5xl': 'sm:max-w-5xl',
    'max-w-[95rem]': 'sm:max-w-[95rem]',
  }
  const classes = (className ?? '').split(/\s+/).filter(Boolean)
  const widthOverrides = classes
    .filter((item) => item.startsWith('max-w-'))
    .map((item) => WIDTH_VARIANTS[item] ?? item)
    .join(' ')
  const classNameSinAncho = classes.filter((item) => !item.startsWith('max-w-')).join(' ')

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
            classNameSinAncho,
            widthOverrides,
          )}
          aria-describedby={undefined}
          onInteractOutside={onInteract}
          onPointerDownOutside={onInteract}
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
          classNameSinAncho,
          widthOverrides,
        )}
        onInteractOutside={onInteract}
        onPointerDownOutside={onInteract}
        /* Sin descripción, Radix avisa en consola; se apaga el aria explícitamente. */
        {...(description === undefined ? { 'aria-describedby': undefined } : {})}
      >
        {/* DialogContent es un grid y sus hijos nacen con min-width:auto, así
            que una fila que no cabe (los tres botones de un reactivo, un título
            largo) ensanchaba el contenido más allá del modal y se cortaba por la
            derecha en el teléfono. `min-w-0` deja que envuelvan. */}
        <DialogHeader className="min-w-0">
          <DialogTitle className="text-xl font-bold text-ink">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-sm leading-relaxed text-ink-3">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="flex min-w-0 flex-col gap-5">{children}</div>

        {footer && (
          <DialogFooter className="min-w-0 flex-wrap items-center gap-3">{footer}</DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
