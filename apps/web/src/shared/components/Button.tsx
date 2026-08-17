import { cn } from '@oranje/ui'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

/**
 * Botón base. Sube a `shared/` porque lo usan Pipeline, el detalle y el modal
 * (§4: lo que necesitan dos features no vive en una de ellas).
 *
 * ⚠ CONFLICTO PENDIENTE DE RESOLVER — texto blanco sobre naranja.
 *
 * `variant="primary"` usa blanco sobre `--o-500` porque así está en el diseño.
 * Pero `packages/ui/tokens.ts` mide ese par en 2.5:1 y deja escrita la regla de
 * NUNCA usar blanco sobre naranja: reprueba WCAG AA, que pide 4.5:1. Con
 * `--ink` daría 7.4:1.
 *
 * Se implementó como está en la captura para no alterar el diseño por cuenta
 * propia. Cambiar `text-white` por `text-ink` aquí lo corrige en toda la app.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'yellow'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  children: ReactNode
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-o-500 text-white hover:bg-o-700 focus-visible:outline-o-700',
  secondary:
    'border border-line bg-surface text-ink hover:bg-surface-2 focus-visible:outline-o-500',
  /**
   * Texto en `--ink`, NUNCA blanco: `tokens.ts` mide amarillo con blanco en
   * 1.4:1, que es ilegible. Con `--ink` sube a 13:1. Es la misma regla que ya
   * aplica `statusLightForeground` al chip amarillo del semáforo.
   */
  yellow: 'bg-yellow text-ink hover:brightness-95 focus-visible:outline-ink-3',
}

/**
 * Las clases sueltas, para lo que tiene que ser `<a>` y no `<button>`: navegar
 * es un enlace, y como enlace conserva abrir en pestaña nueva y clic central.
 */
export function buttonClass(variant: ButtonVariant = 'secondary', className?: string): string {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold',
    'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
    VARIANT_CLASS[variant],
    className,
  )
}

export function Button({
  variant = 'secondary',
  className,
  type = 'button',
  ...props
}: ButtonProps): ReactNode {
  return <button type={type} className={buttonClass(variant, className)} {...props} />
}
