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
import { useSearchParams } from 'react-router'

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
import { AuditChecklistItemsPanel } from '../components/AuditChecklistItemsPanel'

import personajeComencemos from '@/assets/ilustrations/personaje-comencemos.svg'
import personajeConfiguracion from '@/assets/ilustrations/personaje-configuracion.svg'
import personajeEstrategia from '@/assets/ilustrations/personaje-estrategia.svg'
import { Button } from '@/shared/components/Button'
import { FoldText } from '@/shared/components/FoldText'
import { LoadError } from '@/shared/components/LoadError'
import { Modal } from '@/shared/components/Modal'
import { OnboardingIntro, type OnboardingSlide } from '@/shared/components/OnboardingIntro'
import { SearchField } from '@/shared/components/SearchField'
import { TableSkeleton } from '@/shared/components/TableSkeleton'
import { useCan } from '@/shared/hooks/useCan'
import { useIntroSeen } from '@/shared/hooks/useIntroSeen'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { matchesSearch } from '@/shared/lib/text'

const INTRO_SLIDES: readonly OnboardingSlide[] = [
  {
    image: personajeConfiguracion,
    title: 'Los catálogos alimentan toda la plataforma',
    text: 'Departamentos, posiciones, modalidades e inglés viven aquí — de acá beben las requisiciones y las altas.',
  },
  {
    image: personajeEstrategia,
    title: 'Reactivos de Auditoría es distinto',
    text: 'Su propio peso por reactivo y arrastre para reordenar — por eso vive separado, con una línea divisoria antes de su pestaña.',
  },
  {
    image: personajeComencemos,
    title: 'Eliminar es de verdad',
    text: 'No se archiva: si algo del sistema lo está usando, la propia base lo protege y te lo dice.',
  },
]

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
    label: 'Departamentos y posiciones',
    pick: (data) => data.departments,
    noun: 'departamento',
    searchPlaceholder: 'Departamento o posición, p. ej. Steward…',
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

/**
 * Posiciones ya no es pestaña: cada posición pertenece a un departamento y
 * verlas separadas no decía cuál (Hugo, 2026-09-09). Viven seccionadas
 * dentro de «Departamentos y posiciones», como los reactivos por categoría.
 */
const TABS = MANAGED_CATALOGS.filter((catalog) => catalog !== 'positions').map((catalog) => ({
  catalog,
  ...TAB_CONFIG[catalog],
}))

interface EditorState {
  catalog: ManagedCatalog
  noun: string
  /** `null` = alta nueva; con fila = renombrar. */
  item: AdminCatalogItem | null
  /** Alta de posición desde su sección: el departamento ya viene elegido. */
  presetDepartmentId?: string
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
  /** El intro de página se ve UNA vez; «¿Cómo funciona?» lo reabre. */
  const { isIntroOpen, dismissIntro, reopenIntro } = useIntroSeen('catalogs')

  /** Los reactivos de auditoría son un catálogo propio (más campos, dueño distinto): pestaña aparte. */
  const REACTIVOS_TAB = 'audit-checklist-items' as const
  type TabKey = ManagedCatalog | typeof REACTIVOS_TAB
  const ALL_TAB_KEYS: readonly TabKey[] = [...MANAGED_CATALOGS, REACTIVOS_TAB]
  /* La pestaña vive en la URL (regla WIG «la URL refleja el estado», mismo
     patrón que `?q=` en Mi Territorio): recargar o compartir el enlace deja
     a la persona en la misma pestaña, no siempre en la primera. */
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const active: TabKey =
    requestedTab !== null && (ALL_TAB_KEYS as readonly string[]).includes(requestedTab)
      ? requestedTab === 'positions'
        ? 'hotel-departments' // enlaces viejos a la pestaña que se fusionó
        : (requestedTab as TabKey)
      : 'hotel-departments'

  function selectTab(next: TabKey): void {
    setSearchParams(
      (previous) => {
        const params = new URLSearchParams(previous)
        params.set('tab', next)
        return params
      },
      { replace: true },
    )
    setSearch('')
  }

  /** Filtra EN MEMORIA la pestaña activa por nombre; se vacía al cambiar de pestaña. */
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{
    catalog: ManagedCatalog
    noun: string
    item: AdminCatalogItem
  } | null>(null)

  const isReactivosTab = active === REACTIVOS_TAB
  const isDepartmentsTab = active === 'hotel-departments'
  const tab = active === REACTIVOS_TAB ? null : { catalog: active, ...TAB_CONFIG[active] }
  const rows = tab && data ? tab.pick(data) : []
  const visibleRows = rows.filter((row) => matchesSearch(search, row.name))
  /**
   * Departamentos con sus posiciones. La búsqueda entra por los dos lados:
   * un departamento aparece si coincide su nombre (con todas sus posiciones)
   * o si coincide alguna posición (solo esas).
   */
  const sections = (data?.departments ?? [])
    .map((department) => {
      const positions = (data?.positions ?? []).filter(
        (position) => position.hotelDepartmentId === department.id,
      )
      const departmentMatches = matchesSearch(search, department.name)
      const visiblePositions = departmentMatches
        ? positions
        : positions.filter((position) => matchesSearch(search, position.name))
      return { department, positions, visiblePositions, departmentMatches }
    })
    .filter((section) => section.departmentMatches || section.visiblePositions.length > 0)

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
            {' · '}
            <button
              type="button"
              onClick={reopenIntro}
              className="cursor-pointer font-medium text-o-700 hover:underline"
            >
              ¿Cómo funciona?
            </button>
          </p>
        </div>
        {tab && (
          <Button
            variant="primary"
            className="ml-auto"
            onClick={() => {
              setEditor({ catalog: tab.catalog, noun: tab.noun, item: null })
            }}
          >
            Agregar {tab.noun}
          </Button>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Catálogo">
        {TABS.map((item) => (
          <TabButton
            key={item.catalog}
            label={item.label}
            isActive={item.catalog === active}
            onSelect={() => {
              selectTab(item.catalog)
            }}
          />
        ))}
        {/* Los reactivos de auditoría son un catálogo de OTRA naturaleza (más
            campos, dueño conceptual distinto — la auditoría del Supervisor,
            no el alta de personal): el separador dice «esto no es un
            catálogo operativo más», que es justo lo que se perdía cuando
            era el quinto botón idéntico al final de la fila. */}
        <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-line" />
        <TabButton
          label="Reactivos de Auditoría"
          isActive={isReactivosTab}
          onSelect={() => {
            selectTab(REACTIVOS_TAB)
          }}
        />
      </div>

      {isReactivosTab ? (
        <AuditChecklistItemsPanel />
      ) : (
        <>
          <SearchField
            value={search}
            onChange={setSearch}
            label={`Buscar en ${tab?.label ?? ''}`}
            placeholder={tab?.searchPlaceholder ?? ''}
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
          ) : isDepartmentsTab ? (
            data.departments.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
                Todavía no hay departamentos. Agrega el primero con el botón de arriba; las
                posiciones se cuelgan de cada uno.
              </p>
            ) : sections.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
                Ningún departamento ni posición coincide con «{search.trim()}». Cambia la búsqueda o
                agrégala.
              </p>
            ) : (
              <div className="flex flex-col gap-5">
                {sections.map(({ department, positions, visiblePositions }) => (
                  <section key={department.id} aria-labelledby={`dept-${department.id}`}>
                    {/* El departamento es la sección; sus posiciones, las filas. La
                        cabecera lleva las acciones del departamento y el alta de
                        posición ya con el departamento elegido. */}
                    <div className="flex flex-wrap items-center gap-2">
                      <h2
                        id={`dept-${department.id}`}
                        className="text-xs font-bold tracking-wide text-ink-3 uppercase"
                      >
                        {department.name}
                      </h2>
                      <span className="text-xs text-ink-4">
                        {positions.length === 0
                          ? 'sin posiciones'
                          : `${String(positions.length)} ${positions.length === 1 ? 'posición' : 'posiciones'}`}
                      </span>
                      <div className="ml-auto flex items-center gap-1">
                        <Button
                          variant="secondary"
                          className="px-3 py-1 text-xs"
                          onClick={() => {
                            setEditor({
                              catalog: 'positions',
                              noun: 'posición',
                              item: null,
                              presetDepartmentId: department.id,
                            })
                          }}
                        >
                          Agregar posición
                        </Button>
                        <Button
                          variant="secondary"
                          className="px-3 py-1 text-xs"
                          onClick={() => {
                            setEditor({
                              catalog: 'hotel-departments',
                              noun: 'departamento',
                              item: department,
                            })
                          }}
                        >
                          Renombrar
                        </Button>
                        <button
                          type="button"
                          aria-label={`Eliminar ${department.name}`}
                          title="Eliminar departamento"
                          onClick={() => {
                            setPendingDelete({
                              catalog: 'hotel-departments',
                              noun: 'departamento',
                              item: department,
                            })
                          }}
                          className="cursor-pointer rounded-md p-1.5 text-ink-3 transition-colors hover:bg-surface-2 hover:text-red"
                        >
                          <MaterialIcon name="delete" className="text-lg" />
                        </button>
                      </div>
                    </div>

                    {visiblePositions.length === 0 ? (
                      <p className="mt-2 rounded-lg border border-dashed border-line bg-surface px-5 py-4 text-sm text-ink-3">
                        {positions.length === 0
                          ? 'Sin posiciones: mientras no tenga, nadie puede pedir personal de este departamento.'
                          : `Ninguna posición de ${department.name} coincide con «${search.trim()}».`}
                      </p>
                    ) : (
                      <ul className="mt-2 overflow-hidden rounded-lg border border-line bg-surface">
                        {visiblePositions.map((position) => (
                          <li
                            key={position.id}
                            className="flex items-center gap-3 border-b border-line px-5 py-3 last:border-b-0"
                          >
                            <MaterialIcon name="badge" className="text-lg text-ink-4" aria-hidden />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-ink">
                                {position.name}
                              </p>
                              {IS_DEV_UI && (
                                <p className="text-xs">
                                  <code className="text-ink-4">{position.code}</code>
                                </p>
                              )}
                            </div>
                            <Button
                              variant="secondary"
                              onClick={() => {
                                setEditor({
                                  catalog: 'positions',
                                  noun: 'posición',
                                  item: position,
                                })
                              }}
                            >
                              Renombrar
                            </Button>
                            <button
                              type="button"
                              aria-label={`Eliminar ${position.name}`}
                              title="Eliminar posición"
                              onClick={() => {
                                setPendingDelete({
                                  catalog: 'positions',
                                  noun: 'posición',
                                  item: position,
                                })
                              }}
                              className="cursor-pointer rounded-md p-1.5 text-ink-3 transition-colors hover:bg-surface-2 hover:text-red"
                            >
                              <MaterialIcon name="delete" className="text-lg" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                ))}
              </div>
            )
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
                    {IS_DEV_UI && (
                      <p className="text-xs">
                        <code className="text-ink-4">{row.code}</code>
                      </p>
                    )}
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (tab) setEditor({ catalog: tab.catalog, noun: tab.noun, item: row })
                    }}
                  >
                    Renombrar
                  </Button>
                  <button
                    type="button"
                    aria-label={`Eliminar ${row.name}`}
                    title={`Eliminar ${tab?.noun ?? ''}`}
                    onClick={() => {
                      if (tab) setPendingDelete({ catalog: tab.catalog, noun: tab.noun, item: row })
                    }}
                    className="cursor-pointer rounded-md p-1.5 text-ink-3 transition-colors hover:bg-surface-2 hover:text-red"
                  >
                    <MaterialIcon name="delete" className="text-lg" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <Modal
        isOpen={isIntroOpen}
        onClose={dismissIntro}
        title="Cómo funcionan los Catálogos"
        chromeless
        className="max-w-2xl"
      >
        <OnboardingIntro slides={INTRO_SLIDES} startLabel="Ir a Catálogos" onDone={dismissIntro} />
      </Modal>

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

/** Una pestaña de la fila; comparte estilo entre los catálogos operativos y Reactivos. */
function TabButton({
  label,
  isActive,
  onSelect,
}: {
  label: string
  isActive: boolean
  onSelect: () => void
}): ReactNode {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={onSelect}
      className={cn(
        'cursor-pointer rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors',
        isActive
          ? 'border-o-500 bg-o-500 text-ink'
          : 'border-line bg-surface text-ink-2 hover:bg-surface-2',
      )}
    >
      {label}
    </button>
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
  const [departmentId, setDepartmentId] = useState(
    editor.item?.hotelDepartmentId ?? editor.presetDepartmentId ?? '',
  )
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
