import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import type { ReactNode } from 'react'

import { FilterReset } from '@/shared/components/FilterReset'
import { FilterSelect } from '@/shared/components/FilterSelect'

/** El valor de «todos»: sin filtro. */
export const ANY_FILTER = 'ALL'

export interface FilterOption {
  value: string
  label: string
}

export interface FilterControl {
  value: string
  options: FilterOption[]
  onChange: (value: string) => void
}

/**
 * Los filtros de Mensajería, compartidos por Contactos y Campañas: cada
 * pantalla trae SUS opciones (el semáforo del colaborador, el estado de una
 * campaña) y el componente solo pinta los que recibe. Hoy es por estado; el
 * de hotel tiene su hueco, pero queda fuera hasta que el API filtre por hotel
 * (Hugo, 2026-10-23).
 */
export function MessagingFilters({
  status,
  hotel,
}: {
  status?: FilterControl
  hotel?: FilterControl
}): ReactNode {
  const { i18n } = useLingui()
  const active = [status, hotel].filter(
    (control) => control !== undefined && control.value !== ANY_FILTER,
  )

  return (
    <div className="flex flex-wrap items-center gap-2">
      {hotel && (
        <FilterSelect
          label={i18n._(msg`Hotel`)}
          anyLabel={i18n._(msg`Todos los hoteles`)}
          anyValue={ANY_FILTER}
          icon="apartment"
          value={hotel.value}
          options={hotel.options}
          onChange={hotel.onChange}
        />
      )}
      {status && (
        <FilterSelect
          label={i18n._(msg`Estado`)}
          anyLabel={i18n._(msg`Todos los estados`)}
          anyValue={ANY_FILTER}
          icon="traffic"
          value={status.value}
          options={status.options}
          onChange={status.onChange}
        />
      )}
      <FilterReset
        activeCount={active.length}
        onReset={() => {
          status?.onChange(ANY_FILTER)
          hotel?.onChange(ANY_FILTER)
        }}
      />
    </div>
  )
}
