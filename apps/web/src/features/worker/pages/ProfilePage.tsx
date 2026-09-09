import { Trans, useLingui } from '@lingui/react/macro'
import { StatusLightBadge } from '@oranje/ui'
import type { ReactNode } from 'react'

import { useGetTodayPunchingQuery } from '../api/punchApi'
import { useGetMyHistoryQuery, useGetMyProfileQuery } from '../api/workerApi'
import { WorkerSkeleton } from '../components/WorkerSkeleton'

import { HotelPhotoBackdrop } from '@/shared/components/HotelPhotoBackdrop'
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
      <dt className="text-sm text-white/70">{label}</dt>
      <dd className="text-right text-sm font-medium text-white">{value}</dd>
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
  const { t } = useLingui()
  const toState = entry.toState as WorkerStatus
  const detail = [formatDate(entry.occurredAt), entry.userName].join(' · ')

  return (
    <li className="flex gap-3">
      <span
        className={`mt-1.5 size-2.5 shrink-0 rounded-full ${isCurrent ? 'bg-o-500' : 'bg-white/40'}`}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-sm font-medium text-white">
          {entry.fromState === null ? t`Alta en Oranje` : WORKER_STATUS_LABEL[toState]}
        </p>
        <p className="text-xs text-white/70">{detail}</p>
        {entry.reason !== null && <p className="mt-0.5 text-xs text-white/80">{entry.reason}</p>}
      </div>
    </li>
  )
}
export function ProfilePage(): ReactNode {
  const { t } = useLingui()
  const { data: profile, isLoading } = useGetMyProfileQuery()
  const { data: history = [] } = useGetMyHistoryQuery()
  const { data: today } = useGetTodayPunchingQuery()
  const backdropUrl = today?.shift?.hotelPhotoUrl ?? null

  if (isLoading || !profile) return <WorkerSkeleton variant="profile" />

  const status = profile.state.code as WorkerStatus

  return (
    <div className="relative isolate -mx-5 -mt-5 flex flex-col gap-5 px-5 pt-5 pb-2">
      {/*
       * El fondo: la foto del hotel de hoy desenfocada (o el degradado Oranje)
       * detrás de todo el perfil; las tarjetas van en vidrio encima —
       * translúcidas y con desenfoque— y el texto se lee porque el vidrio
       * es claro (surface al 75 %), no por suerte.
       */}
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
        <HotelPhotoBackdrop photoUrl={backdropUrl} />
        {/* El velo oscuro es lo que hace legible el vidrio claro con texto blanco (mismo hero de Inicio). */}
        <div className="absolute inset-0 bg-ink/65" />
      </div>

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
          <h1 className="text-2xl font-bold text-white drop-shadow-sm">{profile.fullName}</h1>
          <p className="text-sm text-white/80">
            {profile.position?.name ?? t`Sin posición asignada`} · {profile.zone.name}
          </p>
        </div>
        <StatusLightBadge token={WORKER_STATUS_TOKEN[status]} label={WORKER_STATUS_LABEL[status]} />
      </section>

      <section className="rounded-2xl bg-white/15 p-4 text-white backdrop-blur-sm">
        <h2 className="text-sm font-semibold text-white">
          <Trans>Tu semáforo</Trans>
        </h2>
        <ol className="mt-2 flex flex-col gap-2">
          {history.length === 0 ? (
            <>
              <li className="flex gap-3">
                <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-o-500" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-white">{WORKER_STATUS_LABEL[status]}</p>
                  <p className="text-xs text-white/70">
                    <Trans>Tu estado hoy</Trans>
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-white/40" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-white">
                    <Trans>Alta en Oranje</Trans>
                  </p>
                  <p className="text-xs text-white/70">{formatDate(profile.createdAt)}</p>
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

      <section className="rounded-2xl bg-white/15 p-4 text-white backdrop-blur-sm">
        <h2 className="text-sm font-semibold text-white">
          <Trans>Lo que decide Oranje</Trans>
        </h2>
        <dl className="mt-1 divide-y divide-white/15">
          <Row label={t`Posición`} value={profile.position?.name ?? '—'} />
          <Row label={t`Modalidad`} value={profile.hiringModality?.name ?? '—'} />
          <Row label={t`Inglés`} value={profile.englishLevel?.name ?? '—'} />
          <Row
            label={t`Experiencia`}
            value={
              profile.experienceLevel === null
                ? '—'
                : (EXPERIENCE_LABEL[profile.experienceLevel] ?? profile.experienceLevel)
            }
          />
          <Row label={t`Zona`} value={profile.zone.name} />
        </dl>
      </section>

      <section className="rounded-2xl bg-white/15 p-4 text-white backdrop-blur-sm">
        <h2 className="text-sm font-semibold text-white">
          <Trans>Tus datos</Trans>
        </h2>
        <dl className="mt-1 divide-y divide-white/15">
          <Row label={t`Teléfono`} value={profile.phone} />
          <Row label={t`Domicilio`} value={profile.address} />
          <Row
            label={t`Transporte`}
            value={
              profile.transportType === null
                ? '—'
                : (TRANSPORT_LABEL[profile.transportType] ?? profile.transportType)
            }
          />
          <Row
            label={t`Tipo de sangre`}
            value={
              profile.bloodType === null
                ? '—'
                : (BLOOD_LABEL[profile.bloodType] ?? profile.bloodType)
            }
          />
          <Row
            label={t`Emergencia`}
            value={
              profile.emergencyContact
                ? `${profile.emergencyContact.name} · ${RELATIONSHIP_LABEL[profile.emergencyContact.relationship] ?? profile.emergencyContact.relationship}`
                : '—'
            }
          />
          {/* `hasTaxId` lee una columna cifrada que hoy nunca se escribe
              (siempre false) — mostrarla como "Verificado" afirmaría algo
              que nadie confirmó. Lo que SÍ escribe una persona real es
              `taxDeadline.isDocumentVerified` (al verificar el documento
              subido), así que es lo que se muestra aquí. */}
          <Row
            label={t`SSN / ITIN`}
            value={
              profile.taxDeadline.isDocumentVerified
                ? t`Verificado`
                : profile.taxDeadline.hasDocument
                  ? t`Cargado, sin verificar`
                  : t`Pendiente`
            }
          />
        </dl>
      </section>
    </div>
  )
}
