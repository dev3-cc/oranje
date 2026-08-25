import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { MaterialIcon } from '@ui/components/material-icon'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ui/components/ui/table'
import { cn } from '@ui/lib/utils'
import { useState, type ReactNode } from 'react'

/**
 * LA tabla del sistema: TanStack Table sobre las primitivas de shadcn (D-16).
 * Las features declaran columnas (`ColumnDef`) y datos; el ordenamiento por
 * clic en el encabezado viene gratis. Vive aquí y no en una feature porque
 * §4 sube a compartido lo que necesitan dos o más.
 */
export function DataTable<T>({
  columns,
  data,
  emptyMessage = 'Sin resultados.',
  minWidthClassName,
  dense = false,
  onRowClick,
}: {
  columns: ColumnDef<T, unknown>[]
  data: T[]
  /** Qué decir cuando no hay filas: mejor una frase del dominio que un vacío. */
  emptyMessage?: string
  /** Ancho mínimo para tablas anchas; el contenedor ya scrollea en x. */
  minWidthClassName?: string
  dense?: boolean
  /** La fila entera actúa (abrir, editar). Los links internos hacen stopPropagation. */
  onRowClick?: (row: T) => void
}): ReactNode {
  const [sorting, setSorting] = useState<SortingState>([])

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  if (data.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
        {emptyMessage}
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <Table className={cn('border-collapse', minWidthClassName)}>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="border-line">
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort()
                const direction = header.column.getIsSorted()
                return (
                  <TableHead
                    key={header.id}
                    className={cn(
                      dense ? 'px-3 py-3' : 'px-5 py-4',
                      'text-sm font-normal text-ink-3',
                      canSort && 'p-0',
                    )}
                  >
                    {canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className={cn(
                          'flex w-full cursor-pointer items-center gap-1 text-left transition-colors hover:text-ink',
                          dense ? 'px-3 py-3' : 'px-5 py-4',
                        )}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {direction && (
                          <MaterialIcon
                            name={direction === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                            className="text-sm"
                          />
                        )}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              className={cn('border-line hover:bg-surface-2', onRowClick && 'cursor-pointer')}
              onClick={
                onRowClick
                  ? () => {
                      onRowClick(row.original)
                    }
                  : undefined
              }
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className={cn(dense ? 'px-3 py-4 text-sm' : 'px-5 py-5 text-base', 'text-ink-2')}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
