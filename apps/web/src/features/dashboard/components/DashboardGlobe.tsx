import { neutral, statusLight } from '@oranje/ui'
import { Html, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { Vector3, type MeshPhongMaterial } from 'three'
import ThreeGlobe from 'three-globe'

import earthTexture from '@/assets/globe/earth-blue-marble.jpg'
import { useGetHotelMapPointsQuery, type HotelMapPoint } from '@/features/onboarding'
import { useMediaQuery } from '@/shared/hooks/useMediaQuery'
import { supportsWebGl } from '@/shared/lib/webgl'

const HOME = { lat: 21, lng: -87, altitude: 1.6 }

function buildGlobe(): ThreeGlobe {
  const globe = new ThreeGlobe().globeImageUrl(earthTexture).showAtmosphere(false)
  const material = globe.globeMaterial() as MeshPhongMaterial
  material.shininess = 6
  return globe
}

interface GlobeSpot {
  lat: number
  lng: number
  name: string
  photoUrl: string | null
}

function groupByLocation(hotels: HotelMapPoint[]): GlobeSpot[] {
  const spots = new Map<string, GlobeSpot>()
  for (const hotel of hotels) {
    const key = `${hotel.lat.toFixed(1)},${hotel.lng.toFixed(1)}`
    const spot = spots.get(key)
    if (spot) {
      spot.photoUrl = spot.photoUrl ?? hotel.photoUrl
    } else {
      spots.set(key, { lat: hotel.lat, lng: hotel.lng, name: hotel.name, photoUrl: hotel.photoUrl })
    }
  }
  return [...spots.values()]
}

const MAX_PINS = 4
const PIN_OFFSETS: ReadonlyArray<{ dx: number; dy: number }> = [
  { dx: -64, dy: -72 },
  { dx: 52, dy: -96 },
  { dx: -84, dy: 24 },
  { dx: 64, dy: 60 },
]

function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase()
}

function SpotPin({
  globe,
  spot,
  index,
}: {
  globe: ThreeGlobe
  spot: GlobeSpot
  index: number
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
    wrapper.style.opacity = facing > 0.35 ? '1' : '0'
  })

  const { dx, dy } = PIN_OFFSETS[index % PIN_OFFSETS.length] as { dx: number; dy: number }

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

        <span className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: dx, top: dy }}>
          {spot.photoUrl ? (
            <img
              src={spot.photoUrl}
              alt=""
              loading="lazy"
              className="size-11 rounded-full border-2 border-surface object-cover shadow-md"
              onError={(event) => {
                event.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <span
              aria-hidden
              className="flex size-11 items-center justify-center rounded-full border-2 border-surface bg-o-500 text-base font-bold text-white shadow-md"
            >
              {initialOf(spot.name)}
            </span>
          )}
        </span>
      </div>
    </Html>
  )
}

function GlobeCanvas({ hotels }: { hotels: HotelMapPoint[] }): ReactNode {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const globe = useMemo(buildGlobe, [])
  const spots = useMemo(() => groupByLocation(hotels), [hotels])
  const pinned = useMemo(() => spots.slice(0, MAX_PINS), [spots])

  useEffect(() => {
    globe
      .pointsData(spots)
      .pointLat((point) => (point as GlobeSpot).lat)
      .pointLng((point) => (point as GlobeSpot).lng)
      .pointColor(() => statusLight['st-rojo'])
      .pointAltitude(0.012)
      .pointRadius(0.5)
  }, [globe, spots])

  const camera = useMemo(() => {
    const target = spots.length
      ? {
          lat: spots.reduce((sum, spot) => sum + spot.lat, 0) / spots.length,
          lng: spots.reduce((sum, spot) => sum + spot.lng, 0) / spots.length,
          altitude: HOME.altitude,
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
      <primitive object={globe} />
      {pinned.map((spot, index) => (
        <SpotPin
          key={`${String(spot.lat)},${String(spot.lng)}`}
          globe={globe}
          spot={spot}
          index={index}
        />
      ))}
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        enableRotate={false}
        autoRotate={!reducedMotion}
        autoRotateSpeed={0.4}
      />
    </Canvas>
  )
}

export function DashboardGlobe(): ReactNode {
  const isWide = useMediaQuery('(min-width: 1024px)')
  const hasWebGl = useMemo(supportsWebGl, [])
  const { data: hotels, isError } = useGetHotelMapPointsQuery(undefined, {
    skip: !isWide || !hasWebGl,
  })

  if (!isWide || !hasWebGl || isError || !hotels?.length) return null

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -right-52 top-1/2 hidden size-[30rem] -translate-y-1/2 lg:block"
    >
      <GlobeCanvas hotels={hotels} />
    </div>
  )
}
