import { DataTable, type ColumnDef } from '@oranje/ui'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import type { PoolWorker } from '../types/pool.types'

import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import { workerStatusChipLabel, WORKER_STATUS_TOKEN } from '@/shared/constants/workerStatus'
import { IS_DEV_UI } from '@/shared/lib/devMode'

/**
 * El Pool sobre `DataTable` (TanStack + shadcn, D-16): la primera tabla del
 * sistema en el patrón nuevo, y el modelo para migrar las demás.
 *
 * Los encabezados van con el nombre de la columna de la vista SOLO en dev
 * local (IS_DEV_UI): ahí quien mira la pantalla está armando coberturas contra
 * `vw_pool`. En cualquier build el usuario ve la etiqueta humana.
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

/** En dev el encabezado es la columna de `vw_pool` (documentación viva); en build, la etiqueta humana. */
function col(dev: string, prod: string): string {
  return IS_DEV_UI ? dev : prod
}

const COLUMNS: ColumnDef<PoolWorker, unknown>[] = [
  {
    accessorKey: 'fullName',
    header: col('full_name', 'Nombre'),
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
        {/* El nombre abre el Expediente: el detalle cuelga de la lista. */}
        <Link
          to={`/pool-colaboradores/${row.original.id}`}
          onClick={(event) => {
            /* El nombre va al Expediente; la fila, al modal de edición. */
            event.stopPropagation()
          }}
          className="text-base font-bold whitespace-nowrap text-ink hover:text-o-700 hover:underline"
        >
          {row.original.fullName}
        </Link>
      </span>
    ),
  },
  { accessorKey: 'age', header: 'Edad' },
  {
    accessorKey: 'zoneName',
    header: col('zone', 'Zona'),
    cell: ({ row }) => <span className="whitespace-nowrap">{row.original.zoneName}</span>,
  },
  {
    accessorKey: 'catalogPosition',
    header: col('catalog_position', 'Posición'),
    cell: ({ row }) => <span className="whitespace-nowrap">{row.original.catalogPosition}</span>,
  },
  {
    accessorKey: 'englishLevel',
    header: col('english_level', 'Inglés'),
    cell: ({ row }) => <span className="whitespace-nowrap">{row.original.englishLevel}</span>,
  },
  {
    accessorKey: 'hiringModality',
    header: col('hiring_modality', 'Modalidad'),
    cell: ({ row }) => <span className="whitespace-nowrap">{row.original.hiringModality}</span>,
  },
  {
    accessorKey: 'status',
    header: col('status_light_code', 'Estado'),
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
    header: 'Perfil',
    cell: ({ row }) => (row.original.isProfileComplete ? 'completo' : 'incompleto'),
  },
  {
    accessorKey: 'hasTaxId',
    header: 'ITIN',
    cell: ({ row }) => (row.original.hasTaxId ? 'sí' : 'no'),
  },
]

export function PoolTable({
  items,
  onEdit,
}: {
  items: PoolWorker[]
  /** Picar la fila abre el MISMO modal del alta, en modo edición. */
  onEdit: (worker: PoolWorker) => void
}): ReactNode {
  return (
    <DataTable
      columns={COLUMNS}
      data={items}
      emptyMessage="Nadie en el pool coincide con el filtro."
      minWidthClassName="min-w-[72rem]"
      onRowClick={onEdit}
    />
  )
}
