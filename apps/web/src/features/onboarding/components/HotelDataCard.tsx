import { Trans, useLingui } from '@lingui/react/macro'
import type { ReactNode } from 'react'

import type { HotelData } from '../types/prospect.types'

import { HotelLocationMap } from './HotelLocationMap'

import { MapsScope } from '@/shared/components/MapsScope'
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
  const { t } = useLingui()
  const rows: { label: string; value: string }[] = [
    { label: t`Dirección`, value: hotel.address || EMPTY_VALUE },
    { label: t`Teléfono general`, value: hotel.generalPhone },
    { label: t`Zona`, value: hotel.zone },
    { label: t`Zona horaria`, value: hotel.timeZone },
    { label: t`Geocerca`, value: `${hotel.geofenceMeters} m` },
    { label: t`Qué necesita`, value: needDescription || EMPTY_VALUE },
    {
      label: t`Activado como cliente`,
      value: hotel.activatedAsClientAt ? formatDate(hotel.activatedAsClientAt) : EMPTY_VALUE,
    },
  ]

  return (
    <SectionCard title={t`Datos del hotel`}>
      <dl className="flex flex-col gap-3.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-6">
            <dt className="text-sm text-ink-3">{row.label}</dt>
            <dd className="text-right text-sm text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>

      {/* La ubicación como mapa y no como par de coordenadas: «21.16132,
          -86.80791» no le dice nada a nadie, y lo que de verdad importa —dónde
          cae la geocerca del ponche— solo se ve dibujado. */}
      {hotel.location ? (
        <div className="mt-4">
          <p className="mb-2 text-sm text-ink-3">
            <Trans>Ubicación</Trans>
          </p>
          {/* El mapa necesita el contexto de Google Maps cargado: aquí no
              llega desde arriba como en el modal de alta, así que la tarjeta
              trae el suyo. Sin él, `<Map>` revienta la pantalla entera. */}
          <MapsScope>
            <HotelLocationMap
              value={hotel.location}
              geofenceMeters={hotel.geofenceMeters}
              onMovePin={() => undefined}
              readOnly
              className="h-56"
            />
          </MapsScope>
        </div>
      ) : (
        <div className="mt-4 flex items-baseline justify-between gap-6">
          <p className="text-sm text-ink-3">
            <Trans>Ubicación</Trans>
          </p>
          <p className="text-sm text-ink">{EMPTY_VALUE}</p>
        </div>
      )}
    </SectionCard>
  )
}
