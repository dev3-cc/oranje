import { useEffect, useState, type ReactNode } from 'react'

import { useGetContractsQuery } from '../api/contractsApi'
import { ContractFilters } from '../components/ContractFilters'
import { ContractTable } from '../components/ContractTable'
import type { ContractListFilters } from '../types/contract.types'

import { Button } from '@/shared/components/Button'
import { EXPIRY_WARNING_DAYS } from '@/shared/constants/contractStatus'

/** Cuánto se espera a que alguien deje de teclear antes de preguntar al servidor. */
const SEARCH_DEBOUNCE_MS = 300

const EMPTY_FILTERS: ContractListFilters = { search: '', status: 'ALL', zoneName: 'ALL' }

/**
 * Documentos T&C: los contratos comerciales, uno por hotel.
 *
 * El filtro viaja al servidor, así que la búsqueda se retrasa hasta que quien
 * escribe se detiene: sin eso, «Puerto Real» serían once peticiones y la última
 * en contestar no tiene por qué ser la del texto completo.
 */
export function ContractListPage(): ReactNode {
  const [filters, setFilters] = useState<ContractListFilters>(EMPTY_FILTERS)
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

  const { data: list, isLoading, isError } = useGetContractsQuery(appliedFilters)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Documentos T&amp;C</h1>
          <p className="mt-1.5 text-sm text-ink-3">
            commercial.contract · un contrato por hotel a la vez en ACTIVE
          </p>
        </div>

        {/* Pendiente: falta el diseño del alta de contrato */}
        <Button variant="primary" disabled title="Pendiente: falta el diseño del alta">
          + Nuevo contrato
        </Button>
      </header>

      <ContractFilters
        filters={filters}
        zoneNames={list?.zoneNames ?? []}
        warningDays={warningDays}
        onChange={setFilters}
        onWarningDaysChange={setWarningDays}
      />

      {isError && (
        <p className="rounded-lg border border-line bg-surface p-6 text-sm text-red">
          No se pudieron cargar los contratos. Reintenta en unos segundos.
        </p>
      )}

      {isLoading && !list ? (
        <p className="text-sm text-ink-3">Cargando contratos…</p>
      ) : (
        list && <ContractTable items={list.items} warningDays={warningDays} />
      )}
    </div>
  )
}
