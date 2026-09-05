import { cn, MaterialIcon, statusLight } from '@oranje/ui'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import type { PoolWorker } from '../types/pool.types'

import { Button, buttonClass } from '@/shared/components/Button'
import { CautionPill } from '@/shared/components/CautionPill'
import { MagicCard } from '@/shared/components/MagicCard'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import { workerStatusChipLabel, WORKER_STATUS_TOKEN } from '@/shared/constants/workerStatus'
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
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = items.find((worker) => worker.id === selectedId) ?? items[0]

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
        Nadie coincide con esa búsqueda o esos filtros. Cambia el nombre, la posición, la zona o el
        estado, o quítalos con «Quitar filtros».
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
        <article className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-6">
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
                      En Blacklist
                    </span>
                  )}
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-3">
                  <span className="inline-flex items-center gap-1.5">
                    <MaterialIcon name="event" className="text-base" aria-hidden />
                    En el Pool desde el {formatDate(selected.createdAt)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MaterialIcon name="badge" className="text-base" aria-hidden />
                    {selected.catalogPosition === '—' ? 'Sin posición' : selected.catalogPosition}
                  </span>
                </p>
                {/* Las EXCEPCIONES hablan; lo que está bien no se anuncia. */}
                {(!selected.isProfileComplete || !selected.hasTaxId) && (
                  <p className="mt-2.5 flex flex-wrap items-center gap-2">
                    {!selected.isProfileComplete && <CautionPill>Perfil incompleto</CautionPill>}
                    {!selected.hasTaxId && (
                      <CautionPill>
                        Sin ITIN: aplica retención del 16%{IS_DEV_UI ? ' (D-27)' : ''}
                      </CautionPill>
                    )}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  onEdit(selected)
                }}
              >
                Editar
              </Button>
              <Link to={`/pool-colaboradores/${selected.id}`} className={buttonClass('primary')}>
                Ver Expediente
              </Link>
            </div>
          </header>

          <div className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg bg-surface-2 p-4 sm:grid-cols-4">
            <Field icon="cake" label="Edad" value={`${String(selected.age)} años`} />
            <Field icon="map" label="Zona" value={selected.zoneName} />
            <Field icon="translate" label="Inglés" value={selected.englishLevel} />
            <Field icon="work" label="Modalidad" value={selected.hiringModality} />
          </div>
        </article>
      )}
    </div>
  )
}
