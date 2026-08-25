import {
  MaterialIcon,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@oranje/ui'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import { useGetPersonnelBoardQuery } from '../api/personnelApi'
import { StandByDialog } from '../components/StandByDialog'
import type { PersonnelRow } from '../types/personnel.types'

import mascotaSaludando from '@/assets/mascota/mascota-saludando.png'
import { LoadError } from '@/shared/components/LoadError'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import {
  workerStatusChipLabel,
  WORKER_STATUS_TOKEN,
  type WorkerStatus,
} from '@/shared/constants/workerStatus'
import { IS_DEV_UI } from '@/shared/lib/devMode'

const NO_SHIFT_LABEL: Record<string, string> = {
  PINK: '— pausada',
  GRAY: '— protegido',
}

function initialsOf(fullName: string): string {
  return fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase()
}

function timeOf(iso: string): string {
  return iso.slice(11, 16)
}

function Kpi({ value, label }: { value: number; label: string }): ReactNode {
  return (
    <div className="rounded-lg border border-line bg-surface p-5">
      <p className="text-3xl font-bold text-ink">{value}</p>
      <p className="mt-1 text-sm text-ink-3">{label}</p>
    </div>
  )
}

export function PersonnelPage(): ReactNode {
  const { data: board, isLoading, isError, refetch } = useGetPersonnelBoardQuery()
  const [standByTarget, setStandByTarget] = useState<PersonnelRow | null>(null)

  if (isLoading) return <p className="text-sm text-ink-3">Cargando tu personal…</p>
  if (isError || !board) {
    return (
      <LoadError
        message="No se pudo cargar Mi Personal."
        onRetry={() => {
          void refetch()
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-ink">Mi Personal</h1>
        <p className="mt-1 text-sm text-ink-3">
          Colaboradores asignados a tus requisiciones · el semáforo siempre visible · Stand-by
          (Rosa) compartido con el Manager de Área
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi value={board.assignedToday} label="Asignados hoy" />
        <Kpi value={board.clockedInToday} label="Con entrada registrada" />
        <Kpi value={board.inStandBy} label="En Stand-by" />
        <Kpi value={board.inAccident} label="En accidente (GRIS)" />
      </div>

      {board.rows.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line px-6 py-12 text-center">
          <img src={mascotaSaludando} alt="" aria-hidden className="h-32 w-auto" />
          <p className="text-base font-semibold text-ink">
            Sin colaboradores asignados esta semana
          </p>
          <p className="max-w-md text-sm text-ink-3">
            El plantel se llena cuando el Schedule programe turnos de tus requisiciones.
          </p>
        </div>
      )}

      {board.rows.length > 0 && (
        <div className="rounded-lg border border-line bg-surface">
          <Table className="text-left text-sm">
            <TableHeader>
              <TableRow className="border-line text-xs text-ink-3 uppercase">
                <TableHead className="px-5 py-3 font-medium text-ink-3">Colaborador</TableHead>
                <TableHead className="px-5 py-3 font-medium text-ink-3">Posición</TableHead>
                <TableHead className="px-5 py-3 font-medium text-ink-3">Semáforo</TableHead>
                <TableHead className="px-5 py-3 font-medium text-ink-3">Turno hoy</TableHead>
                <TableHead className="px-5 py-3 font-medium text-ink-3">Marcas</TableHead>
                <TableHead className="px-5 py-3 font-medium text-ink-3">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {board.rows.map((row) => (
                <TableRow key={row.workerId} className="border-line">
                  <TableCell className="px-5 py-3">
                    <span className="flex items-center gap-3">
                      {row.photoUrl ? (
                        <img
                          src={row.photoUrl}
                          alt=""
                          className="size-8 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span
                          aria-hidden
                          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-o-50 text-[11px] font-bold text-o-700"
                        >
                          {initialsOf(row.fullName)}
                        </span>
                      )}
                      <span className="font-medium whitespace-nowrap text-ink">{row.fullName}</span>
                    </span>
                  </TableCell>
                  <TableCell className="px-5 py-3 text-ink-2">{row.positionName}</TableCell>
                  <TableCell className="px-5 py-3">
                    <StatusLightSoftBadge
                      token={WORKER_STATUS_TOKEN[row.stateCode as WorkerStatus] ?? 'st-blanco'}
                      label={workerStatusChipLabel(row.stateCode as WorkerStatus)}
                    />
                  </TableCell>
                  <TableCell className="px-5 py-3 text-ink-2">
                    {row.shift
                      ? `${timeOf(row.shift.startsAt)}–${timeOf(row.shift.endsAt)}`
                      : (NO_SHIFT_LABEL[row.stateCode] ?? '— descansa')}
                  </TableCell>
                  <TableCell className="px-5 py-3">
                    {row.clockInAt ? (
                      <span className="font-medium text-ink">IN {timeOf(row.clockInAt)}</span>
                    ) : row.shift ? (
                      <span className="text-red">Sin entrada</span>
                    ) : (
                      <span className="text-ink-4">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-5 py-3">
                    <span className="flex items-center gap-3 text-sm">
                      {row.canStandBy && (
                        <button
                          type="button"
                          onClick={() => {
                            setStandByTarget(row)
                          }}
                          className="cursor-pointer font-medium text-o-700 hover:underline"
                        >
                          Stand-by
                        </button>
                      )}
                      <a href={`tel:${row.phone}`} className="text-ink-2 hover:underline">
                        Contactar
                      </a>
                      {}
                      <Link
                        to={`/pool-colaboradores/${row.workerId}`}
                        className="text-ink-2 hover:underline"
                      >
                        Historial
                      </Link>
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-4">
        <MaterialIcon name="info" aria-hidden className="mt-0.5 text-sm" />
        Stand-by (Rosa) es compartido con el Manager de Área. El GRIS (accidente) protege: sin
        Stand-by ni veto, y sus faltas no cuentan{IS_DEV_UI ? ' (D-27)' : ''}.
        {IS_DEV_UI && (
          <code className="block">
            compuesto: /schedules + /timesheets + /workers · Stand-by = transición PINK
          </code>
        )}
      </p>

      {standByTarget && (
        <StandByDialog
          workerId={standByTarget.workerId}
          workerName={standByTarget.fullName}
          isOpen
          onClose={() => {
            setStandByTarget(null)
          }}
        />
      )}
    </div>
  )
}
