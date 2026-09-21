import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { Popover, PopoverContent, PopoverTrigger, cn, statusLight } from '@oranje/ui'
import { useState, type MouseEvent, type ReactNode } from 'react'

import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import {
  URGENCY_HINT,
  URGENCY_LABEL,
  URGENCY_TOKEN,
  type UrgencyLevel,
} from '@/shared/constants/requisitionStatus'
import { formatDate } from '@/shared/lib/formatters'

const MS_PER_DAY = 86_400_000

/** Días de hoy a una fecha `AAAA-MM-DD`, en calendario local (negativo si ya pasó). */
function daysUntil(isoDate: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate)
  if (!match) return null
  const target = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target.getTime() - today.getTime()) / MS_PER_DAY)
}

/** Días completos desde un instante ISO hasta ahora. */
function daysSince(iso: string): number | null {
  const at = new Date(iso).getTime()
  if (Number.isNaN(at)) return null
  return Math.max(0, Math.floor((Date.now() - at) / MS_PER_DAY))
}

/**
 * El chip del Semáforo de Urgencia con su explicación al tocarlo: el color
 * sale del tiempo entre autorizar y la fecha de inicio, así que eso es lo que
 * se enseña — cuándo empieza y desde cuándo está autorizada. Es un Popover y
 * no un `title` porque en el celular no hay hover (Hugo, 2026-09-21).
 */
export function UrgencyChip({
  urgency,
  startDate,
  authorizedAt,
  variant = 'badge',
}: {
  urgency: UrgencyLevel
  /** Fecha de inicio de la posición (o la más próxima de la requisición). */
  startDate: string | null
  authorizedAt: string | null
  /** `inline`: punto + texto sin píldora, para celdas de tabla. */
  variant?: 'badge' | 'inline'
}): ReactNode {
  const { t } = useLingui()
  const [isOpen, setIsOpen] = useState(false)
  const label = URGENCY_LABEL[urgency]
  const hint = URGENCY_HINT[urgency]
  const ahead = startDate ? daysUntil(startDate) : null
  const since = authorizedAt ? daysSince(authorizedAt) : null

  /* El chip vive dentro de enlaces y filas que navegan: el toque abre la
     explicación y no se va a la ficha. */
  const toggle = (event: MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault()
    event.stopPropagation()
    setIsOpen((open) => !open)
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={toggle}
          aria-label={t`Urgencia: ${label}. Toca para ver el tiempo`}
          className={cn(
            'inline-flex cursor-pointer touch-manipulation items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500',
            variant === 'inline' && 'gap-2 text-sm text-ink-2',
          )}
        >
          {variant === 'badge' ? (
            <StatusLightSoftBadge token={URGENCY_TOKEN[urgency]} label={label} />
          ) : (
            <>
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: statusLight[URGENCY_TOKEN[urgency]] }}
                aria-hidden
              />
              {label}
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-64 p-3 text-sm"
        onClick={(event) => {
          event.stopPropagation()
        }}
      >
        <p className="font-semibold text-ink">
          {label} · {hint}
        </p>
        <ul className="mt-2 flex flex-col gap-1 text-ink-2">
          {startDate && ahead !== null && (
            <li>
              {ahead > 0 && (
                <Trans>
                  Empieza el {formatDate(startDate)} ·{' '}
                  <Plural value={ahead} one="en # día" other="en # días" />
                </Trans>
              )}
              {ahead === 0 && <Trans>Empieza hoy, {formatDate(startDate)}</Trans>}
              {ahead < 0 && (
                <Trans>
                  Empezó el {formatDate(startDate)} ·{' '}
                  <Plural value={-ahead} one="hace # día" other="hace # días" />
                </Trans>
              )}
            </li>
          )}
          <li>
            {since !== null ? (
              since === 0 ? (
                <Trans>Autorizada hoy</Trans>
              ) : (
                <Trans>
                  Autorizada <Plural value={since} one="hace # día" other="hace # días" />
                </Trans>
              )
            ) : (
              <Trans>Aún sin autorizar: la urgencia se calcula al autorizar</Trans>
            )}
          </li>
        </ul>
      </PopoverContent>
    </Popover>
  )
}
