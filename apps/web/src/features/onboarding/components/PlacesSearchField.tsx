import { MaterialIcon } from '@oranje/ui'
import { useMapsLibrary } from '@vis.gl/react-google-maps'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { isMapsEnabled } from '@/shared/constants/googleMaps'
import type { GeoPoint } from '@/shared/types/geo.types'

/** Lo que Places puede autollenar de un sitio. */
export interface PlaceAutofill {
  name: string
  address: string
  phone: string
  location: GeoPoint
  /**
   * Foto del lugar servida por Google. SOLO sirve de preview en la sesión:
   * `getUrl()` devuelve una URL con token efímero que muere en horas — se
   * guardó una vez y el Pipeline quedó lleno de 403. Lo que se persiste es
   * el `placeId`, y el back resuelve la foto estable con él.
   */
  photoUrl: string | null
  /** Estable: con él el back resuelve la foto y lo que Places sepa del sitio. */
  placeId: string | null
}

const CONTROL_CLASS =
  'w-full rounded-md border bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-4 focus:outline-none disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-2'

/**
 * ⚠ Superficie mínima de la librería `places`.
 *
 * `@types/google.maps` llega como dependencia transitiva de la librería de
 * mapas y con pnpm sin hoisting no se resuelve desde `apps/web`, así que los
 * tipos quedan sin resolver. Se declara lo poco que se consume y se convierte
 * en el borde, en vez de apagar las reglas de seguridad de tipos.
 */
interface PlacesLibrary {
  Autocomplete: new (
    input: HTMLInputElement,
    options?: {
      fields?: string[]
      componentRestrictions?: { country: string | string[] }
    },
  ) => {
    addListener: (event: string, handler: () => void) => { remove: () => void }
    getPlace: () => {
      name?: string
      formatted_address?: string
      formatted_phone_number?: string
      place_id?: string
      geometry?: { location?: { lat: () => number; lng: () => number } }
      photos?: Array<{ getUrl: (opts?: { maxWidth?: number; maxHeight?: number }) => string }>
    }
  }
}

function PlacesAutocompleteInput({
  defaultValue,
  onPick,
}: {
  defaultValue: string
  onPick: (place: PlaceAutofill) => void
}): ReactNode {
  const places = useMapsLibrary('places') as PlacesLibrary | null
  const inputRef = useRef<HTMLInputElement>(null)

  /**
   * El callback en una ref y NO en las dependencias del efecto: si entrara,
   * cada render del formulario destruiría el autocompletado y crearía otro
   * sobre el mismo input, cerrando el desplegable al escribir.
   */
  const onPickRef = useRef(onPick)
  useEffect(() => {
    onPickRef.current = onPick
  }, [onPick])

  useEffect(() => {
    const input = inputRef.current
    if (!places?.Autocomplete || !input) return undefined

    const autocomplete = new places.Autocomplete(input, {
      /** `geometry` a secas: `geometry.location` no es un campo válido aquí. */
      fields: [
        'name',
        'formatted_address',
        'formatted_phone_number',
        'place_id',
        'geometry',
        'photos',
      ],
      /** Los hoteles cliente operan en EE. UU. y el arranque fue en México. */
      componentRestrictions: { country: ['us', 'mx'] },
    })

    const listener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      const location = place.geometry?.location
      if (!location) return

      onPickRef.current({
        name: place.name ?? '',
        address: place.formatted_address ?? '',
        phone: place.formatted_phone_number ?? '',
        location: { lat: location.lat(), lng: location.lng() },
        photoUrl: place.photos?.[0]?.getUrl({ maxWidth: 640 }) ?? null,
        placeId: place.place_id ?? null,
      })
    })

    return () => {
      listener.remove()
      // Google monta el desplegable en <body>, fuera de React.
      for (const node of document.querySelectorAll('.pac-container')) node.remove()
    }
  }, [places])

  const [hasText, setHasText] = useState(defaultValue !== '')

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        defaultValue={defaultValue}
        disabled={!places?.Autocomplete}
        /** El autocompletado del navegador tapa el de Google. */
        autoComplete="off"
        onKeyDown={(event) => {
          /** Enter elige la sugerencia; si no, enviaría el formulario a medias. */
          if (event.key === 'Enter') event.preventDefault()
        }}
        onInput={(event) => {
          setHasText(event.currentTarget.value !== '')
        }}
        placeholder={places ? 'Busca el hotel o su dirección…' : 'Buscador no disponible'}
        aria-label="Buscar la ubicación del hotel"
        className={`${CONTROL_CLASS} border-o-500 pr-11`}
      />
      {hasText && (
        <button
          type="button"
          aria-label="Borrar la búsqueda"
          onClick={() => {
            const input = inputRef.current
            if (!input) return
            input.value = ''
            setHasText(false)
            input.focus()
          }}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-ink-3 transition-colors hover:text-ink"
        >
          <MaterialIcon name="close" className="text-lg" />
        </button>
      )}
    </div>
  )
}

/**
 * Buscador de direcciones. Va en la columna del formulario, junto al resto de
 * los campos del edificio; el mapa vive aparte, en la otra columna.
 *
 * ⚠ Requiere la **Places API** habilitada en GCP, que es distinta de Maps
 * JavaScript API. Sin ella el campo queda deshabilitado y la ubicación se sigue
 * pudiendo marcar en el mapa, que es lo que de verdad fija la coordenada.
 */
export function PlacesSearchField({
  defaultValue,
  onPick,
}: {
  defaultValue: string
  onPick: (place: PlaceAutofill) => void
}): ReactNode {
  if (!isMapsEnabled) {
    return (
      <input
        type="text"
        disabled
        placeholder="Buscador no disponible: falta la API key de Google Maps"
        aria-label="Buscar la ubicación del hotel"
        className={`${CONTROL_CLASS} border-line`}
      />
    )
  }

  return <PlacesAutocompleteInput defaultValue={defaultValue} onPick={onPick} />
}
