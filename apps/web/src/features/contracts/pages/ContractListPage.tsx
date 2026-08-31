import { useEffect, useState, type ReactNode } from 'react'

import { useGetContractsQuery } from '../api/contractsApi'
import { ContractFilters } from '../components/ContractFilters'
import { ContractTable } from '../components/ContractTable'
import { NewContractDialog } from '../components/NewContractDialog'
import type { ContractListFilters } from '../types/contract.types'

import { Button } from '@/shared/components/Button'
import { FoldText } from '@/shared/components/FoldText'
import { LoadError } from '@/shared/components/LoadError'
import { TableSkeleton } from '@/shared/components/TableSkeleton'
import { EXPIRY_WARNING_DAYS } from '@/shared/constants/contractStatus'
import { IS_DEV_UI } from '@/shared/lib/devMode'

const SEARCH_DEBOUNCE_MS = 300

const EMPTY_FILTERS: ContractListFilters = { search: '', status: 'ALL', zoneName: 'ALL' }

export function ContractListPage(): ReactNode {
  const [filters, setFilters] = useState<ContractListFilters>(EMPTY_FILTERS)
  const [isCreating, setIsCreating] = useState(false)
  const [appliedFilters, setAppliedFilters] = useState<ContractListFilters>(EMPTY_FILTERS)
  const [warningDays, setWarningDays] = useState(EXPIRY_WARNING_DAYS)

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedFilters(filters)
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
    }
  }, [filters])

  const { data: list, isLoading, isError, refetch } = useGetContractsQuery(appliedFilters)

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
        warningDays={warningDays}
        onChange={setFilters}
        onWarningDaysChange={setWarningDays}
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
        <TableSkeleton rows={6} columns={6} />
      ) : (
        list && <ContractTable items={list.items} warningDays={warningDays} />
      )}
    </div>
  )
}
