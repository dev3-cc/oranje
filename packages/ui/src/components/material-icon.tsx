import { cn } from '@ui/lib/utils'

/**
 * Puente de iconografía para las primitivas copiadas de shadcn: D-16 manda
 * Material Icons, así que el import de `lucide-react` se cambia por esto al
 * copiar. Ligadura de fuente, no SVG — el tamaño se controla con `text-*`.
 */
export function MaterialIcon({
  name,
  className,
}: {
  /** Nombre de la ligadura: `close`, `check`, `expand_more`… */
  name: string
  className?: string
}) {
  return (
    <span aria-hidden className={cn('material-icons-outlined leading-none select-none', className)}>
      {name}
    </span>
  )
}
