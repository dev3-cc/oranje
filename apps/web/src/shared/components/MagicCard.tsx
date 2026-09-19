import { cn } from '@oranje/ui'
import { gsap } from 'gsap'
import { useCallback, useEffect, useRef, type CSSProperties, type ReactNode } from 'react'

import { useMediaQuery } from '@/shared/hooks/useMediaQuery'

/**
 * La tarjeta de Magic Bento de reactbits (fuente oficial ts-tailwind,
 * DavidHDev/react-bits), adaptada: partículas al hover, glow de borde que
 * sigue al cursor y ripple al clic — con el naranja Oranje y sin tilt ni
 * magnetismo por defecto (es una app de trabajo).
 *
 * Es el acento de TODA fila que representa a una persona o a un cliente
 * (Pool, Mi Personal, Mi Equipo, Pipeline, Conversión, requisiciones…):
 * el hover ya avisa con fondo y cursor — esto solo lo remata. Por eso se
 * apaga sola donde no aporta: con `prefers-reduced-motion` (regla de la
 * skill) y en pantallas sin hover (táctil: nunca se vería el efecto y sí
 * costaría). `disableAnimations` la apaga a mano.
 *
 * Lleva `overflow-hidden` para recortar partículas y ripple, y eso se
 * comería el anillo de foco del hijo: el anillo se pinta aquí, en el
 * envoltorio, cuando el hijo tiene foco visible por teclado.
 */
const DEFAULT_PARTICLE_COUNT = 6
/** RGB de `--o-500` (#FF8000). */
const DEFAULT_GLOW_COLOR = '255, 128, 0'

const createParticleElement = (x: number, y: number, color: string): HTMLDivElement => {
  const el = document.createElement('div')
  el.className = 'particle'
  el.style.cssText = `
    position: absolute;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: rgba(${color}, 1);
    box-shadow: 0 0 6px rgba(${color}, 0.6);
    pointer-events: none;
    z-index: 100;
    left: ${x}px;
    top: ${y}px;
  `
  return el
}

export function MagicCard({
  children,
  className = '',
  style,
  particleCount = DEFAULT_PARTICLE_COUNT,
  glowColor = DEFAULT_GLOW_COLOR,
  clickEffect = true,
  disableAnimations = false,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
  particleCount?: number
  glowColor?: string
  clickEffect?: boolean
  disableAnimations?: boolean
}): ReactNode {
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const noHover = useMediaQuery('(hover: none)')
  const isOff = disableAnimations || reduceMotion || noHover

  const cardRef = useRef<HTMLDivElement>(null)
  const particlesRef = useRef<HTMLDivElement[]>([])
  const timeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>([])
  const isHoveredRef = useRef(false)
  const memoizedParticles = useRef<HTMLDivElement[]>([])
  const particlesInitialized = useRef(false)

  const initializeParticles = useCallback(() => {
    if (particlesInitialized.current || !cardRef.current) return
    const { width, height } = cardRef.current.getBoundingClientRect()
    memoizedParticles.current = Array.from({ length: particleCount }, () =>
      createParticleElement(Math.random() * width, Math.random() * height, glowColor),
    )
    particlesInitialized.current = true
  }, [particleCount, glowColor])

  const clearAllParticles = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
    particlesRef.current.forEach((particle) => {
      gsap.to(particle, {
        scale: 0,
        opacity: 0,
        duration: 0.3,
        ease: 'back.in(1.7)',
        onComplete: () => {
          particle.parentNode?.removeChild(particle)
        },
      })
    })
    particlesRef.current = []
  }, [])

  const animateParticles = useCallback(() => {
    if (!cardRef.current || !isHoveredRef.current) return
    if (!particlesInitialized.current) initializeParticles()

    memoizedParticles.current.forEach((particle, index) => {
      const timeoutId = setTimeout(() => {
        if (!isHoveredRef.current || !cardRef.current) return
        const clone = particle.cloneNode(true) as HTMLDivElement
        cardRef.current.appendChild(clone)
        particlesRef.current.push(clone)

        gsap.fromTo(
          clone,
          { scale: 0, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.7)' },
        )
        gsap.to(clone, {
          x: (Math.random() - 0.5) * 100,
          y: (Math.random() - 0.5) * 100,
          rotation: Math.random() * 360,
          duration: 2 + Math.random() * 2,
          ease: 'none',
          repeat: -1,
          yoyo: true,
        })
        gsap.to(clone, {
          opacity: 0.3,
          duration: 1.5,
          ease: 'power2.inOut',
          repeat: -1,
          yoyo: true,
        })
      }, index * 100)
      timeoutsRef.current.push(timeoutId)
    })
  }, [initializeParticles])

  useEffect(() => {
    if (isOff || !cardRef.current) return
    const element = cardRef.current

    const handleMouseEnter = (): void => {
      isHoveredRef.current = true
      animateParticles()
      element.style.setProperty('--glow-intensity', '1')
    }
    const handleMouseLeave = (): void => {
      isHoveredRef.current = false
      clearAllParticles()
      element.style.setProperty('--glow-intensity', '0')
    }
    /* El glow del borde sigue al cursor (updateCardGlowProperties del original, por tarjeta). */
    const handleMouseMove = (e: MouseEvent): void => {
      const rect = element.getBoundingClientRect()
      element.style.setProperty(
        '--glow-x',
        `${String(((e.clientX - rect.left) / rect.width) * 100)}%`,
      )
      element.style.setProperty(
        '--glow-y',
        `${String(((e.clientY - rect.top) / rect.height) * 100)}%`,
      )
    }
    const handleClick = (e: MouseEvent): void => {
      if (!clickEffect) return
      const rect = element.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const maxDistance = Math.max(
        Math.hypot(x, y),
        Math.hypot(x - rect.width, y),
        Math.hypot(x, y - rect.height),
        Math.hypot(x - rect.width, y - rect.height),
      )
      const ripple = document.createElement('div')
      ripple.style.cssText = `
        position: absolute;
        width: ${String(maxDistance * 2)}px;
        height: ${String(maxDistance * 2)}px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(${glowColor}, 0.4) 0%, rgba(${glowColor}, 0.2) 30%, transparent 70%);
        left: ${String(x - maxDistance)}px;
        top: ${String(y - maxDistance)}px;
        pointer-events: none;
        z-index: 1000;
      `
      element.appendChild(ripple)
      gsap.fromTo(
        ripple,
        { scale: 0, opacity: 1 },
        {
          scale: 1,
          opacity: 0,
          duration: 0.8,
          ease: 'power2.out',
          onComplete: () => {
            ripple.remove()
          },
        },
      )
    }

    element.addEventListener('mouseenter', handleMouseEnter)
    element.addEventListener('mouseleave', handleMouseLeave)
    element.addEventListener('mousemove', handleMouseMove)
    element.addEventListener('click', handleClick)
    return () => {
      isHoveredRef.current = false
      element.removeEventListener('mouseenter', handleMouseEnter)
      element.removeEventListener('mouseleave', handleMouseLeave)
      element.removeEventListener('mousemove', handleMouseMove)
      element.removeEventListener('click', handleClick)
      clearAllParticles()
    }
  }, [animateParticles, clearAllParticles, isOff, clickEffect, glowColor])

  return (
    <div
      ref={cardRef}
      className={cn(
        'magic-card relative overflow-hidden',
        'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-o-500',
        className,
      )}
      style={
        {
          ...style,
          '--glow-x': '50%',
          '--glow-y': '50%',
          '--glow-intensity': '0',
          '--glow-radius': '220px',
          '--glow-rgb': glowColor,
        } as CSSProperties
      }
    >
      {children}
    </div>
  )
}
