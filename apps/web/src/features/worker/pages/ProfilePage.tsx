import { StatusLightBadge } from '@oranje/ui'
import type { ReactNode } from 'react'

import { useGetMyHistoryQuery, useGetMyProfileQuery } from '../api/workerApi'
import { WorkerSkeleton } from '../components/WorkerSkeleton'

import {
  BLOOD_LABEL,
  EXPERIENCE_LABEL,
  RELATIONSHIP_LABEL,
  TRANSPORT_LABEL,
} from '@/shared/constants/workerEnums'
import {
  WORKER_STATUS_LABEL,
  WORKER_STATUS_TOKEN,
  type WorkerStatus,
} from '@/shared/constants/workerStatus'
import { formatDate } from '@/shared/lib/formatters'
import type { WorkerHistoryEntryApi } from '@/shared/types/apiContract.types'

function Row({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-sm text-ink-3">{label}</dt>
      <dd className="text-right text-sm font-medium text-ink">{value}</dd>
    </div>
  )
}

/**
 * Mi Perfil (maqueta «Mi Perfil solo-lectura»): lo que Oranje sabe de la
 * persona, sin editar — lo de Fase 1 lo decide Reclutamiento y lo de las
 * fases 2 y 3 se corrige en sus pantallas. El timeline es mi propio
 * `worker_state_history` (`GET /workers/me/history`), del más reciente al
 * más viejo; mientras llega, o si viene vacío, se muestra el estado de hoy.
 */

/** Un paso del semáforo, en palabras: quién te movió y por qué, si lo dijo. */
function HistoryStep({
  entry,
  isCurrent,
}: {
  entry: WorkerHistoryEntryApi
  isCurrent: boolean
}): ReactNode {
  const toState = entry.toState as WorkerStatus
  const detail = [formatDate(entry.occurredAt), entry.userName].join(' · ')

  return (
    <li className="flex gap-3">
      <span
        className={`mt-1.5 size-2.5 shrink-0 rounded-full ${isCurrent ? 'bg-o-500' : 'bg-surface-3'}`}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">
          {entry.fromState === null ? 'Alta en Oranje' : WORKER_STATUS_LABEL[toState]}
        </p>
        <p className="text-xs text-ink-3">{detail}</p>
        {entry.reason !== null && <p className="mt-0.5 text-xs text-ink-2">{entry.reason}</p>}
      </div>
    </li>
  )
}
export function ProfilePage(): ReactNode {
  const { data: profile, isLoading } = useGetMyProfileQuery()
  const { data: history = [] } = useGetMyHistoryQuery()

  if (isLoading || !profile) return <WorkerSkeleton variant="profile" />

  const status = profile.state.code as WorkerStatus

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col items-center gap-3 text-center">
        {profile.photoUrl ? (
          <img
            src={profile.photoUrl}
            alt=""
            aria-hidden
            className="size-24 rounded-full object-cover shadow-md"
          />
        ) : (
          <span
            aria-hidden
            className="flex size-24 items-center justify-center rounded-full bg-o-500/15 text-3xl font-bold text-o-700"
          >
            {profile.fullName.charAt(0)}
          </span>
        )}
        <div>
          <h1 className="text-2xl font-bold text-ink">{profile.fullName}</h1>
          <p className="text-sm text-ink-3">
            {profile.position?.name ?? 'Sin posición asignada'} · {profile.zone.name}
          </p>
        </div>
        <StatusLightBadge token={WORKER_STATUS_TOKEN[status]} label={WORKER_STATUS_LABEL[status]} />
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold text-ink">Tu semáforo</h2>
        <ol className="mt-2 flex flex-col gap-2">
          {history.length === 0 ? (
            <>
              <li className="flex gap-3">
                <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-o-500" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-ink">{WORKER_STATUS_LABEL[status]}</p>
                  <p className="text-xs text-ink-3">Tu estado hoy</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-surface-3" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-ink">Alta en Oranje</p>
                  <p className="text-xs text-ink-3">{formatDate(profile.createdAt)}</p>
                </div>
              </li>
            </>
          ) : (
            history.map((entry, index) => (
              <HistoryStep key={entry.id} entry={entry} isCurrent={index === 0} />
            ))
          )}
        </ol>
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold text-ink">Lo que decide Oranje</h2>
        <dl className="mt-1 divide-y divide-line">
          <Row label="Posición" value={profile.position?.name ?? '—'} />
          <Row label="Modalidad" value={profile.hiringModality?.name ?? '—'} />
          <Row label="Inglés" value={profile.englishLevel?.name ?? '—'} />
          <Row
            label="Experiencia"
            value={
              profile.experienceLevel === null
                ? '—'
                : (EXPERIENCE_LABEL[profile.experienceLevel] ?? profile.experienceLevel)
            }
          />
          <Row label="Zona" value={profile.zone.name} />
        </dl>
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold text-ink">Tus datos</h2>
        <dl className="mt-1 divide-y divide-line">
          <Row label="Teléfono" value={profile.phone} />
          <Row label="Domicilio" value={profile.address} />
          <Row
            label="Transporte"
            value={
              profile.transportType === null
                ? '—'
                : (TRANSPORT_LABEL[profile.transportType] ?? profile.transportType)
            }
          />
          <Row
            label="Tipo de sangre"
            value={
              profile.bloodType === null
                ? '—'
                : (BLOOD_LABEL[profile.bloodType] ?? profile.bloodType)
            }
          />
          <Row
            label="Emergencia"
            value={
              profile.emergencyContact
                ? `${profile.emergencyContact.name} · ${RELATIONSHIP_LABEL[profile.emergencyContact.relationship] ?? profile.emergencyContact.relationship}`
                : '—'
            }
          />
          <Row label="SSN / ITIN" value={profile.hasTaxId ? 'Verificado' : 'Pendiente'} />
        </dl>
      </section>
    </div>
  )
}
