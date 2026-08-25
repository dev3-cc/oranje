import type { GeoPoint } from '@/shared/types/geo.types'

/**
 * Configuración común de los mapas de Google.
 *
 * ⚠ NO SE USA `mapId`, Y ES A PROPÓSITO.
 *
 * Google ignora el array `styles` cuando el mapa arranca con un Map ID: con
 * Map ID el estilo se configura en la consola de GCP y solo ahí. Como el
 * requisito es que el mapa NO muestre comercios ni puntos de interés —solo los
 * hoteles dados de alta— y eso tiene que venir en el código, se renuncia al Map
 * ID. La consecuencia es que tampoco se pueden usar `AdvancedMarker`, que lo
 * exigen: los marcadores son `Marker` clásicos con un ícono SVG.
 *
 * Si algún día se prefiere el estilo en la nube, hay que crear el Map ID,
 * aplicarle allí este mismo ocultamiento y volver a `AdvancedMarker`.
 */

/** Forma mínima de `google.maps.MapTypeStyle` que se usa aquí. */
export interface MapStyleRule {
  featureType?: string
  elementType?: string
  stylers: { visibility: string }[]
}

/**
 * Apaga puntos de interés, comercios, transporte y los iconitos de las
 * carreteras. Se conservan los nombres de calles y colonias: sin ellos el mapa
 * deja de servir para ubicar un hotel.
 */
export const HIDE_POI_MAP_STYLES: MapStyleRule[] = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.attraction', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
]

/**
 * La key es PÚBLICA por diseño (D-17): viaja en el bundle y se protege
 * restringiéndola por referrer HTTP en la consola de GCP.
 */
export const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''

/**
 * Constante de módulo, no estado: no cambia durante la sesión. Por eso los
 * componentes pueden salir temprano según su valor sin romper el orden de los
 * hooks.
 */
export const isMapsEnabled = MAPS_API_KEY !== ''

/** Cancún: de dónde arranca el mapa antes de encuadrar datos reales. */
export const DEFAULT_MAP_CENTER: GeoPoint = { lat: 21.1619, lng: -86.8515 }

export const DEFAULT_MAP_ZOOM = 13

/**
 * Ícono circular como data URI. Se dibuja en SVG en vez de usar una imagen para
 * que el color salga del token del semáforo y no de un archivo por estado.
 */
export function circleMarkerIcon(color: string, sizePx: number): string {
  const radius = sizePx / 2
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${sizePx} ${sizePx}">` +
    `<circle cx="${radius}" cy="${radius}" r="${radius - 2}" fill="${color}" stroke="#ffffff" stroke-width="2"/>` +
    `</svg>`

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}
