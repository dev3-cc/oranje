import { Trans, useLingui } from '@lingui/react/macro'
import { cn, MaterialIcon } from '@oranje/ui'
import type { ReactNode } from 'react'

import { PERIOD_LABEL, PERIODS, type PeriodKey } from '../lib/period'

import { CardGridSkeleton } from '@/shared/components/CardGridSkeleton'
import { LoadError } from '@/shared/components/LoadError'
import { apiErrorMessage } from '@/shared/lib/apiError'

export function PeriodSelector({
  value,
  onChange,
}: {
  value: PeriodKey
  onChange: (period: PeriodKey) => void
}): ReactNode {
  const { i18n, t } = useLingui()
  return (
    <div role="radiogroup" aria-label={t`Periodo`} className="flex flex-wrap gap-1.5">
      {PERIODS.map((period) => (
        <button
          key={period}
          type="button"
          role="radio"
          aria-checked={value === period}
          onClick={() => {
            onChange(period)
          }}
          className={cn(
            'min-h-9 rounded-full border px-3 text-sm font-medium transition-colors',
            value === period
              ? 'border-o-300 bg-o-300 text-ink'
              : 'border-line bg-surface text-ink-2 hover:bg-surface-2',
          )}
        >
          {i18n._(PERIOD_LABEL[period])}
        </button>
      ))}
    </div>
  )
}

export interface SnapshotItem {
  key: string
  label: string
  count: number
}

/** «Hoy en el sistema»: la foto de ahora del departamento, en conteos sin meta. */
export function SnapshotStrip({ items }: { items: SnapshotItem[] }): ReactNode {
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-line bg-surface-2 p-4">
      <h3 className="text-xs font-semibold tracking-wide text-ink-3 uppercase">
        <Trans>Hoy en el sistema</Trans>
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-ink-3">
          <Trans>No hay nada que contar.</Trans>
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {items.map((item) => (
            <li
              key={item.key}
              className="flex items-baseline gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-sm"
            >
              <span className="font-semibold text-ink tabular-nums">{item.count}</span>
              <span className="text-ink-2">{item.label}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Se alcanzó el tope de páginas: los números se calcularon sobre una parte. */
export function TruncatedNotice(): ReactNode {
  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-xl border border-dashed border-line bg-surface-2 p-3 text-sm text-ink-2"
    >
      <MaterialIcon name="warning" className="text-lg" aria-hidden />
      <span>
        <Trans>
          Hay más registros de los que esta pantalla puede traer: algunos números se calcularon
          sobre una parte.
        </Trans>
      </span>
    </p>
  )
}

/** Cargando, error o el contenido de la pestaña. */
export function TabState({
  isLoading,
  error,
  onRetry,
  cards,
  children,
}: {
  isLoading: boolean
  error: unknown
  onRetry: () => void
  cards: number
  children: ReactNode
}): ReactNode {
  const { t } = useLingui()
  if (isLoading) {
    return <CardGridSkeleton cards={cards} className="grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" />
  }
  if (error) {
    return (
      <LoadError
        message={apiErrorMessage(error, { fallback: t`No se pudieron cargar los indicadores.` })}
        onRetry={onRetry}
      />
    )
  }
  return <div className="flex flex-col gap-4">{children}</div>
}

export type DepartmentView = 'kpis' | 'people'

/** «KPIs / Por persona»: las dos vistas de un departamento. */
export function ViewSwitch({
  value,
  onChange,
}: {
  value: DepartmentView
  onChange: (view: DepartmentView) => void
}): ReactNode {
  const { t } = useLingui()
  const options: Array<{ view: DepartmentView; label: string; icon: string }> = [
    { view: 'kpis', label: t`KPIs`, icon: 'bar_chart' },
    { view: 'people', label: t`Por persona`, icon: 'groups' },
  ]
  return (
    <div
      role="radiogroup"
      aria-label={t`Vista`}
      className="inline-flex self-start rounded-xl border border-line bg-surface p-1"
    >
      {options.map((option) => (
        <button
          key={option.view}
          type="button"
          role="radio"
          aria-checked={value === option.view}
          onClick={() => {
            onChange(option.view)
          }}
          className={cn(
            'inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors',
            value === option.view ? 'bg-o-50 text-ink' : 'text-ink-3 hover:text-ink',
          )}
        >
          <MaterialIcon name={option.icon} className="text-base" aria-hidden />
          {option.label}
        </button>
      ))}
    </div>
  )
}
