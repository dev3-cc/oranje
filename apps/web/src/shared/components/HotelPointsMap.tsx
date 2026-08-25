import { cn } from '@oranje/ui'
import { APIProvider, Circle, Map, Marker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps'
import { useEffect, useMemo, type ReactNode } from 'react'

import { MissingMapsKeyNotice } from './MissingMapsKeyNotice'

import {
  circleMarkerIcon,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  HIDE_POI_MAP_STYLES,
  isMapsEnabled,
  MAPS_API_KEY,
} from '@/shared/constants/googleMaps'
import type { GeoPoint } from '@/shared/types/geo.types'

/** Zoom cuando solo hay un punto: encuadrar uno solo daría el zoom máximo. */
const SINGLE_POINT_ZOOM = 15

const BOUNDS_PADDING_PX = 96

const MARKER_SIZE_PX = 16
const SELECTED_MARKER_SIZE_PX = 32

interface MapBoundsLiteral {
  north: number
  south: number
  east: number
  west: number
}

/**
 * ⚠ Superficie mínima de `google.maps.Map` que consumen estas pantallas.
 *
 * `@types/google.maps` llega como dependencia TRANSITIVA de la librería y, con
 * pnpm sin hoisting, no se resuelve desde `apps/web`. `skipLibCheck` esconde el
 * fallo y el tipo queda sin resolver, así que el linter marca cada acceso como
 * inseguro. Se declara lo poco que se usa y se hace UNA conversión en el borde.
 */
interface MapViewport {
  setCenter: (point: GeoPoint) => void
  setZoom: (zoom: number) => void
  fitBounds: (bounds: MapBoundsLiteral, padding: number) => void
}

/** Constructores de `google.maps.core` que hacen falta para anclar el ícono. */
interface CoreLibrary {
  Point: new (x: number, y: number) => object
  Size: new (width: number, height: number) => object
}

/** Un hotel en el mapa. El color ya viene resuelto: qué significa lo decide cada pantalla. */
export interface HotelMapPoint {
  id: string
  title: string
  location: GeoPoint
  color: string
  /**
   * Radio de la geocerca en metros. Solo se dibuja el del punto seleccionado:
   * con todos a la vez, cinco círculos superpuestos tapan el mapa que se quería
   * ver. Los puntos sin radio simplemente no lo pintan.
   */
  radiusM?: number | undefined
}

/** Encuadra el mapa sobre los puntos visibles y lo reencuadra al filtrar. */
function FitToPoints({ points }: { points: GeoPoint[] }): null {
  const map = useMap() as MapViewport | null

  useEffect(() => {
    if (!map || points.length === 0) return

    const [first] = points
    if (points.length === 1 && first) {
      map.setCenter(first)
      map.setZoom(SINGLE_POINT_ZOOM)
      return
    }

    const latitudes = points.map((point) => point.lat)
    const longitudes = points.map((point) => point.lng)

    map.fitBounds(
      {
        north: Math.max(...latitudes),
        south: Math.min(...latitudes),
        east: Math.max(...longitudes),
        west: Math.min(...longitudes),
      },
      BOUNDS_PADDING_PX,
    )
  }, [map, points])

  return null
}

/**
 * Marcadores. Va en su propio componente porque `useMapsLibrary` solo funciona
 * dentro del `APIProvider`.
 *
 * Son `Marker` clásicos y no `AdvancedMarker`: estos últimos exigen un Map ID, y
 * con Map ID Google ignora los estilos que apagan los comercios. Ver
 * `shared/constants/googleMaps.ts`.
 */
function PointMarkers({
  points,
  selectedId,
  onSelect,
}: {
  points: HotelMapPoint[]
  selectedId: string | null
  onSelect: (id: string) => void
}): ReactNode {
  const core = useMapsLibrary('core') as CoreLibrary | null

  // Hasta que carga la librería no se puede anclar el ícono en su centro.
  if (!core) return null

  return (
    <>
      {points.map((point) => {
        const isSelected = point.id === selectedId
        const size = isSelected ? SELECTED_MARKER_SIZE_PX : MARKER_SIZE_PX

        return (
          <Marker
            key={point.id}
            position={point.location}
            title={point.title}
            zIndex={isSelected ? 2 : 1}
            onClick={() => {
              onSelect(point.id)
            }}
            icon={{
              url: circleMarkerIcon(point.color, size),
              scaledSize: new core.Size(size, size),
              // Centrado en la coordenada: por defecto se ancla abajo.
              anchor: new core.Point(size / 2, size / 2),
            }}
          />
        )
      })}
    </>
  )
}

/**
 * Mapa de hoteles con selección.
 *
 * Vive en `shared` porque lo usan Mi Territorio y Clientes Activos, y §4 no
 * deja que una feature importe de otra. Lo que cambia entre pantallas —qué
 * significa cada color y qué se pinta encima— entra por props: el color viene
 * resuelto en cada punto y lo superpuesto va como `children`.
 */
export function HotelPointsMap({
  points,
  selectedId,
  onSelect,
  children,
  className,
}: {
  points: HotelMapPoint[]
  selectedId: string | null
  onSelect: (id: string) => void
  /** Lo que se dibuja encima del mapa: la ficha del seleccionado, la leyenda. */
  children?: ReactNode
  /** `| undefined` explícito: con `exactOptionalPropertyTypes` no basta el `?`. */
  className?: string | undefined
}): ReactNode {
  // Sin memo, el array nuevo de cada render reencuadraría el mapa sin parar.
  const locations = useMemo(() => points.map((point) => point.location), [points])

  const selectedPoint = points.find((point) => point.id === selectedId) ?? null

  return (
    <section
      className={cn(
        'relative min-h-[26rem] overflow-hidden rounded-lg border border-line bg-surface-3',
        className,
      )}
    >
      {!isMapsEnabled ? (
        <MissingMapsKeyNotice />
      ) : (
        <>
          <APIProvider apiKey={MAPS_API_KEY}>
            <Map
              defaultCenter={DEFAULT_MAP_CENTER}
              defaultZoom={DEFAULT_MAP_ZOOM}
              gestureHandling="greedy"
              disableDefaultUI
              clickableIcons={false}
              styles={HIDE_POI_MAP_STYLES}
              /*
                `absolute inset-0` y NO `size-full`.
                Con `height: 100%` el mapa depende de que el padre tenga altura
                definida: en Mi Territorio la tiene, porque es un renglón de
                grid estirado, pero en Clientes la columna es `items-start`
                —hace falta para que el mapa se quede pegado al hacer scroll— y
                ahí el padre solo tiene `min-height`. Contra eso, el 100% se
                resuelve como `auto` y el mapa mide cero: existe, carga y no se
                ve. Posicionándolo contra la sección, que es `relative`, llena
                el hueco venga la altura de donde venga.
              */
              className="absolute inset-0"
            >
              <FitToPoints points={locations} />

              {selectedPoint?.radiusM !== undefined && (
                <Circle
                  center={selectedPoint.location}
                  radius={selectedPoint.radiusM}
                  strokeColor={selectedPoint.color}
                  strokeOpacity={0.9}
                  strokeWeight={2}
                  fillColor={selectedPoint.color}
                  fillOpacity={0.15}
                  /* No clicable: si atrapara el clic, taparía a su propio marcador. */
                  clickable={false}
                />
              )}

              <PointMarkers points={points} selectedId={selectedId} onSelect={onSelect} />
            </Map>
          </APIProvider>

          {children}
        </>
      )}
    </section>
  )
}
