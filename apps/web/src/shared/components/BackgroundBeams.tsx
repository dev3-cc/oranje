import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'

import { useMediaQuery } from '@/shared/hooks/useMediaQuery'

interface BeamConfig {
  left: string
  duration: number
  delay: number
  heightClass: string
}

const BEAMS: BeamConfig[] = [
  { left: '8%', duration: 7, delay: 2, heightClass: 'h-14' },
  { left: '32%', duration: 5, delay: 5, heightClass: 'h-6' },
  { left: '61%', duration: 8, delay: 0, heightClass: 'h-20' },
  { left: '86%', duration: 6, delay: 3, heightClass: 'h-12' },
]

const EXPLOSION_SPANS = Array.from({ length: 16 }, (_, index) => index)

function Explosion({ x, y }: { x: number; y: number }): ReactNode {
  return (
    <div className="absolute z-10 size-1" style={{ left: x, top: y }}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        className="absolute -inset-x-8 top-0 m-auto h-1.5 w-16 rounded-full bg-gradient-to-r from-transparent via-o-500 to-transparent blur-sm"
      />
      {EXPLOSION_SPANS.map((index) => (
        <motion.span
          key={index}
          initial={{ x: 0, y: 0, opacity: 1 }}
          animate={{
            x: Math.floor(Math.random() * 120 - 60),
            y: Math.floor(Math.random() * -80 - 10),
            opacity: 0,
          }}
          transition={{ duration: Math.random() * 1 + 0.6, ease: 'easeOut' }}
          className="absolute size-1 rounded-full bg-gradient-to-b from-o-500 to-o-300"
        />
      ))}
    </div>
  )
}

function Beam({
  config,
  containerRef,
}: {
  config: BeamConfig
  containerRef: RefObject<HTMLDivElement | null>
}): ReactNode {
  const beamRef = useRef<HTMLDivElement>(null)
  const firedRef = useRef(false)
  const [beamCycle, setBeamCycle] = useState(0)
  const [collision, setCollision] = useState<{ x: number; y: number; key: number } | null>(null)

  useEffect(() => {
    const id = window.setInterval(() => {
      const beam = beamRef.current
      const container = containerRef.current
      if (!beam || !container) return

      const beamRect = beam.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()

      if (beamRect.bottom < containerRect.top + 40) {
        firedRef.current = false
        return
      }

      if (!firedRef.current && beamRect.bottom >= containerRect.bottom - 6) {
        firedRef.current = true
        setCollision({
          x: beamRect.left - containerRect.left + beamRect.width / 2,
          y: containerRect.height - 8,
          key: Date.now(),
        })
        setBeamCycle((cycle) => cycle + 1)
        window.setTimeout(() => {
          setCollision(null)
        }, 1600)
      }
    }, 60)

    return () => {
      window.clearInterval(id)
    }
  }, [containerRef])

  return (
    <>
      <motion.div
        key={beamCycle}
        ref={beamRef}
        initial={{ translateY: '-220px' }}
        animate={{ translateY: 'calc(100vh - 100%)' }}
        transition={{
          duration: config.duration,
          delay: config.delay,
          ease: 'linear',
        }}
        className={`absolute top-0 w-px rounded-full bg-gradient-to-t from-o-500 via-o-300 to-transparent ${config.heightClass}`}
        style={{ left: config.left }}
      />
      <AnimatePresence>
        {collision && <Explosion key={collision.key} x={collision.x} y={collision.y} />}
      </AnimatePresence>
    </>
  )
}

export function BackgroundBeams(): ReactNode {
  const isDesktop = useMediaQuery('(min-width: 1280px)')
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const containerRef = useRef<HTMLDivElement>(null)

  if (!isDesktop || reducedMotion) return null

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {BEAMS.map((beam) => (
        <Beam key={beam.left} config={beam} containerRef={containerRef} />
      ))}
    </div>
  )
}
