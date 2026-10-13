import { Trans, useLingui } from '@lingui/react/macro'
import {
  cn,
  MaterialIcon,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@oranje/ui'
import { type ReactNode, useState } from 'react'

import { PERSON_EVENT_LABEL, type PersonRow } from '../lib/people'

import {
  CONTACT_ATTEMPT_OUTCOME_LABEL,
  type ContactAttemptOutcome,
} from '@/shared/constants/contactAttempt'
import { roleLabelOf } from '@/shared/constants/roles'
import { formatDayMonthTime } from '@/shared/lib/formatters'

/** Aviso de lo que esta vista no puede ver. */
export function PeopleNotice({ children }: { children: ReactNode }): ReactNode {
  return (
    <p
      role="note"
      className="flex items-start gap-2 rounded-xl border border-dashed border-line bg-surface-2 p-3 text-sm text-ink-2"
    >
      <MaterialIcon name="info" className="text-lg" aria-hidden />
      <span>{children}</span>
    </p>
  )
}

function LastActivity({ at }: { at: string | null }): ReactNode {
  return at ? (
    <span className="text-ink-2 tabular-nums">{formatDayMonthTime(at)}</span>
  ) : (
    <span className="font-medium text-red">
      <Trans>Sin actividad en el periodo</Trans>
    </span>
  )
}

/**
 * Una fila por persona, de la menos activa a la más activa. La tabla enseña
 * las primeras `columns` métricas; el detalle, todas y la línea de tiempo.
 */
export function PeopleView({
  rows,
  columns,
  periodLabel,
}: {
  rows: PersonRow[]
  columns: number
  periodLabel: string
}): ReactNode {
  const { i18n } = useLingui()
  const [selected, setSelected] = useState<PersonRow | null>(null)
  const header = rows[0]?.metrics.slice(0, columns) ?? []

  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-line bg-surface p-6 text-center text-sm text-ink-3">
        <Trans>Nadie de este departamento tiene actividad registrada que se pueda ver.</Trans>
      </p>
    )
  }

  return (
    <>
      {/* Escritorio: tabla. */}
      <div className="hidden overflow-x-auto rounded-2xl border border-line bg-surface md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-3">
              <th className="px-4 py-3 font-semibold">
                <Trans>Persona</Trans>
              </th>
              {header.map((metric) => (
                <th key={metric.label.id} className="px-3 py-3 text-right font-semibold">
                  {i18n._(metric.label)}
                </th>
              ))}
              <th className="px-4 py-3 font-semibold">
                <Trans>Última actividad</Trans>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.key}
                className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-2"
                onClick={() => {
                  setSelected(row)
                }}
              >
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="text-left font-semibold text-ink hover:underline"
                    onClick={(event) => {
                      event.stopPropagation()
                      setSelected(row)
                    }}
                  >
                    {row.name}
                  </button>
                  {row.roleCode && (
                    <p className="text-xs text-ink-3">{roleLabelOf(row.roleCode).title}</p>
                  )}
                </td>
                {row.metrics.slice(0, columns).map((metric) => (
                  <td
                    key={metric.label.id}
                    className={cn(
                      'px-3 py-3 text-right tabular-nums',
                      metric.value === 0 ? 'text-ink-3' : 'font-medium text-ink',
                    )}
                  >
                    {metric.value}
                  </td>
                ))}
                <td className="px-4 py-3">
                  <LastActivity at={row.lastActivityAt} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Móvil: tarjetas. */}
      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <li key={row.key}>
            <button
              type="button"
              onClick={() => {
                setSelected(row)
              }}
              className="flex w-full flex-col gap-3 rounded-2xl border border-line bg-surface p-4 text-left"
            >
              <div className="flex w-full items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{row.name}</p>
                  {row.roleCode && (
                    <p className="text-xs text-ink-3">{roleLabelOf(row.roleCode).title}</p>
                  )}
                </div>
                <MaterialIcon name="chevron_right" className="text-xl text-ink-3" aria-hidden />
              </div>
              <dl className="grid w-full grid-cols-3 gap-2 text-sm">
                {row.metrics.slice(0, Math.min(columns, 3)).map((metric) => (
                  <div key={metric.label.id}>
                    <dt className="text-xs text-ink-3">{i18n._(metric.label)}</dt>
                    <dd className="font-semibold text-ink tabular-nums">{metric.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs">
                <LastActivity at={row.lastActivityAt} />
              </p>
            </button>
          </li>
        ))}
      </ul>

      <Sheet
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.name}</SheetTitle>
                <SheetDescription>
                  {selected.roleCode ? `${roleLabelOf(selected.roleCode).title} · ` : ''}
                  {periodLabel}
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-5 px-4 pb-6">
                <dl className="grid grid-cols-2 gap-3">
                  {selected.metrics.map((metric) => (
                    <div
                      key={metric.label.id}
                      className="rounded-xl border border-line bg-surface-2 p-3"
                    >
                      <dt className="text-xs text-ink-3">{i18n._(metric.label)}</dt>
                      <dd className="text-xl font-bold text-ink tabular-nums">{metric.value}</dd>
                    </div>
                  ))}
                </dl>

                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-ink-2">
                    <Trans>Actividad en el periodo</Trans> · {selected.events.length}
                  </h3>
                  {selected.events.length === 0 ? (
                    <p className="text-sm text-ink-3">
                      <Trans>No registró nada en el periodo.</Trans>
                    </p>
                  ) : (
                    <ol className="flex flex-col">
                      {selected.events.map((event, index) => (
                        <li
                          key={`${event.at}-${String(index)}`}
                          className="flex flex-col gap-0.5 border-l-2 border-line py-2 pl-3"
                        >
                          <span className="text-sm font-medium text-ink">
                            {i18n._(PERSON_EVENT_LABEL[event.kind])}
                            {event.outcome &&
                              ` · ${
                                CONTACT_ATTEMPT_OUTCOME_LABEL[
                                  event.outcome as ContactAttemptOutcome
                                ] ?? event.outcome
                              }`}
                          </span>
                          <span className="text-sm text-ink-2">{event.subject}</span>
                          <span className="text-xs text-ink-3 tabular-nums">
                            {formatDayMonthTime(event.at)}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
