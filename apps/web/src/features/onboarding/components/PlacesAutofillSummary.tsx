import { cn } from '@oranje/ui'
import type { ReactNode } from 'react'

import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import {
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
  type OnboardingStatus,
} from '@/shared/constants/onboardingStatus'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import type { GeoPoint } from '@/shared/types/geo.types'

/**
 * Un campo del resumen: relleno o pendiente de decidir a mano. La etiqueta es
 * para personas; el nombre de columna solo acompaña en dev local.
 */
function AutofillRow({
  label,
  column,
  value,
  isFilled,
}: {
  label: string
  column: string
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
        {label}
        {IS_DEV_UI && <code className="text-xs text-ink-4">{column}</code>}
      </span>
      <span className="text-right text-sm text-ink-3">{value}</span>
    </li>
  )
}

const EMPTY = '—'

/**
 * Qué quedó relleno y qué falta, DEBAJO del mapa y dentro de su misma tarjeta:
 * hablan del mismo hotel, así que separarlas en dos recuadros sugería que eran
 * cosas distintas.
 *
 * Existe para hacer visible una diferencia que importa: Google sabe el nombre,
 * la dirección, el teléfono y hasta la foto, pero NO conoce las zonas
 * comerciales de Oranje — esa siempre se elige a mano.
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
  photoUrl = null,
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
  /** Foto del lugar según Google. Solo se muestra; no se persiste (aún). */
  photoUrl?: string | null
}): ReactNode {
  const coordinates = location
    ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
    : 'aún sin pin'

  return (
    <div className={cn('p-4', className)}>
      {photoUrl && (
        /**
         * Hero con fundido: la foto sangra a todo lo ancho de la tarjeta
         * (márgenes negativos contra el p-4) y se disuelve hacia la superficie,
         * para que el nombre se lea SOBRE el final de la imagen.
         */
        <div className="relative -mx-4 -mt-4 mb-3">
          <img
            src={photoUrl}
            alt={`Foto de ${hotelName || 'el hotel'} según Google`}
            loading="lazy"
            className="h-36 w-full object-cover"
          />
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent via-surface/85 to-surface"
          />
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-ink">{hotelName || 'Hotel sin nombre'}</h3>
        <StatusLightSoftBadge
          token={ONBOARDING_STATUS_TOKEN[status]}
          label={ONBOARDING_STATUS_LABEL[status]}
        />
      </div>
      <p className="mt-1 text-sm text-ink-3">{address || 'Sin dirección todavía'}</p>

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
          {location
            ? isPinMoved
              ? 'Pin ajustado a mano'
              : 'Pin en el punto exacto de Google'
            : 'Busca el hotel o marca el punto en el mapa'}
        </span>
        <span className="text-sm text-ink-3">{coordinates}</span>
      </div>

      <h4 className="mt-4 text-sm font-semibold text-ink">Lo que Google llenó por ti</h4>
      <ul className="mt-2.5 flex flex-col gap-2">
        <AutofillRow
          label="Nombre"
          column="name"
          value={hotelName || EMPTY}
          isFilled={hotelName !== ''}
        />
        <AutofillRow
          label="Teléfono"
          column="general_phone"
          value={generalPhone || EMPTY}
          isFilled={generalPhone !== ''}
        />
        <AutofillRow
          label="Ubicación"
          column="coordinates"
          value={coordinates}
          isFilled={location !== null}
        />
        <AutofillRow
          label="Zona horaria"
          column="time_zone"
          value={timeZone || EMPTY}
          isFilled={timeZone !== ''}
        />
        <AutofillRow
          label="Zona comercial"
          column="zone_id"
          value="la eliges tú — Google no la conoce"
          isFilled={false}
        />
      </ul>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-md bg-o-50 px-3 py-2">
        <span className="text-sm font-semibold text-o-700">Geocerca</span>
        <span className="text-sm font-semibold text-o-700">{geofenceMeters} m</span>
      </div>
    </div>
  )
}
