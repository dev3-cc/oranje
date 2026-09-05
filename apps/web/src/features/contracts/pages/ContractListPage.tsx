import { useMemo, useState, type ReactNode } from 'react'

import { useGetContractsQuery } from '../api/contractsApi'
import { ContractFilters } from '../components/ContractFilters'
import { ContractRowList } from '../components/ContractRowList'
import { NewContractDialog } from '../components/NewContractDialog'
import { ANY_VALUE, type ContractListFilters } from '../types/contract.types'

import { ContractDetailPage } from './ContractDetailPage'

import { Button } from '@/shared/components/Button'
import { CardGridSkeleton } from '@/shared/components/CardGridSkeleton'
import { DetailSkeleton } from '@/shared/components/DetailSkeleton'
import { FoldText } from '@/shared/components/FoldText'
import { LoadError } from '@/shared/components/LoadError'
import { EXPIRY_WARNING_DAYS } from '@/shared/constants/contractStatus'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { IS_DEV_UI } from '@/shared/lib/devMode'

const EMPTY_FILTERS: ContractListFilters = {
  search: '',
  status: ANY_VALUE,
  zoneName: ANY_VALUE,
  expiresInDays: null,
}

export function ContractListPage(): ReactNode {
  const [filters, setFilters] = useState<ContractListFilters>(EMPTY_FILTERS)
  const [isCreating, setIsCreating] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  /** La búsqueda espera a que se deje de teclear; los selects aplican al instante. */
  const search = useDebounce(filters.search)
  const appliedFilters = useMemo(() => ({ ...filters, search }), [filters, search])
  /**
   * El plazo del filtro es también el umbral desde el que el pie de cada
   * renglón grita «vence en N días»: si se piden los que vencen en 180, a
   * todos los que quedan se les cuenta en días.
   */
  const warningDays = filters.expiresInDays ?? EXPIRY_WARNING_DAYS

  const { data: list, isLoading, isError, refetch } = useGetContractsQuery(appliedFilters)
  /** Siempre hay un contrato elegido: el marcado o el primero de la lista filtrada. */
  const selected = list?.items.find((row) => row.id === selectedId) ?? list?.items[0] ?? null

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            <FoldText text="Documentos T&C" />
          </h1>
          <p className="mt-1.5 text-sm text-ink-3">
            {IS_DEV_UI
              ? 'commercial.contract · un contrato por hotel a la vez en ACTIVE'
              : 'Los contratos de cada hotel: solo uno vigente a la vez'}
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => {
            setIsCreating(true)
          }}
        >
          Agregar contrato
        </Button>
      </header>

      <NewContractDialog
        isOpen={isCreating}
        onClose={() => {
          setIsCreating(false)
        }}
      />

      <ContractFilters
        filters={filters}
        zoneNames={list?.zoneNames ?? []}
        onChange={setFilters}
        onReset={() => {
          setFilters(EMPTY_FILTERS)
        }}
      />

      {isError && (
        <LoadError
          message="No se pudieron cargar los contratos. Reintenta en unos segundos."
          onRetry={() => {
            void refetch()
          }}
        />
      )}

      {isLoading && !list ? (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <CardGridSkeleton cards={5} className="grid-cols-1" />
          <DetailSkeleton />
        </div>
      ) : (
        list && (
          /* Lista a la izquierda, el documento con su verificación a la derecha (como Mi Equipo). */
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
            <ContractRowList
              items={list.items}
              warningDays={warningDays}
              selectedId={selected?.id ?? null}
              onSelect={setSelectedId}
            />
            {selected && (
              <ContractDetailPage
                contractId={selected.id}
                embedded
                activeContractNumber={
                  list.items.find(
                    (row) =>
                      row.hotelName === selected.hotelName &&
                      row.status === 'ACTIVE' &&
                      row.id !== selected.id,
                  )?.number ?? null
                }
              />
            )}
          </div>
        )
      )}
    </div>
  )
}
