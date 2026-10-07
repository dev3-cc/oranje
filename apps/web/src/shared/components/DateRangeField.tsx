import { Trans, useLingui } from '@lingui/react/macro'
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

export interface DateRange {
  /** `AAAA-MM-DD` o vacío. */
  from: string
  to: string
}

export const EMPTY_DATE_RANGE: DateRange = { from: '', to: '' }

/** Si el rango acota algo. Un solo extremo ya acota. */
export function hasRange(range: DateRange): boolean {
  return range.from !== '' || range.to !== ''
}

/**
 * Un periodo, no un día: «del 1 al 20» en vez de ir semana por semana.
 *
 * Hermano de [[DateField]] y con sus mismas decisiones —calendario en Popover
 * porque el nativo se cierra dentro de un diálogo, valor en `AAAA-MM-DD`, lo
 * que se ve en el idioma activo (D-36), la semana en lunes—, con dos
 * diferencias propias del rango:
 *
 * - **Un solo extremo basta.** «Desde el 1» sin fin es una pregunta legítima,
 *   así que no se exige cerrar el rango para que filtre.
 * - **Se puede limpiar sin cerrar.** Elegir mal el primer día y no poder
 *   deshacerlo sin salir es lo que vuelve molestos a estos controles.
 */
export function DateRangeField({
  value,
  onChange,
  label,
  className,
}: {
  value: DateRange
  onChange: (range: DateRange) => void
  /** Qué periodo se elige, para el lector de pantalla: «del Timesheet». */
  label: string
  className?: string
}): ReactNode {
  const { t } = useLingui()
  const [isOpen, setIsOpen] = useState(false)

  const from = fromIso(value.from)
  const to = fromIso(value.to)
  const activo = hasRange(value)

  /* Qué se lee en el botón. Con un solo extremo se dice cuál es, en vez de
     enseñar una fecha suelta que no aclara si es inicio o fin. */
  const texto =
    from && to
      ? `${formatDate(value.from)} – ${formatDate(value.to)}`
      : from
        ? t`Desde el ${formatDate(value.from)}`
        : to
          ? t`Hasta el ${formatDate(value.to)}`
          : t`Todo el periodo`

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t`Periodo ${label}`}
          aria-haspopup="dialog"
          className={cn(
            'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm transition-colors',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500',
            activo
              ? 'border-o-500 bg-o-50 font-semibold text-o-700'
              : 'border-ink-4/40 text-ink-2 hover:bg-o-50',
            className,
          )}
        >
          <MaterialIcon name="date_range" className="shrink-0 text-base" aria-hidden />
          <span className="truncate">{texto}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="range"
          locale={DAY_PICKER_LOCALE[currentLocale()]}
          weekStartsOn={1}
          captionLayout="dropdown"
          selected={{ from, to }}
          defaultMonth={from ?? to ?? new Date()}
          onSelect={(rango) => {
            onChange({
              from: rango?.from ? toIso(rango.from) : '',
              to: rango?.to ? toIso(rango.to) : '',
            })
          }}
        />
        {activo && (
          <div className="border-t border-line p-2">
            <button
              type="button"
              onClick={() => {
                onChange(EMPTY_DATE_RANGE)
                setIsOpen(false)
              }}
              className="w-full cursor-pointer rounded-md px-3 py-2 text-sm font-medium text-ink-2 transition-colors hover:bg-o-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
            >
              <Trans>Ver todo el periodo</Trans>
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
