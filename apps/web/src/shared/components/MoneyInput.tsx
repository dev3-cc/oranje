import { cn } from '@oranje/ui'
import type { ComponentProps, ReactNode } from 'react'

const CONTROL_CLASS =
  'w-full rounded-md border border-line bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-4 focus:border-o-500 focus:outline-none'

/**
 * Campo de tarifa con el `$` delante. Se separa el símbolo del control porque
 * `type="number"` no admite texto dentro, y con `type="text"` se perdería el
 * teclado numérico del móvil y la validación del navegador.
 */
export function MoneyInput({ id, className, ...props }: ComponentProps<'input'>): ReactNode {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-sm text-ink-3">
        $
      </span>
      <input
        id={id}
        type="number"
        step="0.01"
        min="0"
        {...props}
        className={cn(CONTROL_CLASS, 'pl-8', className)}
      />
    </div>
  )
}
