import { plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { cn, MaterialIcon, statusLight } from '@oranje/ui'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import { useGetWorkerDetailQuery } from '../api/workerDetailApi'
import { missingProfile } from '../lib/profileFields'
import type { PoolWorker } from '../types/pool.types'

import { ChangeStateDialog } from './ChangeStateDialog'
import { DeleteWorkerDialog } from './DeleteWorkerDialog'
import { ProfilePendingLabel } from './ProfilePendingLabel'

import { Button, buttonClass } from '@/shared/components/Button'
import { CautionPill } from '@/shared/components/CautionPill'
import { MagicCard } from '@/shared/components/MagicCard'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import { workerStatusChipLabel, WORKER_STATUS_TOKEN } from '@/shared/constants/workerStatus'
import { useCan } from '@/shared/hooks/useCan'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { formatDate } from '@/shared/lib/formatters'

function initialsOf(fullName: string): string {
  return fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase()
}

/** La cara con el semáforo como anillo — el mismo lenguaje de Mi Personal. */
function PoolAvatar({ worker, className }: { worker: PoolWorker; className: string }): ReactNode {
  const ring = statusLight[WORKER_STATUS_TOKEN[worker.status]]
  if (worker.photoUrl) {
    return (
      <img
        src={worker.photoUrl}
        alt=""
        aria-hidden
        style={{ borderColor: ring }}
        className={cn('shrink-0 rounded-full border-2 object-cover', className)}
      />
    )
  }
  return (
    <span
      aria-hidden
      style={{ borderColor: ring }}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full border-2 bg-o-500/15 font-bold text-o-700',
        className,
      )}
    >
      {initialsOf(worker.fullName)}
    </span>
  )
}

/** Un dato de la ficha con su icono (el patrón del Expediente). */
function Field({ icon, label, value }: { icon: string; label: string; value: string }): ReactNode {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <span
        aria-hidden
        className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2"
      >
        <MaterialIcon name={icon} className="text-base text-ink-3" />
      </span>
      <span className="min-w-0">
        <p className="text-xs text-ink-3">{label}</p>
        <p className="mt-0.5 truncate text-sm font-medium text-ink" title={value}>
          {value}
        </p>
      </span>
    </div>
  )
}

/**
 * El Pool como lista-detalle (el patrón con que el BDC ve a sus BDs): filas
 * con la cara y el estado en palabras a la izquierda, y la persona elegida a
 * fondo a la derecha. Lo hondo (documentos, historial) vive en el Expediente.
 */
export function PoolRoster({
  items,
  onEdit,
}: {
  items: PoolWorker[]
  onEdit: (worker: PoolWorker) => void
}): ReactNode {
  const { t, i18n } = useLingui()
  const can = useCan()
  const canDelete = can('recruitment:delete_worker')
  /** Mover el semáforo es de quien valida (recruitment:validate_signup). */
  const canValidate = can('recruitment:validate_signup')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<PoolWorker | null>(null)
  const [isChangeOpen, setChangeOpen] = useState(false)
  const selected = items.find((worker) => worker.id === selectedId) ?? items[0]
  /* La fila del Pool solo sabe si el perfil está completo; el diálogo de
     estado necesita QUÉ falta, y eso vive en la ficha completa. Se pide solo
     al abrirlo, para no cargar 300 fichas por listar el Pool. */
  const { data: detail } = useGetWorkerDetailQuery(selected?.id ?? '', {
    skip: !isChangeOpen || selected === undefined,
  })
  const missing = detail ? missingProfile(detail, i18n) : null

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
        <Trans>
          Nadie coincide con esa búsqueda o esos filtros. Cambia el nombre, la posición, la zona o
          el estado, o quítalos con «Quitar filtros».
        </Trans>
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[300px_1fr]">
      <ul className="flex flex-col gap-2">
        {items.map((worker) => (
          <li key={worker.id}>
            {/* Magic Bento (reactbits): la fila que se elige avisa al pasar. */}
            <MagicCard className="rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setSelectedId(worker.id)
                }}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500',
                  worker.id === selected?.id
                    ? 'border-o-500 bg-o-50'
                    : 'border-line bg-surface hover:bg-surface-2',
                )}
              >
                <PoolAvatar worker={worker} className="size-11 text-sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {worker.fullName}
                  </span>
                  {/* El estado EN PALABRAS también en la fila: al barrer el Pool,
                      saber quién está Disponible es la lectura principal. */}
                  <span className="block truncate text-xs text-ink-3">
                    {workerStatusChipLabel(worker.status)} · {worker.zoneName}
                  </span>
                </span>
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: statusLight[WORKER_STATUS_TOKEN[worker.status]] }}
                />
              </button>
            </MagicCard>
          </li>
        ))}
      </ul>

      {selected && (
        /* El detalle se queda a la vista mientras la lista baja (lista-detalle,
           mismo patrón que la Cartera): fijo bajo el header y, si es más alto que
           la ventana, se desliza por dentro sin arrastrar la página. */
        <article className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-6 lg:sticky lg:top-6 lg:max-h-[calc(100vh-var(--hd)-3rem)] lg:overflow-y-auto">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <PoolAvatar worker={selected} className="size-16 text-xl" />
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-2xl font-bold text-ink">{selected.fullName}</h2>
                  <StatusLightSoftBadge
                    token={WORKER_STATUS_TOKEN[selected.status]}
                    label={workerStatusChipLabel(selected.status)}
                  />
                  {selected.isBlacklisted && (
                    <span className="rounded-full bg-ink px-3 py-1 text-xs font-medium text-surface">
                      <Trans>En Blacklist</Trans>
                    </span>
                  )}
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-3">
                  <span className="inline-flex items-center gap-1.5">
                    <MaterialIcon name="event" className="text-base" aria-hidden />
                    <Trans>En el Pool desde el {formatDate(selected.createdAt)}</Trans>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MaterialIcon name="badge" className="text-base" aria-hidden />
                    {selected.catalogPosition === '—' ? t`Sin posición` : selected.catalogPosition}
                  </span>
                </p>
                {/* Las EXCEPCIONES hablan; lo que está bien no se anuncia. */}
                {(!selected.isProfileComplete || !selected.hasTaxId || !selected.hasAccount) && (
                  <p className="mt-2.5 flex flex-wrap items-center gap-2">
                    {!selected.isProfileComplete && (
                      <CautionPill>
                        <ProfilePendingLabel dueAt={selected.profileDueAt} />
                      </CautionPill>
                    )}
                    {!selected.hasAccount && (
                      <CautionPill>
                        <Trans>Sin acceso a la app</Trans>
                      </CautionPill>
                    )}
                    {!selected.hasTaxId && (
                      <CautionPill>
                        <Trans>
                          Sin ITIN: aplica retención del 16%{IS_DEV_UI ? ' (D-27)' : ''}
                        </Trans>
                      </CautionPill>
                    )}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {canDelete && (
                <button
                  type="button"
                  title={t`${selected.fullName} deja de verse en el Pool`}
                  onClick={() => {
                    setDeleting(selected)
                  }}
                  className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md px-4 text-sm font-semibold text-ink-3 transition-colors hover:bg-red/10 hover:text-red"
                >
                  <MaterialIcon name="delete" className="text-lg" aria-hidden />
                  <Trans>Eliminar</Trans>
                </button>
              )}
              <Button
                variant="secondary"
                onClick={() => {
                  onEdit(selected)
                }}
              >
                <Trans>Editar</Trans>
              </Button>
              <Link
                to={`/collaborator-pool/${selected.id}`}
                className={buttonClass(canValidate ? 'secondary' : 'primary')}
              >
                <Trans>Ver Expediente</Trans>
              </Link>
              {/* La acción del Pool es mover el semáforo (validar el alta), así
                  que es la primaria; el expediente pasa a secundaria. Un solo
                  botón primario por grupo, de menor a mayor compromiso. */}
              {canValidate && (
                <Button
                  variant="primary"
                  onClick={() => {
                    setChangeOpen(true)
                  }}
                >
                  <MaterialIcon name="swap_horiz" className="text-lg" aria-hidden />
                  <Trans>Cambiar estado</Trans>
                </Button>
              )}
            </div>
          </header>

          <div className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg bg-surface-2 p-4 sm:grid-cols-4">
            <Field
              icon="cake"
              label={t`Edad`}
              value={t`${plural(selected.age, { one: '# año', other: '# años' })}`}
            />
            <Field icon="map" label={t`Zona`} value={selected.zoneName} />
            <Field icon="translate" label={t`Inglés`} value={selected.englishLevel} />
            <Field icon="work" label={t`Modalidad`} value={selected.hiringModality} />
          </div>
        </article>
      )}

      {selected && (
        <ChangeStateDialog
          workerId={selected.id}
          currentStatus={selected.status}
          currentLabel={workerStatusChipLabel(selected.status)}
          isOpen={isChangeOpen}
          onClose={() => {
            setChangeOpen(false)
          }}
          missingProfileFields={missing?.labels ?? []}
          missingPhase1Fields={missing?.phase1 ?? []}
          missingLaterFields={missing?.later ?? []}
        />
      )}

      {deleting && (
        <DeleteWorkerDialog
          isOpen
          workerId={deleting.id}
          fullName={deleting.fullName}
          onClose={() => {
            setDeleting(null)
          }}
          onDeleted={() => {
            setSelectedId(null)
          }}
        />
      )}
    </div>
  )
}
