import type { ReactNode } from 'react'
import { Link } from 'react-router'

import type { DashboardRequisition } from '../types/dashboard.types'

export function RequisitionMiniList({
  title,
  subtitle,
  requisitions,
  emptyLabel,
}: {
  title: string
  subtitle: string
  requisitions: DashboardRequisition[]
  emptyLabel: string
}): ReactNode {
  return (
    <section className="rounded-lg border border-line bg-surface p-5">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <p className="mt-0.5 text-sm text-ink-3">{subtitle}</p>

      {requisitions.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-line px-3 py-6 text-center text-sm text-ink-4">
          {emptyLabel}
        </p>
      ) : (
        <ul className="mt-3 flex flex-col">
          {requisitions.map((requisition) => (
            <li key={requisition.id} className="border-b border-line last:border-b-0">
              <Link
                to="/requisiciones"
                className="flex items-center justify-between gap-4 py-3 transition-colors hover:bg-surface-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{requisition.number}</p>
                  <p className="mt-0.5 truncate text-sm text-ink-3">{requisition.hotelName}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm text-ink-3">
                    {requisition.filledSlots}/{requisition.totalSlots} cubiertos
                  </span>
                  <span className="flex items-center gap-1.5 text-sm text-ink-2">
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: requisition.state.color }}
                    />
                    {requisition.state.name}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
