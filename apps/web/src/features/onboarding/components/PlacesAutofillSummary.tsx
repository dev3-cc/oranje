import { cn } from '@oranje/ui'
import type { ReactNode } from 'react'

import { SemaforoSoftBadge } from '@/shared/components/SemaforoSoftBadge'
import {
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
  type OnboardingStatus,
} from '@/shared/constants/onboardingStatus'
import type { GeoPoint } from '@/shared/types/geo.types'

/** Un campo del resumen: relleno o pendiente de decidir a mano. */
function AutofillRow({
  label,
  value,
  isFilled,
}: {
  label: string
  value: string
  isFilled: boolean
}): ReactNode {
  return (
    <li className="flex items-baseline justify-between gap-4">
      <span className="flex items-center gap-2 text-sm text-ink">
        <span
          className={cn(
            'size-2 shrink-0 rounded-full',
            isFilled ? 'bg-green' : 'border border-ink-4',
          )}
          aria-hidden
        />
        <code className="font-sans">{label}</code>
      </span>
      <span className="text-right text-sm text-ink-3">{value}</span>
    </li>
  )
}

const PENDING = 'catálogo Oranje — se elige a mano'
const EMPTY = '—'

/**
 * Qué quedó relleno y qué falta, DEBAJO del mapa y dentro de su misma tarjeta:
 * hablan del mismo hotel, así que separarlas en dos recuadros sugería que eran
 * cosas distintas.
 *
 * Existe para hacer visible una diferencia que importa: Places sabe el nombre,
 * la dirección y el teléfono, pero NO conoce las zonas comerciales de Oranje.
 * `zone_id` sale de un catálogo propio y siempre se elige a mano.
 */
export function PlacesAutofillSummary({
  className,
  hotelName,
  address,
  generalPhone,
  timeZone,
  location,
  geofenceMeters,
  status,
  isPinMoved,
}: {
  className?: string
  hotelName: string
  address: string
  generalPhone: string
  timeZone: string
  location: GeoPoint | null
  geofenceMeters: number
  status: OnboardingStatus
  /** El pin se movió después de elegir el sitio: la coordenada ya no es la de Google. */
  isPinMoved: boolean
}): ReactNode {
  const coordinates = location
    ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
    : 'Sin ubicación'

  return (
    <div className={cn('p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-ink">{hotelName || 'Hotel sin nombre'}</h3>
        <SemaforoSoftBadge
          token={ONBOARDING_STATUS_TOKEN[status]}
          label={ONBOARDING_STATUS_LABEL[status]}
        />
      </div>
      <p className="mt-1 text-sm text-ink-3">{address || 'Sin dirección'}</p>

      <div
        className={cn(
          'mt-4 flex items-center justify-between gap-3 rounded-md px-3 py-2',
          isPinMoved ? 'bg-o-50' : 'bg-surface-2',
        )}
      >
        <span className="flex items-center gap-2 text-sm text-ink-2">
          <span
            className={cn('size-2 shrink-0 rounded-full', isPinMoved ? 'bg-o-500' : 'bg-ink-4')}
            aria-hidden
          />
          {isPinMoved ? 'Pin movido a mano' : 'Pin en el punto de Google'}
        </span>
        <span className="text-sm text-ink-3">{coordinates}</span>
      </div>

      <h4 className="mt-4 text-sm font-semibold text-ink">Lo que Places autollena</h4>
      <ul className="mt-2.5 flex flex-col gap-2">
        <AutofillRow label="name" value={hotelName || EMPTY} isFilled={hotelName !== ''} />
        <AutofillRow
          label="general_phone"
          value={generalPhone || EMPTY}
          isFilled={generalPhone !== ''}
        />
        <AutofillRow label="coordinates" value={coordinates} isFilled={location !== null} />
        <AutofillRow label="time_zone" value={timeZone || EMPTY} isFilled={timeZone !== ''} />
        <AutofillRow label="zone_id" value={PENDING} isFilled={false} />
      </ul>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-md bg-o-50 px-3 py-2">
        <span className="text-sm font-semibold text-o-700">Geocerca</span>
        <span className="text-sm font-semibold text-o-700">{geofenceMeters} m</span>
      </div>
    </div>
  )
}
