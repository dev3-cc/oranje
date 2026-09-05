import { cn, MaterialIcon } from '@oranje/ui'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'

import { useGlobalSearchQuery, type SearchHit } from '@/app/searchApi'
import { Modal } from '@/shared/components/Modal'
import { SearchField } from '@/shared/components/SearchField'
import { useDebounce } from '@/shared/hooks/useDebounce'

const KIND_ICON: Record<SearchHit['kind'], string> = {
  prospect: 'apartment',
  requisition: 'assignment',
  worker: 'person',
}

const GROUP_LABEL: Record<SearchHit['kind'], string> = {
  prospect: 'Hoteles y prospectos',
  requisition: 'Requisiciones',
  worker: 'Colaboradores',
}

/**
 * La paleta de búsqueda global (Ctrl K). Busca hoteles/prospectos,
 * requisiciones (folio u hotel) y colaboradores, y NAVEGA al elegir —
 * teclado completo: ↑↓ para moverse, Enter para abrir, Escape para cerrar.
 * Cada grupo aparece solo si el rol puede verlo (el 403 lo apaga).
 */
export function GlobalSearch({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}): ReactNode {
  const navigate = useNavigate()
  const [term, setTerm] = useState('')
  const debouncedTerm = useDebounce(term.trim(), 250)
  const [cursor, setCursor] = useState(0)

  const { data, isFetching } = useGlobalSearchQuery(debouncedTerm, {
    skip: !isOpen || debouncedTerm.length < 2,
  })

  const hits = useMemo(
    () => (data ? [...data.prospects, ...data.requisitions, ...data.workers] : []),
    [data],
  )

  useEffect(() => {
    if (!isOpen) {
      setTerm('')
      setCursor(0)
    }
  }, [isOpen])

  useEffect(() => {
    setCursor(0)
  }, [hits])

  function open(hit: SearchHit): void {
    onClose()
    void navigate(hit.to)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (hits.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setCursor((current) => (current + 1) % hits.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setCursor((current) => (current - 1 + hits.length) % hits.length)
    } else if (event.key === 'Enter') {
      const hit = hits[cursor]
      if (hit) {
        event.preventDefault()
        open(hit)
      }
    }
  }

  const groups = (['prospect', 'requisition', 'worker'] as const)
    .map((kind) => ({ kind, items: hits.filter((hit) => hit.kind === kind) }))
    .filter((group) => group.items.length > 0)

  const isSearching = debouncedTerm.length >= 2 && (isFetching || term.trim() !== debouncedTerm)

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Buscar en Oranje" className="max-w-xl">
      <div onKeyDown={onKeyDown} className="flex flex-col gap-3">
        <SearchField
          value={term}
          onChange={setTerm}
          label="Buscar hoteles, requisiciones o colaboradores"
          placeholder="Hotel, folio de requisición o colaborador, p. ej. Xcaret…"
          className="w-full"
          isSearching={isSearching}
        />

        {debouncedTerm.length < 2 && term.trim().length < 2 ? (
          <p className="px-1 text-xs text-ink-3">
            Escribe al menos 2 letras. Navega con ↑ ↓ y abre con Enter.
          </p>
        ) : isSearching && hits.length === 0 ? (
          <p className="px-1 text-sm text-ink-3">Buscando «{term.trim()}»…</p>
        ) : hits.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-ink-3">
            Nada coincide con «{term.trim()}». Prueba con el nombre del hotel, el folio de la
            requisición o el nombre del colaborador.
          </p>
        ) : (
          <ul role="listbox" aria-label="Resultados" className="flex flex-col gap-3">
            {groups.map((group) => (
              <li key={group.kind}>
                <p className="mb-1 px-1 text-xs font-semibold tracking-wide text-ink-3 uppercase">
                  {GROUP_LABEL[group.kind]}
                </p>
                <ul className="flex flex-col gap-1">
                  {group.items.map((hit) => {
                    const index = hits.indexOf(hit)
                    const isActive = index === cursor
                    return (
                      <li key={`${hit.kind}-${hit.id}`}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          onMouseEnter={() => {
                            setCursor(index)
                          }}
                          onClick={() => {
                            open(hit)
                          }}
                          className={cn(
                            'flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                            isActive ? 'bg-o-50' : 'hover:bg-surface-2',
                          )}
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2">
                            <MaterialIcon
                              name={KIND_ICON[hit.kind]}
                              className="text-base text-ink-3"
                              aria-hidden
                            />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-ink">
                              {hit.title}
                            </span>
                            <span className="block truncate text-xs text-ink-3">
                              {hit.subtitle}
                            </span>
                          </span>
                          <MaterialIcon
                            name="arrow_forward"
                            className={cn('text-base', isActive ? 'text-o-700' : 'text-ink-4')}
                            aria-hidden
                          />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
