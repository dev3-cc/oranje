/*
 * Spinner de shadcn/ui, copiado con su CLI (D-16) con UNA adaptación: el
 * original usa `Loader2Icon` de lucide; aquí va el mismo trazo como SVG
 * inline, porque la iconografía de la casa es Material y ese set no tiene un
 * aro de carga limpio. Mismo tamaño (16px), misma animación.
 */
import { cn } from '@ui/lib/utils'

function Spinner({ className, ...props }: React.ComponentProps<'svg'>) {
  return (
    <svg
      role="status"
      aria-label="Cargando"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-4 animate-spin', className)}
      {...props}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

export { Spinner }
