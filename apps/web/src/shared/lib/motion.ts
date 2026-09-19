import type { TargetAndTransition, Transition } from 'framer-motion'

/**
 * El estándar de movimiento del front (Convenciones de Diseño solo fija la
 * curva `--ease`; esto fija lo demás). Una sola fuente para framer-motion:
 *
 * - Micro-interacciones (hover, chips, botones): 150–200 ms.
 * - Entradas de contenido (pantalla, tarjeta, modal): 250 ms, ease-out.
 * - Salidas: 150 ms, ease-in — lo que se va no debe estorbar.
 * - Nada de UI por encima de 400 ms; lo continuo solo en loaders (el aura y
 *   las naranjas del ponche son la excepción aceptada: decorativas y pausadas
 *   con `prefers-reduced-motion`).
 * - 1–2 elementos animados por vista, y solo `transform`/`opacity`.
 * - `useReducedMotion()` manda: con reduce, sin desplazamiento y sin repeat.
 */
export const MOTION = {
  micro: 0.18,
  enter: 0.25,
  exit: 0.15,
  /** `--ease` del vault: cubic-bezier(.4, 0, .2, 1). */
  ease: [0.4, 0, 0.2, 1] as const,
  easeOut: [0, 0, 0.2, 1] as const,
  easeIn: [0.4, 0, 1, 1] as const,
} as const

/** La entrada estándar de una pantalla o tarjeta: aparece y sube 8 px. */
export function pageTransition(reduceMotion: boolean): {
  initial: TargetAndTransition
  animate: TargetAndTransition
  exit: TargetAndTransition
  transition: Transition
} {
  return {
    initial: { opacity: 0, y: reduceMotion ? 0 : 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 0 },
    transition: { duration: reduceMotion ? 0 : MOTION.enter, ease: [...MOTION.easeOut] },
  }
}

/**
 * Desplazamiento lateral con dirección: `custom` es +1 (voy hacia la derecha
 * en el orden de pestañas: lo nuevo entra desde la derecha) o -1. Con reduce,
 * solo fundido.
 */
export const slideVariants = {
  initial: (custom: { direction: number; reduceMotion: boolean }) => ({
    opacity: 0,
    x: custom.reduceMotion ? 0 : custom.direction * 40,
  }),
  animate: { opacity: 1, x: 0 },
  exit: (custom: { direction: number; reduceMotion: boolean }) => ({
    opacity: 0,
    x: custom.reduceMotion ? 0 : custom.direction * -40,
  }),
}

/**
 * Los springs afinados: `snappy` para lo que sigue al dedo (píldoras,
 * pantallas), `gentle` para lo que aparece solo. Sin rebote visible
 * (damping alto) — es una app de trabajo, no un juguete.
 */
export const SPRING = {
  snappy: { type: 'spring', stiffness: 420, damping: 38, mass: 0.8 },
  gentle: { type: 'spring', stiffness: 260, damping: 30 },
} as const satisfies Record<string, Transition>

export function slideTransition(reduceMotion: boolean): Transition {
  return reduceMotion ? { duration: 0 } : SPRING.snappy
}

/** Feedback táctil de un botón grande: se hunde 3 % bajo el dedo. */
export function tapFeedback(reduceMotion: boolean): { whileTap?: { scale: number } } {
  return reduceMotion ? {} : { whileTap: { scale: 0.97 } }
}
