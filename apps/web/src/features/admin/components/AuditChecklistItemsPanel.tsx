import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd'
import { cn, MaterialIcon, toast } from '@oranje/ui'
import { useState, type ReactNode } from 'react'

// La feature de auditorías es dueña del dominio de este catálogo: se importa
// por su índice público (§4), no hay import profundo que disculpar aquí.
import {
  AUDIT_TYPES,
  useCreateChecklistItemMutation,
  useDeleteChecklistItemMutation,
  useGetChecklistItemsQuery,
  useUpdateChecklistItemMutation,
  type AuditType,
  type ChecklistItem,
} from '@/features/audits'
import { Button } from '@/shared/components/Button'
import { FilterReset } from '@/shared/components/FilterReset'
import { FilterSelect } from '@/shared/components/FilterSelect'
import { LoadError } from '@/shared/components/LoadError'
import { Modal } from '@/shared/components/Modal'
import { SearchField } from '@/shared/components/SearchField'
import { TableSkeleton } from '@/shared/components/TableSkeleton'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { matchesSearch } from '@/shared/lib/text'

const AUDIT_TYPE_LABEL: Record<AuditType, string> = {
  PERSONAL_PRESENTATION: 'Presentación Personal',
  ENVIRONMENT: 'Ambiente y Recursos',
}
const ANY_AUDIT_TYPE = 'ALL'

/** Compuesta: dos auditorías podrían coincidir en el nombre de una categoría sin ser la misma lista. */
function groupKey(auditType: AuditType, category: string): string {
  return `${auditType}::${category}`
}

/**
 * Agrupa por auditoría + categoría, en el orden que cada una tiene guardado
 * (`ordinal`) — salvo que un arrastre reciente en esa categoría todavía no
 * se confirme con el back: mientras tanto manda el orden que se soltó, para
 * que la fila no "rebote" a su posición vieja y luego salte a la nueva.
 */
function groupByCategory(
  items: ChecklistItem[],
  orderOverride: Record<string, string[]>,
): Array<[string, ChecklistItem[]]> {
  const groups = new Map<string, ChecklistItem[]>()
  for (const item of items) {
    const key = groupKey(item.auditType, item.category)
    const list = groups.get(key) ?? []
    list.push(item)
    groups.set(key, list)
  }
  return [...groups.entries()].map(([key, list]) => {
    const override = orderOverride[key]
    if (override === undefined) {
      return [key, [...list].sort((a, b) => a.ordinal - b.ordinal)] as const
    }
    const byId = new Map(list.map((item) => [item.id, item]))
    const ordered = override
      .map((id) => byId.get(id))
      .filter((item): item is ChecklistItem => item !== undefined)
    // Una fila que el override no conoce (alta muy reciente en esta categoría) va al final.
    const knownIds = new Set(override)
    const missing = list.filter((item) => !knownIds.has(item.id))
    return [key, [...ordered, ...missing]] as const
  })
}

interface EditorState {
  /** `null` = alta nueva. */
  item: ChecklistItem | null
  auditType: AuditType
}

/**
 * "Reactivos de Auditoría": el catálogo de `catalogs.audit_checklist_item`,
 * solo del Administrador (`catalogs:manage`, ya validado por la página que
 * lo aloja). Agrupado por auditoría y categoría — así lo pinta el
 * formulario del Supervisor — con el peso como el ÚNICO campo numérico del
 * sistema de catálogos: aquí sí se edita, en ningún otro lado.
 */
export function AuditChecklistItemsPanel(): ReactNode {
  const [auditTypeFilter, setAuditTypeFilter] = useState<AuditType | typeof ANY_AUDIT_TYPE>(
    ANY_AUDIT_TYPE,
  )
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ChecklistItem | null>(null)
  /** Por categoría (`groupKey`): el orden que dejó el último arrastre, mientras el back lo confirma. */
  const [orderOverride, setOrderOverride] = useState<Record<string, string[]>>({})

  const { data, isLoading, isError, refetch } = useGetChecklistItemsQuery()
  const [updateItem] = useUpdateChecklistItemMutation()

  const rows = (data ?? []).filter(
    (item) =>
      (auditTypeFilter === ANY_AUDIT_TYPE || item.auditType === auditTypeFilter) &&
      matchesSearch(search, item.label, item.category),
  )
  const activeFilters =
    (auditTypeFilter === ANY_AUDIT_TYPE ? 0 : 1) + (search.trim() === '' ? 0 : 0)
  /* El arrastre solo tiene sentido sin filtro de texto ni de auditoría: con
     un recorte activo, el índice que suelta el mouse ya no corresponde al
     `ordinal` real (faltan filas de por medio) — se desactiva, no se rompe
     en silencio. */
  const canReorder = search.trim() === '' && auditTypeFilter === ANY_AUDIT_TYPE
  const groupedRows = groupByCategory(rows, orderOverride)

  function handleDragEnd(result: DropResult): void {
    const { source, destination } = result
    if (!destination || destination.droppableId !== source.droppableId) return
    if (destination.index === source.index) return

    const group = groupedRows.find(([key]) => key === source.droppableId)
    if (!group) return
    const [key, items] = group
    const reordered = [...items]
    const [moved] = reordered.splice(source.index, 1)
    if (!moved) return
    reordered.splice(destination.index, 0, moved)

    setOrderOverride((previous) => ({ ...previous, [key]: reordered.map((item) => item.id) }))

    const saves = reordered
      .map((item, index) => ({ item, newOrdinal: index + 1 }))
      .filter(({ item, newOrdinal }) => item.ordinal !== newOrdinal)
      .map(({ item, newOrdinal }) => updateItem({ id: item.id, ordinal: newOrdinal }).unwrap())

    void Promise.all(saves).catch(() => {
      toast.error('No se pudo guardar el nuevo orden: vuelve a intentarlo.')
      setOrderOverride((previous) => {
        const next = { ...previous }
        delete next[key]
        return next
      })
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchField
            value={search}
            onChange={setSearch}
            label="Buscar reactivo"
            placeholder="Texto del reactivo, p. ej. Uniforme…"
            className="w-full max-w-xs"
          />
          <FilterSelect
            label="Auditoría"
            anyLabel="Las dos"
            anyValue={ANY_AUDIT_TYPE}
            value={auditTypeFilter}
            icon="fact_check"
            options={AUDIT_TYPES.map((type) => ({ value: type, label: AUDIT_TYPE_LABEL[type] }))}
            onChange={(value) => {
              setAuditTypeFilter(value as AuditType | typeof ANY_AUDIT_TYPE)
            }}
          />
          <FilterReset
            activeCount={activeFilters}
            onReset={() => {
              setAuditTypeFilter(ANY_AUDIT_TYPE)
            }}
          />
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setEditor({
              item: null,
              auditType:
                auditTypeFilter === ANY_AUDIT_TYPE ? 'PERSONAL_PRESENTATION' : auditTypeFilter,
            })
          }}
        >
          Agregar reactivo
        </Button>
      </div>

      {isError && (
        <LoadError
          message="No se pudieron cargar los reactivos. Reintenta en unos segundos."
          onRetry={() => {
            void refetch()
          }}
        />
      )}

      {isLoading || !data ? (
        <TableSkeleton rows={5} columns={3} />
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
          {data.length === 0
            ? 'Todavía no hay reactivos. Agrega el primero con el botón de arriba.'
            : `Ningún reactivo coincide con lo que buscas. Cambia el filtro o la búsqueda.`}
        </p>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex flex-col gap-5">
            {groupedRows.map(([key, items]) => (
              <section key={key}>
                <h3 className="text-xs font-bold tracking-wide text-ink-3 uppercase">
                  {AUDIT_TYPE_LABEL[items[0]!.auditType]} · {items[0]!.category}
                </h3>
                <Droppable droppableId={key} isDropDisabled={!canReorder}>
                  {(provided) => (
                    <ul
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="mt-2 overflow-hidden rounded-lg border border-line bg-surface"
                    >
                      {items.map((item, index) => (
                        <Draggable
                          key={item.id}
                          draggableId={item.id}
                          index={index}
                          isDragDisabled={!canReorder}
                        >
                          {(dragProvided, dragSnapshot) => (
                            <li
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              className={cn(
                                'flex items-center gap-3 border-b border-line bg-surface px-4 py-2.5 last:border-b-0',
                                dragSnapshot.isDragging && 'shadow-lg',
                              )}
                            >
                              {/* Sin manija cuando hay filtro activo: el índice del
                                  arrastre dejaría de corresponder al orden real. */}
                              <span
                                {...dragProvided.dragHandleProps}
                                title={
                                  canReorder
                                    ? 'Arrastra para cambiar el orden'
                                    : 'Quita el filtro para reordenar'
                                }
                                className={cn(
                                  'shrink-0 text-ink-4',
                                  canReorder
                                    ? 'cursor-grab text-ink-3'
                                    : 'cursor-not-allowed opacity-40',
                                )}
                              >
                                <MaterialIcon name="drag_indicator" className="text-lg" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-ink">
                                  {item.label}
                                </p>
                                {IS_DEV_UI && (
                                  <code className="text-xs text-ink-4">
                                    catalogs.audit_checklist_item
                                  </code>
                                )}
                              </div>
                              <span
                                title="Peso en el promedio ponderado del score"
                                className="shrink-0 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink-2"
                              >
                                Peso {item.weight}
                              </span>
                              <Button
                                variant="secondary"
                                onClick={() => {
                                  setEditor({ item, auditType: item.auditType })
                                }}
                              >
                                Editar
                              </Button>
                              <button
                                type="button"
                                aria-label={`Eliminar ${item.label}`}
                                title="Eliminar reactivo"
                                onClick={() => {
                                  setPendingDelete(item)
                                }}
                                className="cursor-pointer rounded-md p-1.5 text-ink-3 transition-colors hover:bg-surface-2 hover:text-red"
                              >
                                <MaterialIcon name="delete" className="text-lg" />
                              </button>
                            </li>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </ul>
                  )}
                </Droppable>
              </section>
            ))}
          </div>
        </DragDropContext>
      )}

      {editor !== null && (
        <ChecklistItemDialog
          editor={editor}
          existingItems={data ?? []}
          onClose={() => {
            setEditor(null)
          }}
        />
      )}
      {pendingDelete !== null && (
        <DeleteChecklistItemDialog
          item={pendingDelete}
          onClose={() => {
            setPendingDelete(null)
          }}
        />
      )}
    </div>
  )
}

function ChecklistItemDialog({
  editor,
  existingItems,
  onClose,
}: {
  editor: EditorState
  /** Todos los reactivos (sin filtrar): de aquí sale el ordinal automático al crear. */
  existingItems: ChecklistItem[]
  onClose: () => void
}): ReactNode {
  const [category, setCategory] = useState(editor.item?.category ?? '')
  const [label, setLabel] = useState(editor.item?.label ?? '')
  const [weight, setWeight] = useState(editor.item?.weight ?? '1.00')
  const [error, setError] = useState<string | null>(null)

  const [createItem, { isLoading: isCreating }] = useCreateChecklistItemMutation()
  const [updateItem, { isLoading: isUpdating }] = useUpdateChecklistItemMutation()
  const isBusy = isCreating || isUpdating

  const weightNumber = Number(weight)
  const canSave =
    category.trim() !== '' &&
    label.trim() !== '' &&
    Number.isFinite(weightNumber) &&
    weightNumber > 0

  async function save(): Promise<void> {
    setError(null)
    try {
      if (editor.item === null) {
        const trimmedCategory = category.trim()
        /* El orden ya no se captura a mano (regla de Hugo: se ve y se
           arrastra en la lista, con el mismo patrón del Pipeline) — un
           reactivo nuevo entra al final de SU categoría. */
        const siblingCount = existingItems.filter(
          (item) => item.auditType === editor.auditType && item.category === trimmedCategory,
        ).length
        await createItem({
          auditType: editor.auditType,
          category: trimmedCategory,
          label: label.trim(),
          weight: weightNumber,
          ordinal: siblingCount + 1,
        }).unwrap()
        toast.success(`Se agregó «${label.trim()}»`)
      } else {
        await updateItem({
          id: editor.item.id,
          category: category.trim(),
          label: label.trim(),
          weight: weightNumber,
        }).unwrap()
        toast.success('Reactivo actualizado')
      }
      onClose()
    } catch (saveError) {
      setError(
        apiErrorMessage(saveError, {
          byCode: {
            CHECKLIST_ITEM_NAME_TAKEN: 'Ya existe un reactivo con ese texto en esta auditoría.',
          },
          fallback: 'No se pudo guardar. Revisa los campos e inténtalo de nuevo.',
        }),
      )
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={editor.item === null ? 'Agregar reactivo' : 'Editar reactivo'}
      description={AUDIT_TYPE_LABEL[editor.auditType]}
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
        <span className="text-sm font-medium text-ink-2">Categoría</span>
        <input
          value={category}
          onChange={(event) => {
            setCategory(event.target.value)
          }}
          maxLength={80}
          placeholder="P. ej. Uniformidad"
          className="rounded-md border border-line bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink-4 focus:border-o-500 focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink-2">Texto del reactivo</span>
        <input
          value={label}
          onChange={(event) => {
            setLabel(event.target.value)
          }}
          maxLength={300}
          placeholder="P. ej. Uniforme completo, limpio y planchado"
          className="rounded-md border border-line bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink-4 focus:border-o-500 focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink-2">Peso</span>
        <input
          type="number"
          min={0.01}
          step={0.01}
          value={weight}
          onChange={(event) => {
            setWeight(event.target.value)
          }}
          className="w-32 rounded-md border border-line bg-surface px-4 py-2.5 text-sm text-ink focus:border-o-500 focus:outline-none"
        />
      </label>
      {editor.item === null && (
        <p className="text-xs text-ink-3">
          El orden dentro de su categoría se define arrastrando la fila en la lista, después de
          guardar.
        </p>
      )}

      {error !== null && (
        <p role="alert" className="rounded-md bg-red/10 px-3 py-2 text-sm text-red">
          {error}
        </p>
      )}
    </Modal>
  )
}

function DeleteChecklistItemDialog({
  item,
  onClose,
}: {
  item: ChecklistItem
  onClose: () => void
}): ReactNode {
  const [error, setError] = useState<string | null>(null)
  const [deleteItem, { isLoading }] = useDeleteChecklistItemMutation()

  async function remove(): Promise<void> {
    setError(null)
    try {
      await deleteItem(item.id).unwrap()
      toast.success(`Se eliminó «${item.label}»`)
      onClose()
    } catch (deleteError) {
      setError(
        apiErrorMessage(deleteError, {
          byCode: {
            CATALOG_IN_USE: 'Hay auditorías con respuestas a este reactivo: no se puede eliminar.',
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
      title="Eliminar reactivo"
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
        «{item.label}» se elimina de verdad. Si alguna auditoría ya lo contestó, el sistema lo va a
        impedir y te lo dice aquí.
      </p>
      {error !== null && (
        <p role="alert" className="rounded-md bg-red/10 px-3 py-2 text-sm text-red">
          {error}
        </p>
      )}
    </Modal>
  )
}
