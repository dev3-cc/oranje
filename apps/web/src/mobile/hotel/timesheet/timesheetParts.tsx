import { useLingui } from '@lingui/react/macro'
import { cn } from '@oranje/ui'
import type { ReactNode } from 'react'

import type { AppTimesheetDay, DayPunchState } from './timesheetAppApi'

import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import {
  TIMESHEET_WEEK_STATUS_LABEL,
  TIMESHEET_WEEK_STATUS_TOKEN,
  type TimesheetWeekStatus,
} from '@/shared/constants/timesheetStatus'

export const DAY_DOT: Record<DayPunchState, string> = {
  COMPLETE: 'bg-green',
  IN_PROGRESS: 'bg-o-500',
  INCOMPLETE: 'bg-yellow',
  NO_SHIFT: 'bg-surface-3',
}

export function WeekStatusChip({ status }: { status: TimesheetWeekStatus }): ReactNode {
  return (
    <StatusLightSoftBadge
      token={TIMESHEET_WEEK_STATUS_TOKEN[status]}
      label={TIMESHEET_WEEK_STATUS_LABEL[status]}
    />
  )
}

/** Los siete días en un vistazo: un punto por día; la anomalía sin revisar, con anillo rojo. */
export function WeekDots({ days }: { days: AppTimesheetDay[] }): ReactNode {
  const { i18n } = useLingui()
  const weekday = new Intl.DateTimeFormat(i18n.locale, { weekday: 'narrow', timeZone: 'UTC' })
  return (
    <ol className="flex justify-between gap-1">
      {days.map((day) => (
        <li key={day.date} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-[10px] font-medium text-ink-3 uppercase">
            {weekday.format(new Date(`${day.date}T00:00:00Z`))}
          </span>
          <span
            className={cn(
              'size-3 rounded-full',
              DAY_DOT[day.punchState],
              day.hasAnomaly && day.reviewNote === null && 'ring-2 ring-red ring-offset-1',
            )}
          />
        </li>
      ))}
    </ol>
  )
}
