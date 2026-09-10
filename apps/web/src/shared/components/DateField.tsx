import { useLingui } from '@lingui/react/macro'
import { Calendar, MaterialIcon, Popover, PopoverContent, PopoverTrigger, cn } from '@oranje/ui'
import { useState, type ReactNode } from 'react'
import { enUS, es } from 'react-day-picker/locale'

import { currentLocale } from '@/app/i18n'
import { formatDate } from '@/shared/lib/formatters'

const DAY_PICKER_LOCALE = { es, en: enUS } as const

/** `Date` local -> `2026-09-18` (la forma de la columna `date`, sin zona). */
function toIso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${String(date.getFullYear())}-${month}-${day}`
}

function fromIso(iso: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return undefined
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

interface DateFieldProps {
  /** `AAAA-MM-DD` o vacío. */
  value: string
  onChange: (iso: string) => void
  id?: string
  'aria-label'?: string
  'aria-invalid'?: boolean
  placeholder?: string
  disabled?: boolean
  /** Primer día elegible; los anteriores salen apagados. */
  min?: string
  className?: string
}

/**
 * Fecha con calendario de shadcn (Popover + Calendar) en vez del
 * `<input type="date">` nativo: dentro de un `Dialog` de Radix el selector
 * nativo del navegador se cierra solo —el foco atrapado del diálogo lo
 * expulsa— y la persona no alcanzaba a elegir el día. El calendario vive en
 * un Popover, que Radix anida como capa hija del diálogo y no lo confunde con
 * un clic fuera.
 *
 * El valor sigue viajando como `AAAA-MM-DD`; lo que se ve va en el idioma
 * activo (D-36), con la semana empezando en lunes como en el resto de la app.
 */
export function DateField({
  value,
  onChange,
  id,
  'aria-label': ariaLabel,
  'aria-invalid': ariaInvalid,
  placeholder,
  disabled,
  min,
  className,
}: DateFieldProps): ReactNode {
  const { t } = useLingui()
  const [isOpen, setIsOpen] = useState(false)
  const selected = fromIso(value)
  const minDate = min !== undefined ? fromIso(min) : undefined

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-invalid={ariaInvalid}
          aria-haspopup="dialog"
          className={cn(
            'flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-left text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm',
            'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
            'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
            'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
            selected ? 'text-ink' : 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate">
            {selected ? formatDate(value) : (placeholder ?? t`Elige el día`)}
          </span>
          <MaterialIcon name="calendar_month" className="shrink-0 text-base text-ink-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          locale={DAY_PICKER_LOCALE[currentLocale()]}
          weekStartsOn={1}
          selected={selected}
          defaultMonth={selected ?? minDate ?? new Date()}
          disabled={minDate ? { before: minDate } : undefined}
          onSelect={(day) => {
            if (!day) return
            onChange(toIso(day))
            setIsOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
