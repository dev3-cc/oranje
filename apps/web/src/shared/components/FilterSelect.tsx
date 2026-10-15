import {
  MaterialIcon,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from '@oranje/ui'
import type { ReactNode } from 'react'

export function FilterSelect({
  label,
  anyLabel,
  value,
  anyValue = 'ALL',
  options,
  onChange,
  icon,
  className,
}: {
  label: string
  anyLabel: string
  value: string
  anyValue?: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
  icon?: string
  /** Para destacarlo como filtro principal (Hugo, 2026-10-14: Contabilidad
      se mueve por hotel primero). Se funde con las clases base, no las reemplaza. */
  className?: string
}): ReactNode {
  const isActive = value !== anyValue

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label={label}
        className={cn(
          /* `max-w-full`: sin tope, un valor largo (nombre de hotel, de
             requisición…) crece la píldora más allá de su tarjeta y se
             desborda — pasa en un `flex-wrap` angosto, que no la encoge por
             sí solo (Hugo, 2026-10-14, con captura). `line-clamp-1` ya lo
             pone shadcn en el valor; con el ancho topado, al fin recorta
             con «…» en vez de salirse. */
          'relative w-auto max-w-full cursor-pointer rounded-full border py-2.5 pr-3 text-sm shadow-none transition-colors',
          icon ? 'pl-9' : 'pl-4',
          isActive
            ? 'border-o-500 bg-o-50 font-semibold text-o-700'
            : 'border-line bg-surface text-ink hover:bg-surface-2',
          className,
        )}
      >
        {icon && (
          <MaterialIcon
            name={icon}
            aria-hidden
            className={cn(
              'pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base',
              isActive ? 'text-o-700' : 'text-ink-3',
            )}
          />
        )}
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={anyValue}>
          {label}: {anyLabel}
        </SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {label}: {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
