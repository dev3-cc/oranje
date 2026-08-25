import { buttonVariants, cn } from '@oranje/ui'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

/**
 * Botón de la app, implementado SOBRE el `button` de shadcn (D-16): las
 * variantes Oranje se mapean a las suyas y las clases viven en la primitiva,
 * no aquí. La API (`variant` primary/secondary/yellow) no cambia: ningún
 * consumidor se entera.
 *
 * Al pasar a shadcn se SALDA el conflicto que este archivo documentaba: el
 * primario ahora escribe con `--ink` sobre naranja (7.4:1), como manda la
 * regla 1 de contraste — el blanco de la maqueta daba 2.5:1 y reprobaba AA.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'yellow'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  children: ReactNode
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  /** `default` de shadcn = bg-primary + text-primary-foreground (naranja + ink). */
  primary: buttonVariants({ variant: 'default' }),
  secondary: buttonVariants({ variant: 'outline' }),
  /** Amarillo con `--ink`: con blanco da 1.4:1, ilegible (regla del chip amarillo). */
  yellow: cn(
    buttonVariants({ variant: 'default' }),
    'bg-yellow text-ink hover:bg-yellow hover:brightness-95',
  ),
}

/**
 * Las clases sueltas, para lo que tiene que ser `<a>` y no `<button>`: navegar
 * es un enlace, y como enlace conserva abrir en pestaña nueva y clic central.
 */
export function buttonClass(variant: ButtonVariant = 'secondary', className?: string): string {
  return cn(VARIANT_CLASS[variant], 'font-semibold', className)
}

export function Button({
  variant = 'secondary',
  className,
  type = 'button',
  ...props
}: ButtonProps): ReactNode {
  return <button type={type} className={buttonClass(variant, className)} {...props} />
}
