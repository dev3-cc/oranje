/* eslint-disable */
// @ts-nocheck
/**
 * Vendoreado de Aceternity UI — moving-border (2026-09-03), obtenido de su
 * registro oficial de shadcn (ui.aceternity.com/registry/moving-border.json),
 * que es el mismo camino D-16 de copiar con CLI.
 *
 * Adaptaciones de casa (las únicas):
 *  - `motion/react` → `framer-motion` (nuestra dependencia).
 *  - `cn` de `@/lib/utils` → `@oranje/ui`.
 *  - sin `"use client"` (no hay RSC en Vite).
 *  - resguardo jsdom en las APIs de geometría SVG (vitest las carece).
 * El estilo se ajusta desde el caller vía `containerClassName`/`borderClassName`.
 */
import React from 'react'
import {
  motion,
  useAnimationFrame,
  useMotionTemplate,
  useMotionValue,
  useTransform,
} from 'framer-motion'
import { useRef } from 'react'
import { cn } from '@oranje/ui'

/**
 * Adaptación de casa: `borderRadius` (rem/px) a número de px, para pasarlo
 * como `rx`/`ry` DEL MISMO valor al `<rect>` guía (ver `MovingBorder` abajo).
 * El original fijaba `rx="30%" ry="30%"` sin importar `borderRadius` — un
 * porcentaje se resuelve contra el ancho (rx) y el alto (ry) del SVG por
 * separado, así que en una caja ancha y baja (como el marco de una corrida de
 * días) da una esquina MUY elíptica (p.ej. rx≈158px, ry≈30px) mientras el
 * borde CSS visible es un radio simétrico de ~12px — el "cometa" viaja por
 * una curva bastante distinta a la línea que se ve, y se sale de ella en las
 * esquinas. Con `rx=ry` en px, calcado del mismo radio visible, la guía y la
 * línea coinciden.
 */
function borderRadiusToPx(value: string): number {
  const match = /^([\d.]+)(px|rem)?$/.exec(value.trim())
  if (!match) return 0
  const amount = parseFloat(match[1] ?? '0')
  return match[2] === 'rem' ? amount * 16 : amount
}

export function Button({
  borderRadius = '1.75rem',
  children,
  as: Component = 'button',
  containerClassName,
  borderClassName,
  duration,
  className,
  ...otherProps
}: {
  borderRadius?: string
  children: React.ReactNode
  as?: any
  containerClassName?: string
  borderClassName?: string
  duration?: number
  className?: string
  [key: string]: any
}) {
  /** Mismo factor 0.96 que ya reduce el borde CSS interno: la guía debe medir
      lo mismo que la línea que se ve, no el radio exterior sin reducir. */
  const cornerRadiusPx = borderRadiusToPx(borderRadius) * 0.96

  return (
    <Component
      className={cn(
        'relative h-16 w-40 overflow-hidden bg-transparent p-[1px] text-xl',
        containerClassName,
      )}
      style={{
        borderRadius: borderRadius,
      }}
      {...otherProps}
    >
      <div className="absolute inset-0" style={{ borderRadius: `calc(${borderRadius} * 0.96)` }}>
        <MovingBorder duration={duration} rx={cornerRadiusPx} ry={cornerRadiusPx}>
          <div
            className={cn(
              'h-20 w-20 bg-[radial-gradient(#0ea5e9_40%,transparent_60%)] opacity-[0.8]',
              borderClassName,
            )}
          />
        </MovingBorder>
      </div>

      <div
        className={cn(
          'relative flex h-full w-full items-center justify-center border border-slate-800 bg-slate-900/[0.8] text-sm text-white antialiased backdrop-blur-xl',
          className,
        )}
        style={{
          borderRadius: `calc(${borderRadius} * 0.96)`,
        }}
      >
        {children}
      </div>
    </Component>
  )
}

export const MovingBorder = ({
  children,
  duration = 3000,
  rx,
  ry,
  ...otherProps
}: {
  children: React.ReactNode
  duration?: number
  rx?: string | number
  ry?: string | number
  [key: string]: any
}) => {
  const pathRef = useRef<any>()
  const progress = useMotionValue<number>(0)

  useAnimationFrame((time) => {
    /* Adaptación de casa: jsdom (vitest) no implementa las APIs de geometría
       de SVG — sin este resguardo, cualquier spec que monte el componente
       truena. En navegador real no cambia nada. */
    if (typeof pathRef.current?.getTotalLength !== 'function') return
    const length = pathRef.current.getTotalLength()
    if (length) {
      const pxPerMillisecond = length / duration
      progress.set((time * pxPerMillisecond) % length)
    }
  })

  const x = useTransform(progress, (val) =>
    typeof pathRef.current?.getPointAtLength === 'function'
      ? pathRef.current.getPointAtLength(val).x
      : 0,
  )
  const y = useTransform(progress, (val) =>
    typeof pathRef.current?.getPointAtLength === 'function'
      ? pathRef.current.getPointAtLength(val).y
      : 0,
  )
  /**
   * Adaptación de casa: el original solo traslada — nunca rota — el
   * `borderClassName` que el CALLER pone dentro. Con el blob circular de la
   * demo (`radial-gradient`, simétrico) eso no se nota; con una barra
   * direccional como la nuestra (`h-[3px] w-16`, un segmento horizontal), no
   * rotar significa que en los lados VERTICALES del marco la barra se queda
   * horizontal y cruza perpendicular sobre la línea — ~32px de cada lado del
   * punto real, la mitad metiéndose a la tarjeta. Se rota según la tangente
   * del recorrido (dos puntos cercanos sobre el mismo `<rect>`), 0° en los
   * lados horizontales y 90° en los verticales, interpolando en las esquinas.
   */
  const angle = useTransform(progress, (val) => {
    if (typeof pathRef.current?.getPointAtLength !== 'function') return 0
    const length = pathRef.current.getTotalLength()
    if (!length) return 0
    const eps = 0.5
    const p1 = pathRef.current.getPointAtLength(val)
    const p2 = pathRef.current.getPointAtLength((val + eps) % length)
    return (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI
  })

  /* `rotate` va AL FINAL de la lista: en CSS el transform se aplica de
     derecha a izquierda, así que rota la barra sobre su propio centro
     ANTES de que las traslaciones la reubiquen sobre el punto del path —
     "gira en su lugar, luego mueve", no al revés. */
  const transform = useMotionTemplate`translateX(${x}px) translateY(${y}px) translateX(-50%) translateY(-50%) rotate(${angle}deg)`

  return (
    <>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        className="absolute h-full w-full"
        width="100%"
        height="100%"
        {...otherProps}
      >
        <rect fill="none" width="100%" height="100%" rx={rx} ry={ry} ref={pathRef} />
      </svg>
      <motion.div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          display: 'inline-block',
          transform,
        }}
      >
        {children}
      </motion.div>
    </>
  )
}
