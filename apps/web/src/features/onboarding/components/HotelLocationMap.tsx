import { brand, cn } from '@oranje/ui'
import { Circle, Map, Marker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps'
import { useEffect, type ReactNode } from 'react'

import { MissingMapsKeyNotice } from '@/shared/components/MissingMapsKeyNotice'
import {
  circleMarkerIcon,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  HIDE_POI_MAP_STYLES,
  isMapsEnabled,
} from '@/shared/constants/googleMaps'
import type { GeoPoint } from '@/shared/types/geo.types'

const PICKED_ZOOM = 16
const MARKER_SIZE_PX = 26

/**
 * ⚠ Superficies mínimas de la API de Google que usa este mapa. Los tipos reales
 * no se resuelven desde `apps/web` (dependencia transitiva + pnpm sin
 * hoisting), así que se declara lo poco que se consume.
 */
interface MapViewport {
  setCenter: (point: GeoPoint) => void
  setZoom: (zoom: number) => void
  getZoom: () => number | undefined
}

interface CoreLibrary {
  Point: new (x: number, y: number) => object
  Size: new (width: number, height: number) => object
}

/** El centro del mapa cuando la vista se asienta (evento `idle`). */
function readIdleCenter(event: unknown): GeoPoint | null {
  const center = (
    event as { map?: { getCenter?: () => { lat: () => number; lng: () => number } | undefined } }
  ).map?.getCenter?.()
  return center ? { lat: center.lat(), lng: center.lng() } : null
}

/** El clic en el mapa trae la coordenada como objeto plano. */
function readClickPoint(event: unknown): GeoPoint | null {
  const detail = (event as { detail?: { latLng?: GeoPoint | null } }).detail
  return detail?.latLng ?? null
}

/** El arrastre del marcador la trae como `LatLng`, con métodos. */
function readDragPoint(event: unknown): GeoPoint | null {
  const latLng = (event as { latLng?: { lat: () => number; lng: () => number } | null }).latLng
  if (!latLng) return null
  return { lat: latLng.lat(), lng: latLng.lng() }
}

/** Sigue la coordenada cuando cambia desde fuera: una búsqueda de Places. */
function MapFollower({ point }: { point: GeoPoint | null }): null {
  const map = useMap() as MapViewport | null

  useEffect(() => {
    if (!map || !point) return
    map.setCenter(point)
    map.setZoom(PICKED_ZOOM)
  }, [map, point])

  return null
}

/**
 * Controles propios: los de Google se apagaron con `disableDefaultUI` para que
 * el mapa no compita con el formulario. «Recentrar» devuelve la vista al pin
 * después de arrastrar el mapa buscando la entrada del hotel.
 */
function MapControls({ point }: { point: GeoPoint | null }): ReactNode {
  const map = useMap() as MapViewport | null

  function changeZoom(delta: number): void {
    if (!map) return
    map.setZoom((map.getZoom() ?? DEFAULT_MAP_ZOOM) + delta)
  }

  const zoomButtonClass =
    'flex size-8 items-center justify-center rounded-md bg-surface text-lg leading-none text-ink-2 shadow-md transition-colors hover:bg-surface-2'

  return (
    <>
      <button
        type="button"
        disabled={!point}
        onClick={() => {
          if (point) map?.setCenter(point)
        }}
        className="absolute bottom-24 left-3 z-10 rounded-md bg-surface px-3 py-1.5 text-xs font-semibold text-ink-2 shadow-md transition-colors hover:bg-surface-2 disabled:opacity-50"
      >
        Recentrar
      </button>

      <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-1.5">
        <button
          type="button"
          aria-label="Acercar"
          onClick={() => {
            changeZoom(1)
          }}
          className={zoomButtonClass}
        >
          +
        </button>
        <button
          type="button"
          aria-label="Alejar"
          onClick={() => {
            changeZoom(-1)
          }}
          className={zoomButtonClass}
        >
          −
        </button>
      </div>
    </>
  )
}

function HotelMarker({
  point,
  onMovePin,
}: {
  point: GeoPoint
  onMovePin: (point: GeoPoint) => void
}): ReactNode {
  const core = useMapsLibrary('core') as CoreLibrary | null

  if (!core) return null

  return (
    <Marker
      position={point}
      draggable
      title="Arrastra para ajustar la ubicación exacta"
      onDragEnd={(event) => {
        const dragged = readDragPoint(event)
        if (dragged) onMovePin(dragged)
      }}
      icon={{
        url: circleMarkerIcon(brand['o-500'], MARKER_SIZE_PX),
        scaledSize: new core.Size(MARKER_SIZE_PX, MARKER_SIZE_PX),
        anchor: new core.Point(MARKER_SIZE_PX / 2, MARKER_SIZE_PX / 2),
      }}
    />
  )
}

export interface HotelLocationMapProps {
  value: GeoPoint | null
  /** Radio en metros: se dibuja como círculo alrededor del pin. */
  geofenceMeters: number
  onMovePin: (point: GeoPoint) => void
  className?: string
  /**
   * Modo Uber: el pin queda FIJO al centro y se arrastra el MAPA; al
   * asentarse la vista, el centro es la ubicación. Para el paso de Ubicación.
   */
  centerPin?: boolean
  /** A dónde volar la vista (la elección de Places). En modo centerPin el
   * mapa NO persigue `value` — el valor ES el centro, perseguirlo ciclaría. */
  followPoint?: GeoPoint | null
}

/**
 * Mapa del alta: pin arrastrable y círculo de la geocerca a escala.
 *
 * Va en la columna derecha del modal, encima de la ficha del hotel. El buscador
 * de Places NO está aquí: es un campo más del formulario y vive en la columna
 * izquierda, con el resto de los datos del edificio.
 *
 * Elegir un sitio y arrastrar el pin son acciones distintas: la primera la
 * reporta el buscador y autollena varios campos; esta solo mueve la coordenada,
 * y es la que marca el pin como movido a mano.
 */
export function HotelLocationMap({
  value,
  geofenceMeters,
  onMovePin,
  className,
  centerPin = false,
  followPoint = null,
}: HotelLocationMapProps): ReactNode {
  if (!isMapsEnabled) {
    return (
      <div className={cn('rounded-lg border border-dashed border-line', className)}>
        <MissingMapsKeyNotice className="py-10" />
      </div>
    )
  }

  return (
    <div className={cn('relative h-72 overflow-hidden rounded-lg border border-line', className)}>
      <Map
        defaultCenter={value ?? DEFAULT_MAP_CENTER}
        defaultZoom={value ? PICKED_ZOOM : DEFAULT_MAP_ZOOM}
        gestureHandling={centerPin ? 'greedy' : 'cooperative'}
        disableDefaultUI
        clickableIcons={false}
        styles={HIDE_POI_MAP_STYLES}
        className="size-full"
        onClick={(event) => {
          if (centerPin) return
          const clicked = readClickPoint(event)
          if (clicked) onMovePin(clicked)
        }}
        onIdle={(event) => {
          if (!centerPin) return
          const center = readIdleCenter(event)
          if (!center) return
          /* El idle también dispara tras un vuelo programado (Places): si el
             centro ya ES el valor, no hay arrastre que reportar. */
          if (
            value &&
            Math.abs(center.lat - value.lat) < 1e-7 &&
            Math.abs(center.lng - value.lng) < 1e-7
          ) {
            return
          }
          onMovePin(center)
        }}
      >
        <MapFollower point={centerPin ? followPoint : value} />
        {value && (
          <>
            {/* La geocerca a escala: 150 m se ven distintos según el zoom */}
            <Circle
              center={value}
              radius={geofenceMeters}
              strokeColor={brand['o-500']}
              strokeOpacity={0.9}
              strokeWeight={2}
              fillColor={brand['o-500']}
              fillOpacity={0.15}
              clickable={false}
            />
            {!centerPin && <HotelMarker point={value} onMovePin={onMovePin} />}
          </>
        )}
      </Map>

      {centerPin && (
        /* Pin estilo Uber: fijo al centro, la punta marca la coordenada. */
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-full"
        >
          <div className="flex flex-col items-center">
            <div className="flex size-8 items-center justify-center rounded-full bg-o-500 shadow-lg ring-2 ring-surface">
              <div className="size-2.5 rounded-full bg-surface" />
            </div>
            <div className="h-3 w-0.5 bg-o-500" />
            <div className="-mt-0.5 size-1.5 rounded-full bg-ink/30 blur-[1px]" />
          </div>
        </div>
      )}

      <MapControls point={value} />
    </div>
  )
}
