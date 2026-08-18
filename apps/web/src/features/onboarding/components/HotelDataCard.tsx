import type { ReactNode } from 'react'

import type { HotelData } from '../types/prospect.types'

import { SectionCard } from '@/shared/components/SectionCard'
import { formatDate } from '@/shared/lib/formatters'

/** Guion largo para el dato ausente: una celda vacía se lee como error de carga. */
const EMPTY_VALUE = '—'

/**
 * Datos del hotel, en solo lectura.
 *
 * La edición ya no vive aquí: el lápiz del encabezado de la ficha abre el mismo
 * modal que da de alta un prospecto, para no tener dos formularios distintos
 * sobre los mismos campos.
 */
export function HotelDataCard({
  hotel,
  needDescription,
}: {
  hotel: HotelData
  needDescription: string
}): ReactNode {
  const rows: { label: string; value: string }[] = [
    { label: 'Dirección', value: hotel.address || EMPTY_VALUE },
    { label: 'Teléfono general', value: hotel.generalPhone },
    { label: 'Zona', value: hotel.zone },
    { label: 'Zona horaria', value: hotel.timeZone },
    { label: 'Geocerca', value: `${hotel.geofenceMeters} m` },
    {
      label: 'Ubicación',
      value: hotel.location
        ? `${hotel.location.lat.toFixed(5)}, ${hotel.location.lng.toFixed(5)}`
        : EMPTY_VALUE,
    },
    { label: 'Qué necesita', value: needDescription || EMPTY_VALUE },
    {
      label: 'Activado como cliente',
      value: hotel.activatedAsClientAt ? formatDate(hotel.activatedAsClientAt) : EMPTY_VALUE,
    },
  ]

  return (
    <SectionCard title="Datos del hotel">
      <dl className="flex flex-col gap-3.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-6">
            <dt className="text-sm text-ink-3">{row.label}</dt>
            <dd className="text-right text-sm text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  )
}
