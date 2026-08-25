import { neutral, statusLight, type StatusLightToken } from '@oranje/ui'
import { Html, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Vector3, type MeshPhongMaterial } from 'three'
import ThreeGlobe from 'three-globe'

import { useGetHotelMapPointsQuery } from '../api/onboardingApi'
import type { HotelMapPoint } from '../types/prospect.types'

import earthTexture from '@/assets/globe/earth-blue-marble.jpg'
import {
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
} from '@/shared/constants/onboardingStatus'
import { useMediaQuery } from '@/shared/hooks/useMediaQuery'
import { supportsWebGl } from '@/shared/lib/webgl'

const HOME = { lat: 21, lng: -87, altitude: 2.1 }

function buildGlobe(): ThreeGlobe {
  const globe = new ThreeGlobe().globeImageUrl(earthTexture).showAtmosphere(false)

  const material = globe.globeMaterial() as MeshPhongMaterial
  material.shininess = 6

  return globe
}

interface GlobeSpot {
  lat: number
  lng: number
  hotels: HotelMapPoint[]
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
      .pointColor(() => statusLight['st-rojo'])
      .pointAltitude(0.012)
      .pointRadius(0.5)
  }, [globe, spots])

  return <primitive object={globe} />
}

const MAX_PINS = 5
const PIN_OFFSETS: ReadonlyArray<{ dx: number; dy: number }> = [
  { dx: 28, dy: -96 },
  { dx: -72, dy: -78 },
  { dx: 84, dy: -60 },
  { dx: -44, dy: -120 },
  { dx: 96, dy: -104 },
]

function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase()
}

function SpotPin({
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
    const { x, y, z } = globe.getCoords(spot.lat, spot.lng, 0.02)
    return new Vector3(x, y, z)
  }, [globe, spot])

  useFrame(({ camera }) => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const facing = position.clone().normalize().dot(camera.position.clone().normalize())
    const isVisible = facing > 0.35
    wrapper.style.opacity = isVisible ? '1' : '0'
    wrapper.style.pointerEvents = isVisible ? 'auto' : 'none'
  })

  const { dx, dy } = PIN_OFFSETS[index % PIN_OFFSETS.length] as { dx: number; dy: number }
  const [first] = spot.hotels
  if (!first) return null

  const title = spot.hotels.length === 1 ? first.name : `${String(spot.hotels.length)} hoteles aquí`

  return (
    <Html position={position} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div ref={wrapperRef} className="transition-opacity duration-300">
        <svg
          aria-hidden
          style={{ position: 'absolute', left: -8, top: -8, overflow: 'visible' }}
          width={16}
          height={16}
        >
          <line
            x1={0}
            y1={0}
            x2={dx}
            y2={dy}
            stroke={neutral['ink-4']}
            strokeOpacity={0.8}
            strokeWidth={1}
          />
          <circle cx={0} cy={0} r={3} fill={statusLight['st-rojo']} />
        </svg>

        <button
          type="button"
          onClick={() => {
            onOpen(spot)
          }}
          title={`${title} — ${hotelStatusLabel(first)}`}
          aria-label={`${title}. Abrir en Mi Territorio`}
          className="group absolute size-12 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
          style={{ left: dx, top: dy }}
        >
          {spot.photoUrl ? (
            <img
              src={spot.photoUrl}
              alt=""
              loading="lazy"
              className="size-12 max-w-none rounded-full border-2 border-surface object-cover shadow-md"
              onError={(event) => {
                event.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <span
              aria-hidden
              className="flex size-12 items-center justify-center rounded-full border-2 border-surface text-base font-bold text-white shadow-md"
              style={{ backgroundColor: statusLight[hotelStatusToken(first)] }}
            >
              {initialOf(first.name)}
            </span>
          )}
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

  const annotated = useMemo(
    () => [...spots].sort((a, b) => b.hotels.length - a.hotels.length).slice(0, MAX_PINS),
    [spots],
  )

  const camera = useMemo(() => {
    const target = spots.length
      ? {
          lat: spots.reduce((sum, spot) => sum + spot.lat, 0) / spots.length,
          lng: spots.reduce((sum, spot) => sum + spot.lng, 0) / spots.length,
          altitude: 1.45,
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
      <ambientLight intensity={2.4} />
      <directionalLight position={[120, 160, 80]} intensity={1.4} />
      <GlobeObject globe={globe} spots={spots} />
      {annotated.map((spot, index) => (
        <SpotPin
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
        autoRotateSpeed={0.4}
      />
    </Canvas>
  )
}

export function HotelGlobeCard(): ReactNode {
  const isWide = useMediaQuery('(min-width: 1280px)')
  const navigate = useNavigate()
  const hasWebGl = useMemo(supportsWebGl, [])
  const { data: hotels, isError } = useGetHotelMapPointsQuery(undefined, {
    skip: !isWide || !hasWebGl,
  })

  if (!isWide || !hasWebGl) return null

  function openTerritory(spot: GlobeSpot): void {
    const [first] = spot.hotels
    const search = spot.hotels.length === 1 && first ? `?q=${encodeURIComponent(first.name)}` : ''
    void navigate(`/mi-territorio${search}`)
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-line bg-surface shadow-md">
      <div className="relative z-10 px-8 pt-8">
        <h2 className="text-2xl font-bold text-ink">Por todo el territorio</h2>
        <p className="mt-2 max-w-md text-sm text-ink-3">
          Los hoteles de tus zonas, del prospecto al cliente activo.
          {hotels && ` ${String(hotels.length)} con coordenada.`} Cada pin abre Mi Territorio.
        </p>
      </div>

      {isError ? (
        <p className="px-8 py-16 text-center text-sm text-ink-3">
          No se pudieron cargar los hoteles del globo.
        </p>
      ) : (
        <div className="pointer-events-none relative mt-2 h-96">
          <div className="pointer-events-auto absolute inset-x-0 top-0 mx-auto h-[48rem] w-full max-w-5xl">
            <GlobeCanvas hotels={hotels ?? []} onOpen={openTerritory} />
          </div>
        </div>
      )}
    </section>
  )
}
