import { cn } from '@ui/lib/utils'
import type { ReactNode } from 'react'

/**
 * KPI rico — composición Oranje (D-16). Chip de ícono, valor principal,
 * tendencia y pie.
 */
export interface KpiCardProps {
  icon: string
  label: string
  value: string
  trend?: { value: string; direction: 'up' | 'down' | 'flat' }
  foot?: string
  className?: string
}

export function KpiCard({ icon, label, value, trend, foot, className }: KpiCardProps): ReactNode {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-line bg-surface p-5 shadow-sm',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-10 items-center justify-center rounded-md bg-o-50 text-o-700">
          <span className="material-icons-round text-xl leading-none">{icon}</span>
        </span>
        {trend && (
          <span
            className={cn(
              'text-xs font-semibold',
              trend.direction === 'up' && 'text-green',
              trend.direction === 'down' && 'text-red',
              trend.direction === 'flat' && 'text-ink-3',
            )}
          >
            {trend.value}
          </span>
        )}
      </div>
      <div>
        <p className="text-sm text-ink-3">{label}</p>
        <p className="mt-0.5 text-3xl font-black tracking-tight text-ink">{value}</p>
      </div>
      {foot && <p className="text-xs text-ink-3">{foot}</p>}
    </div>
  )
}
