import { DataTable, type ColumnDef } from '@oranje/ui'
import type { ReactNode } from 'react'

import type { PoolWorker } from '../types/pool.types'

import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import { workerStatusChipLabel, WORKER_STATUS_TOKEN } from '@/shared/constants/workerStatus'

/**
 * El Pool sobre `DataTable` (TanStack + shadcn, D-16): la primera tabla del
 * sistema en el patrón nuevo, y el modelo para migrar las demás.
 *
 * Los encabezados van con el nombre de la columna de la vista, como en el
 * diseño: quien usa esta pantalla está armando coberturas contra `vw_pool` y
 * necesita saber por cuál campo está mirando.
 */
/** Iniciales para el avatar sin foto, como el «MS» del Expediente. */
function initialsOf(fullName: string): string {
  return fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase()
}

const COLUMNS: ColumnDef<PoolWorker, unknown>[] = [
  {
    accessorKey: 'fullName',
    header: 'full_name',
    cell: ({ row }) => (
      <span className="flex items-center gap-3">
        {/* La foto se captura en la app móvil (Fase 2): mientras no exista, iniciales. */}
        {row.original.photoUrl ? (
          <img
            src={row.original.photoUrl}
            alt=""
            className="size-9 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-o-50 text-xs font-bold text-o-700"
          >
            {initialsOf(row.original.fullName)}
          </span>
        )}
        <span className="text-base font-bold whitespace-nowrap text-ink">
          {row.original.fullName}
        </span>
      </span>
    ),
  },
  { accessorKey: 'age', header: 'edad' },
  {
    accessorKey: 'zoneName',
    header: 'zone',
    cell: ({ row }) => <span className="whitespace-nowrap">{row.original.zoneName}</span>,
  },
  {
    accessorKey: 'catalogPosition',
    header: 'catalog_position',
    cell: ({ row }) => <span className="whitespace-nowrap">{row.original.catalogPosition}</span>,
  },
  {
    accessorKey: 'englishLevel',
    header: 'english_level',
    cell: ({ row }) => <span className="whitespace-nowrap">{row.original.englishLevel}</span>,
  },
  {
    accessorKey: 'hiringModality',
    header: 'hiring_modality',
    cell: ({ row }) => <span className="whitespace-nowrap">{row.original.hiringModality}</span>,
  },
  {
    accessorKey: 'status',
    header: 'status_light_code',
    cell: ({ row }) => (
      <StatusLightSoftBadge
        token={WORKER_STATUS_TOKEN[row.original.status]}
        label={workerStatusChipLabel(row.original.status)}
      />
    ),
  },
  /*
   * Perfil e ITIN en palabras y no con un check: «no» tiene que leerse igual
   * de rápido que «sí», y un hueco donde debería ir una palomita se confunde
   * con un dato que no cargó.
   */
  {
    accessorKey: 'isProfileComplete',
    header: 'perfil',
    cell: ({ row }) => (row.original.isProfileComplete ? 'completo' : 'incompleto'),
  },
  {
    accessorKey: 'hasTaxId',
    header: 'ITIN',
    cell: ({ row }) => (row.original.hasTaxId ? 'sí' : 'no'),
  },
]

export function PoolTable({ items }: { items: PoolWorker[] }): ReactNode {
  return (
    <DataTable
      columns={COLUMNS}
      data={items}
      emptyMessage="Nadie en el pool coincide con el filtro."
      minWidthClassName="min-w-[72rem]"
    />
  )
}
