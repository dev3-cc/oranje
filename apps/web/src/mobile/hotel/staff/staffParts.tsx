import { useLingui } from '@lingui/react/macro'
import { cn, statusLight } from '@oranje/ui'
import type { ReactNode } from 'react'

import type { StaffMember } from './staffAppApi'

import {
  WORKER_STATUS_LABEL,
  WORKER_STATUS_TOKEN,
  type WorkerStatus,
} from '@/shared/constants/workerStatus'
import { clock24In } from '@/shared/lib/formatters'

export function stateColor(stateCode: string): string {
  return statusLight[WORKER_STATUS_TOKEN[stateCode as WorkerStatus] ?? 'st-blanco']
}

export function stateLabel(stateCode: string): string {
  return WORKER_STATUS_LABEL[stateCode as WorkerStatus] ?? stateCode
}

/** La cara con el semáforo como anillo, el lenguaje del Perfil del Colaborador. */
export function StaffAvatar({
  member,
  className,
}: {
  member: StaffMember
  className?: string
}): ReactNode {
  const ring = stateColor(member.stateCode)
  return member.photoUrl ? (
    <img
      src={member.photoUrl}
      alt=""
      className={cn('shrink-0 rounded-full object-cover ring-[3px] ring-offset-2', className)}
      style={{ ['--tw-ring-color' as string]: ring }}
    />
  ) : (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-surface-2 font-bold text-ink-2 ring-[3px] ring-offset-2',
        className,
      )}
      style={{ ['--tw-ring-color' as string]: ring }}
    >
      {member.fullName.charAt(0)}
    </span>
  )
}

/** Hoy: «Entró 07:02», «Sin entrada» (alerta) o «Descansa hoy». */
export function TodayStatus({ member }: { member: StaffMember }): ReactNode {
  const { t } = useLingui()
  if (member.shift === null) {
    return <span className="text-xs text-ink-3">{t`Descansa hoy`}</span>
  }
  const shift = `${clock24In(member.shift.startsAt, member.timeZone)}–${clock24In(member.shift.endsAt, member.timeZone)}`
  if (member.clockInAt !== null) {
    const clockIn = clock24In(member.clockInAt, member.timeZone)
    return (
      <span className="text-xs text-ink-2">
        {shift} · <span className="font-semibold text-green">{t`Entró ${clockIn}`}</span>
      </span>
    )
  }
  return (
    <span className="text-xs text-ink-2">
      {shift} · <span className="font-semibold text-red">{t`Sin entrada`}</span>
    </span>
  )
}
