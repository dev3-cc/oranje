import type { ReactNode } from 'react'

import type { PoolWorker } from '../types/pool.types'

import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import { ENGLISH_LEVEL_LABEL, HIRING_MODALITY_LABEL } from '@/shared/constants/catalogs'
import { workerStatusChipLabel, WORKER_STATUS_TOKEN } from '@/shared/constants/workerStatus'

/**
 * Los encabezados van con el nombre de la columna de la vista, como en el
 * diseño: quien usa esta pantalla está armando coberturas contra `vw_pool` y
 * necesita saber por cuál campo está mirando.
 */
const HEADERS = [
  'full_name',
  'edad',
  'zone',
  'catalog_position',
  'english_level',
  'hiring_modality',
  'status_light_code',
  'perfil',
  'ITIN',
]

export function PoolTable({ items }: { items: PoolWorker[] }): ReactNode {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
        Nadie en el pool coincide con el filtro.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full min-w-[72rem] border-collapse text-left">
        <thead>
          <tr className="border-b border-line">
            {HEADERS.map((header) => (
              <th key={header} scope="col" className="px-5 py-4 text-sm font-normal text-ink-3">
                {header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {items.map((worker) => (
            <tr key={worker.id} className="border-b border-line last:border-b-0 hover:bg-surface-2">
              <th
                scope="row"
                className="px-5 py-5 text-left text-base font-bold whitespace-nowrap text-ink"
              >
                {worker.fullName}
              </th>
              <td className="px-5 py-5 text-base text-ink-2">{worker.age}</td>
              <td className="px-5 py-5 text-base whitespace-nowrap text-ink-2">
                {worker.zoneName}
              </td>
              <td className="px-5 py-5 text-base whitespace-nowrap text-ink-2">
                {worker.catalogPosition}
              </td>
              <td className="px-5 py-5 text-base whitespace-nowrap text-ink-2">
                {ENGLISH_LEVEL_LABEL[worker.englishLevel]}
              </td>
              <td className="px-5 py-5 text-base whitespace-nowrap text-ink-2">
                {HIRING_MODALITY_LABEL[worker.hiringModality]}
              </td>

              <td className="px-5 py-5">
                <StatusLightSoftBadge
                  token={WORKER_STATUS_TOKEN[worker.status]}
                  label={workerStatusChipLabel(worker.status)}
                />
              </td>

              {/*
                Perfil e ITIN en palabras y no con un check: «no» tiene que
                leerse igual de rápido que «sí», y un hueco donde debería ir una
                palomita se confunde con un dato que no cargó.
              */}
              <td className="px-5 py-5 text-base text-ink-2">
                {worker.isProfileComplete ? 'completo' : 'incompleto'}
              </td>
              <td className="px-5 py-5 text-base text-ink-2">{worker.hasTaxId ? 'sí' : 'no'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
