import {
  cn,
  MaterialIcon,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@oranje/ui'
import { useState, type ReactNode } from 'react'

import {
  useCreateCatalogItemMutation,
  useDeleteCatalogItemMutation,
  useGetAdminCatalogsQuery,
  useUpdateCatalogItemMutation,
  MANAGED_CATALOGS,
  type AdminCatalogItem,
  type AdminCatalogs,
  type ManagedCatalog,
} from '../api/catalogsAdminApi'

import { Button } from '@/shared/components/Button'
import { FoldText } from '@/shared/components/FoldText'
import { LoadError } from '@/shared/components/LoadError'
import { Modal } from '@/shared/components/Modal'
import { SearchField } from '@/shared/components/SearchField'
import { TableSkeleton } from '@/shared/components/TableSkeleton'
import { useCan } from '@/shared/hooks/useCan'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { matchesSearch } from '@/shared/lib/text'

/** Cada pestaña: cómo se llama, su singular y de qué lista bebe. */
interface TabConfig {
  label: string
  pick: (data: AdminCatalogs) => AdminCatalogItem[]
  /** Singular para los textos de los diálogos. */
  noun: string
  /** El buscador enseña el patrón con un ejemplo de ESA pestaña. */
  searchPlaceholder: string
}

const TAB_CONFIG: Record<ManagedCatalog, TabConfig> = {
  'hotel-departments': {
    label: 'Departamentos',
    pick: (data) => data.departments,
    noun: 'departamento',
    searchPlaceholder: 'Nombre del departamento, p. ej. Housekeeping…',
  },
  positions: {
    label: 'Posiciones',
    pick: (data) => data.positions,
    noun: 'posición',
    searchPlaceholder: 'Nombre de la posición, p. ej. Steward…',
  },
  'hiring-modalities': {
    label: 'Modalidades',
    pick: (data) => data.modalities,
    noun: 'modalidad',
    searchPlaceholder: 'Nombre de la modalidad, p. ej. Tiempo completo…',
  },
  'english-levels': {
    label: 'Niveles de inglés',
    pick: (data) => data.englishLevels,
    noun: 'nivel de inglés',
    searchPlaceholder: 'Nombre del nivel, p. ej. Conversacional…',
  },
}

const TABS = MANAGED_CATALOGS.map((catalog) => ({ catalog, ...TAB_CONFIG[catalog] }))

interface EditorState {
  catalog: ManagedCatalog
  noun: string
  /** `null` = alta nueva; con fila = renombrar. */
  item: AdminCatalogItem | null
}

/**
 * Catálogos del sistema, administrables solo con `catalogs:manage` (el
 * Administrador). Decisión de Hugo (2026-09-04): dejan de vivir solo en el
 * seed. Eliminar es DELETE de verdad; lo que está en uso lo protege la FK del
 * back y aquí solo se traduce el 409 a palabras.
 */
export function CatalogsPage(): ReactNode {
  const can = useCan()
  const canManage = can('catalogs:manage')
  const { data, isLoading, isError, refetch } = useGetAdminCatalogsQuery()

  const [active, setActive] = useState<ManagedCatalog>('hotel-departments')
  /** Filtra EN MEMORIA la pestaña activa por nombre; se vacía al cambiar de pestaña. */
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{
    catalog: ManagedCatalog
    noun: string
    item: AdminCatalogItem
  } | null>(null)

  const tab = { catalog: active, ...TAB_CONFIG[active] }
  const rows = data ? tab.pick(data) : []
  const visibleRows = rows.filter((row) => matchesSearch(search, row.name))
  const departmentName = (id: string | undefined): string =>
    data?.departments.find((department) => department.id === id)?.name ?? '—'

  if (!canManage) {
    return (
      <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
        Los catálogos los administra el Administrador del sistema.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            <FoldText text="Catálogos" />
          </h1>
          <p className="mt-1.5 text-sm text-ink-3">
            Las listas de las que bebe todo el sistema: requisiciones, altas y contratos.
            {IS_DEV_UI && <code className="ml-1.5 text-xs text-ink-4">catalogs.*</code>}
          </p>
        </div>
        <Button
          variant="primary"
          className="ml-auto"
          onClick={() => {
            setEditor({ catalog: tab.catalog, noun: tab.noun, item: null })
          }}
        >
          Agregar {tab.noun}
        </Button>
      </header>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Catálogo">
        {TABS.map((item) => (
          <button
            key={item.catalog}
            type="button"
            role="tab"
            aria-selected={item.catalog === active}
            onClick={() => {
              setActive(item.catalog)
              setSearch('')
            }}
            className={cn(
              'cursor-pointer rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors',
              item.catalog === active
                ? 'border-o-500 bg-o-500 text-ink'
                : 'border-line bg-surface text-ink-2 hover:bg-surface-2',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <SearchField
        value={search}
        onChange={setSearch}
        label={`Buscar en ${tab.label}`}
        placeholder={tab.searchPlaceholder}
        className="w-full max-w-md"
      />

      {isError && (
        <LoadError
          message="No se pudieron cargar los catálogos. Reintenta en unos segundos."
          onRetry={() => {
            void refetch()
          }}
        />
      )}

      {isLoading || !data ? (
        <TableSkeleton rows={5} columns={3} />
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
          Este catálogo está vacío. Agrega su primera fila con el botón de arriba.
        </p>
      ) : visibleRows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
          Ninguna fila coincide con «{search.trim()}». Cambia la búsqueda o agrégala.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-line bg-surface">
          {visibleRows.map((row) => (
            <li
              key={row.id}
              className="flex items-center gap-3 border-b border-line px-5 py-3 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{row.name}</p>
                <p className="text-xs text-ink-3">
                  {active === 'positions' && (
                    <span className="mr-2 inline-flex items-center gap-1">
                      <MaterialIcon name="apartment" className="text-sm" aria-hidden />
                      {departmentName(row.hotelDepartmentId)}
                    </span>
                  )}
                  {IS_DEV_UI && <code className="text-ink-4">{row.code}</code>}
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  setEditor({ catalog: tab.catalog, noun: tab.noun, item: row })
                }}
              >
                Renombrar
              </Button>
              <button
                type="button"
                aria-label={`Eliminar ${row.name}`}
                title={`Eliminar ${tab.noun}`}
                onClick={() => {
                  setPendingDelete({ catalog: tab.catalog, noun: tab.noun, item: row })
                }}
                className="cursor-pointer rounded-md p-1.5 text-ink-3 transition-colors hover:bg-surface-2 hover:text-red"
              >
                <MaterialIcon name="delete" className="text-lg" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {editor !== null && data && (
        <CatalogItemDialog
          editor={editor}
          departments={data.departments}
          onClose={() => {
            setEditor(null)
          }}
        />
      )}

      {pendingDelete !== null && (
        <DeleteCatalogItemDialog
          pending={pendingDelete}
          onClose={() => {
            setPendingDelete(null)
          }}
        />
      )}
    </div>
  )
}

/** Alta o renombrado de una fila; las posiciones eligen además su departamento. */
function CatalogItemDialog({
  editor,
  departments,
  onClose,
}: {
  editor: EditorState
  departments: AdminCatalogItem[]
  onClose: () => void
}): ReactNode {
  const [name, setName] = useState(editor.item?.name ?? '')
  const [departmentId, setDepartmentId] = useState(editor.item?.hotelDepartmentId ?? '')
  const [error, setError] = useState<string | null>(null)
  const [createItem, { isLoading: isCreating }] = useCreateCatalogItemMutation()
  const [updateItem, { isLoading: isUpdating }] = useUpdateCatalogItemMutation()

  const isPosition = editor.catalog === 'positions'
  const isBusy = isCreating || isUpdating
  const canSave = name.trim() !== '' && (!isPosition || departmentId !== '')

  async function save(): Promise<void> {
    setError(null)
    try {
      if (editor.item === null) {
        await createItem({
          catalog: editor.catalog,
          name: name.trim(),
          ...(isPosition ? { hotelDepartmentId: departmentId } : {}),
        }).unwrap()
        toast.success(`Se agregó «${name.trim()}»`)
      } else {
        await updateItem({
          catalog: editor.catalog,
          id: editor.item.id,
          name: name.trim(),
          ...(isPosition && departmentId !== '' ? { hotelDepartmentId: departmentId } : {}),
        }).unwrap()
        toast.success('Catálogo actualizado')
      }
      onClose()
    } catch (saveError) {
      setError(
        apiErrorMessage(saveError, {
          byCode: {
            CATALOG_NAME_TAKEN: 'Ya existe una fila con ese nombre en este catálogo.',
            DEPARTMENT_REQUIRED: 'Una posición pertenece a un departamento: elige a cuál.',
          },
          fallback: 'No se pudo guardar. Revisa el nombre e inténtalo de nuevo.',
        }),
      )
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={editor.item === null ? `Agregar ${editor.noun}` : `Renombrar ${editor.noun}`}
      footer={
        <>
          <Button onClick={onClose} disabled={isBusy}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={!canSave || isBusy}
            onClick={() => {
              void save()
            }}
          >
            {isBusy ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink-2">Nombre</span>
        <input
          value={name}
          onChange={(event) => {
            setName(event.target.value)
          }}
          maxLength={80}
          placeholder="P. ej. Steward"
          className="rounded-md border border-line bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink-4 focus:border-o-500 focus:outline-none"
        />
      </label>

      {isPosition && (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink-2">Departamento</span>
          <Select
            {...(departmentId ? { value: departmentId } : {})}
            onValueChange={setDepartmentId}
          >
            <SelectTrigger aria-label="Departamento de la posición" className="w-full">
              <SelectValue placeholder="Elige el departamento" />
            </SelectTrigger>
            <SelectContent>
              {departments.map((department) => (
                <SelectItem key={department.id} value={department.id}>
                  {department.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      )}

      {error !== null && (
        <p role="alert" className="rounded-md bg-red/10 px-3 py-2 text-sm text-red">
          {error}
        </p>
      )}
    </Modal>
  )
}

/** Confirmación de borrado: se elimina de verdad, y lo usado lo frena el back. */
function DeleteCatalogItemDialog({
  pending,
  onClose,
}: {
  pending: { catalog: ManagedCatalog; noun: string; item: AdminCatalogItem }
  onClose: () => void
}): ReactNode {
  const [error, setError] = useState<string | null>(null)
  const [deleteItem, { isLoading }] = useDeleteCatalogItemMutation()

  async function remove(): Promise<void> {
    setError(null)
    try {
      await deleteItem({ catalog: pending.catalog, id: pending.item.id }).unwrap()
      toast.success(`Se eliminó «${pending.item.name}»`)
      onClose()
    } catch (deleteError) {
      setError(
        apiErrorMessage(deleteError, {
          byCode: {
            CATALOG_IN_USE:
              'Está en uso: hay requisiciones, posiciones o colaboradores colgando de esta fila. Elimina o reasigna eso primero.',
          },
          fallback: 'No se pudo eliminar. Inténtalo de nuevo.',
        }),
      )
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Eliminar ${pending.noun}`}
      footer={
        <>
          <Button onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={isLoading}
            onClick={() => {
              void remove()
            }}
          >
            {isLoading ? 'Eliminando…' : 'Sí, eliminar'}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-2">
        «{pending.item.name}» se elimina de verdad — no se archiva. Si algo del sistema lo está
        usando, el propio sistema lo va a impedir y te lo dirá aquí.
      </p>
      {error !== null && (
        <p role="alert" className="rounded-md bg-red/10 px-3 py-2 text-sm text-red">
          {error}
        </p>
      )}
    </Modal>
  )
}
