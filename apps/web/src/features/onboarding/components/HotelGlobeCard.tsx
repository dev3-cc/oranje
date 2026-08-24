import { brand, neutral, statusLight, type StatusLightToken } from '@oranje/ui'
import { Html, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Color, Vector3, type MeshPhongMaterial } from 'three'
import ThreeGlobe from 'three-globe'
import { feature } from 'topojson-client'
import countriesTopo from 'world-atlas/countries-110m.json'

import { useGetHotelMapPointsQuery } from '../api/onboardingApi'
import type { HotelMapPoint } from '../types/prospect.types'

import {
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
} from '@/shared/constants/onboardingStatus'
import { useMediaQuery } from '@/shared/hooks/useMediaQuery'

/**
 * Siluetas de continentes desde `world-atlas` (TopoJSON empaquetado, sin red):
 * la CSP de D-07 no abre hosts para texturas y el globo no las necesita.
 */
type TopoArgs = Parameters<typeof feature>
const topology = countriesTopo as unknown as TopoArgs[0] & {
  objects: { countries: TopoArgs[1] }
}
const COUNTRIES = (
  feature(topology, topology.objects.countries) as unknown as { features: object[] }
).features

/** La vista inicial apunta al territorio: Quintana Roo. */
const HOME = { lat: 21, lng: -87, altitude: 2.1 }

function buildGlobe(): ThreeGlobe {
  const globe = new ThreeGlobe()
    .hexPolygonsData(COUNTRIES)
    .hexPolygonResolution(3)
    .hexPolygonMargin(0.55)
    .hexPolygonColor(() => neutral['ink-4'])
    .showAtmosphere(true)
    .atmosphereColor(brand['o-500'])
    .atmosphereAltitude(0.13)

  const material = globe.globeMaterial() as MeshPhongMaterial
  material.color = new Color(neutral['surface-2'])
  material.transparent = true
  material.opacity = 0.95

  return globe
}

/**
 * Un punto del globo puede ser VARIOS hoteles: se agrupa a nivel ciudad
 * (~11 km) porque a escala planetaria dos hoteles del mismo corredor son el
 * mismo pixel. El estado de cada hotel vive en su tarjeta, no en el punto:
 * todos los puntos van en naranja Oranje, uniformes.
 */
interface GlobeSpot {
  lat: number
  lng: number
  hotels: HotelMapPoint[]
  /** La primera foto disponible del punto: la portada de su tarjeta. */
  photoUrl: string | null
}

function groupByLocation(hotels: HotelMapPoint[]): GlobeSpot[] {
  const spots = new Map<string, GlobeSpot>()
  for (const hotel of hotels) {
    const key = `${hotel.lat.toFixed(1)},${hotel.lng.toFixed(1)}`
    const spot = spots.get(key)
    if (spot) {
      spot.hotels.push(hotel)
      spot.photoUrl = spot.photoUrl ?? hotel.photoUrl
    } else {
      spots.set(key, { lat: hotel.lat, lng: hotel.lng, hotels: [hotel], photoUrl: hotel.photoUrl })
    }
  }
  return [...spots.values()]
}

/** El chip de estado del hotel: su semáforo, o su condición si no tiene ciclo. */
function hotelStatusToken(hotel: HotelMapPoint): StatusLightToken {
  if (hotel.isClient) return 'st-naranja'
  return hotel.status ? ONBOARDING_STATUS_TOKEN[hotel.status] : 'st-gris'
}

function hotelStatusLabel(hotel: HotelMapPoint): string {
  if (hotel.isClient) return 'Cliente activo'
  return hotel.status ? ONBOARDING_STATUS_LABEL[hotel.status] : 'Sin ciclo abierto'
}

function GlobeObject({ globe, spots }: { globe: ThreeGlobe; spots: GlobeSpot[] }): ReactNode {
  useEffect(() => {
    globe
      .pointsData(spots)
      .pointLat((point) => (point as GlobeSpot).lat)
      .pointLng((point) => (point as GlobeSpot).lng)
      // Uniformes y de marca: el detalle por hotel lo cuenta la tarjeta.
      // Bajos y finos: a planeta completo, un cilindro alto se ve como tornillo.
      .pointColor(() => brand['o-500'])
      .pointAltitude(0.015)
      .pointRadius(0.55)
      // El anillo que pulsa hace encontrable un punto sobre un globo quieto.
      .ringsData(spots)
      .ringLat((ring) => (ring as GlobeSpot).lat)
      .ringLng((ring) => (ring as GlobeSpot).lng)
      .ringColor(() => () => brand['o-500'])
      .ringMaxRadius(3)
      .ringPropagationSpeed(1.2)
      .ringRepeatPeriod(1800)
  }, [globe, spots])

  return <primitive object={globe} />
}

/** Cuántas tarjetas anotadas caben sin taparse unas a otras. */
const MAX_CALLOUTS = 4
const MAX_ROWS = 3
/**
 * A dónde vuela cada tarjeta desde su punto: un cuadrante por tarjeta
 * (arriba-derecha, arriba-izquierda, abajo-derecha, abajo-izquierda), para que
 * varios puntos vecinos no encimen sus tarjetas ni crucen sus líneas.
 */
const CALLOUT_OFFSETS: ReadonlyArray<{ dx: number; dy: number }> = [
  { dx: 118, dy: -100 },
  { dx: -118, dy: -70 },
  { dx: 130, dy: 56 },
  { dx: -130, dy: 90 },
]

/**
 * La tarjeta SIEMPRE visible con su línea al punto, al estilo de un mapa
 * técnico anotado. `Html` de drei la reproyecta en cada frame, así que sigue
 * al globo al girar; cuando el punto rota a la cara oculta, se desvanece
 * (el producto punto entre la normal del punto y la cámara lo delata).
 * Clic: abre Mi Territorio con el hotel del punto ya buscado.
 */
function SpotCallout({
  globe,
  spot,
  index,
  onOpen,
}: {
  globe: ThreeGlobe
  spot: GlobeSpot
  index: number
  onOpen: (spot: GlobeSpot) => void
}): ReactNode {
  const wrapperRef = useRef<HTMLDivElement>(null)

  const position = useMemo(() => {
    const { x, y, z } = globe.getCoords(spot.lat, spot.lng, 0.06)
    return new Vector3(x, y, z)
  }, [globe, spot])

  useFrame(({ camera }) => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const facing = position.clone().normalize().dot(camera.position.clone().normalize())
    const isVisible = facing > 0.3
    wrapper.style.opacity = isVisible ? '1' : '0'
    wrapper.style.pointerEvents = isVisible ? 'auto' : 'none'
  })

  const { dx, dy } = CALLOUT_OFFSETS[index % CALLOUT_OFFSETS.length] as {
    dx: number
    dy: number
  }
  const width = Math.abs(dx)
  const height = Math.abs(dy)
  const isAbove = dy < 0
  const [first] = spot.hotels
  const visibleHotels = spot.hotels.slice(0, MAX_ROWS)
  const rest = spot.hotels.length - visibleHotels.length

  if (!first) return null

  return (
    <Html position={position} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div ref={wrapperRef} className="transition-opacity duration-300">
        {/* La línea recta del punto a la tarjeta, como el pin de la referencia. */}
        <svg
          aria-hidden
          width={width}
          height={height}
          style={{
            position: 'absolute',
            left: dx >= 0 ? 0 : dx,
            top: isAbove ? dy : 0,
            overflow: 'visible',
            pointerEvents: 'none',
          }}
        >
          <line
            x1={dx >= 0 ? 0 : width}
            y1={isAbove ? height : 0}
            x2={dx >= 0 ? width : 0}
            y2={isAbove ? 0 : height}
            stroke={neutral.ink}
            strokeOpacity={0.5}
            strokeWidth={1}
          />
          <circle
            cx={dx >= 0 ? 0 : width}
            cy={isAbove ? height : 0}
            r={3.5}
            fill="none"
            stroke={neutral.ink}
            strokeOpacity={0.7}
            strokeWidth={1.2}
          />
        </svg>

        {/* Misma anatomía que la tarjeta del pipeline: foto, fundido, datos. */}
        <button
          type="button"
          onClick={() => {
            onOpen(spot)
          }}
          className="absolute w-48 cursor-pointer overflow-hidden rounded-xl bg-surface/95 text-left shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
          style={{
            left: dx,
            top: dy,
            transform: `translate(${dx < 0 ? '-100%' : '0'}, ${isAbove ? '-100%' : '0'})`,
          }}
        >
          {spot.photoUrl && (
            <span className="relative block h-16 bg-surface-2">
              <img
                src={spot.photoUrl}
                alt=""
                loading="lazy"
                className="size-full object-cover"
                onError={(event) => {
                  /** Las URLs guardadas de getUrl() caducan: fuera la rota. */
                  event.currentTarget.style.display = 'none'
                }}
              />
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-b from-transparent via-surface/70 to-surface"
              />
            </span>
          )}
          <span className={`block ${spot.photoUrl ? 'p-2.5 pt-0' : 'p-2.5'}`}>
            {spot.hotels.length === 1 ? (
              <>
                <span className="block truncate text-xs font-semibold text-ink">{first.name}</span>
                <span className="mt-1 flex items-center gap-1.5 text-[11px] leading-4 text-ink-2">
                  <span
                    aria-hidden
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: statusLight[hotelStatusToken(first)] }}
                  />
                  {hotelStatusLabel(first)}
                </span>
              </>
            ) : (
              <>
                <span className="block truncate text-xs font-semibold text-ink">
                  {spot.hotels.length} hoteles aquí
                </span>
                <span className="mt-0.5 flex flex-col">
                  {visibleHotels.map((hotel) => (
                    <span
                      key={hotel.id}
                      className="flex items-center gap-1.5 text-[11px] leading-4 text-ink-2"
                    >
                      <span
                        aria-hidden
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: statusLight[hotelStatusToken(hotel)] }}
                      />
                      <span className="truncate">{hotel.name}</span>
                    </span>
                  ))}
                  {rest > 0 && (
                    <span className="text-[11px] leading-4 text-ink-4">y {rest} más</span>
                  )}
                </span>
              </>
            )}
          </span>
        </button>
      </div>
    </Html>
  )
}

function GlobeCanvas({
  hotels,
  onOpen,
}: {
  hotels: HotelMapPoint[]
  onOpen: (spot: GlobeSpot) => void
}): ReactNode {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const globe = useMemo(buildGlobe, [])
  const spots = useMemo(() => groupByLocation(hotels), [hotels])

  /** Tarjeta solo para los puntos con más hoteles; el resto queda como punto. */
  const annotated = useMemo(
    () => [...spots].sort((a, b) => b.hotels.length - a.hotels.length).slice(0, MAX_CALLOUTS),
    [spots],
  )

  /**
   * La cámara arranca SOBRE los hoteles, no sobre un punto fijo: centroide de
   * los puntos. Sin datos, cae al HOME del territorio.
   *
   * Altitud 2.1 a propósito: con fov 45, más cerca la esfera no cabe en el
   * encuadre y se ve un pedazo de planeta recortado en vez de un planeta.
   */
  const camera = useMemo(() => {
    const target = spots.length
      ? {
          lat: spots.reduce((sum, spot) => sum + spot.lat, 0) / spots.length,
          lng: spots.reduce((sum, spot) => sum + spot.lng, 0) / spots.length,
          altitude: 2.1,
        }
      : HOME
    const radius = 100 * (1 + target.altitude)
    const phi = ((90 - target.lat) * Math.PI) / 180
    const theta = ((90 - target.lng) * Math.PI) / 180
    return {
      position: [
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta),
      ] as [number, number, number],
      fov: 45,
    }
  }, [spots])

  return (
    <Canvas dpr={[1, 1.5]} camera={camera}>
      <ambientLight intensity={1.6} />
      <directionalLight position={[120, 160, 80]} intensity={1.2} />
      <GlobeObject globe={globe} spots={spots} />
      {annotated.map((spot, index) => (
        <SpotCallout
          key={`${String(spot.lat)},${String(spot.lng)}`}
          globe={globe}
          spot={spot}
          index={index}
          onOpen={onOpen}
        />
      ))}
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        autoRotate={!reducedMotion}
        autoRotateSpeed={0.5}
      />
    </Canvas>
  )
}

/**
 * El globo del territorio: un punto naranja por ciudad con hoteles, tarjetas
 * anotadas con foto y el estado del semáforo de cada hotel, y clic para abrir
 * Mi Territorio con ese hotel buscado. Solo web (xl en adelante): en móvil ni
 * se monta — WebGL y batería no se gastan en un adorno.
 */
export function HotelGlobeCard(): ReactNode {
  const isWide = useMediaQuery('(min-width: 1280px)')
  const navigate = useNavigate()
  const { data: hotels, isError } = useGetHotelMapPointsQuery(undefined, { skip: !isWide })

  if (!isWide) return null

  function openTerritory(spot: GlobeSpot): void {
    const [first] = spot.hotels
    /** Un hotel: llega ya buscado. Varios: la lista completa del territorio. */
    const search = spot.hotels.length === 1 && first ? `?q=${encodeURIComponent(first.name)}` : ''
    void navigate(`/mi-territorio${search}`)
  }

  return (
    /* La caja sigue el estilo del tablero: radio grande y sombra tintada, sin borde. */
    <section className="flex flex-col rounded-2xl bg-surface p-5 shadow-md">
      <h2 className="text-base font-semibold text-ink">El territorio</h2>
      <p className="mt-0.5 text-sm text-ink-3">
        Arrástralo. El clic en una tarjeta abre Mi Territorio con ese hotel.
        {hotels && ` ${hotels.length} hoteles con coordenada.`}
      </p>

      <div className="mx-auto mt-2 h-96 w-full max-w-3xl">
        {isError ? (
          <p className="pt-8 text-center text-sm text-ink-3">
            No se pudieron cargar los hoteles del globo.
          </p>
        ) : (
          <GlobeCanvas hotels={hotels ?? []} onOpen={openTerritory} />
        )}
      </div>
    </section>
  )
}
