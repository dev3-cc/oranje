/**
 * Tokens Oranje — LA ÚNICA DEFINICIÓN.
 *
 * Fuente: `Convenciones de Diseño` del vault. Los nombres NO se renombran
 * (§6 de Estructura de Proyecto): `--o-500` se llama `o-500` aquí y
 * `--color-o-500` en Tailwind, que se declara *derivado*, nunca al revés.
 *
 * De este archivo salen DOS emisiones (enmienda de D-12):
 *   - `src/styles/tokens.css` -> `@theme` de Tailwind 4, lo consume apps/web
 *   - `tailwind-preset.ts`    -> objeto de tema para el config v3 del móvil
 *
 * Un color de semáforo escrito a mano en un className (`bg-[#e63946]`) rompe
 * lo que este archivo garantiza: que el rojo de Requisición sea el mismo en la
 * tabla del web y en la tarjeta del móvil.
 */

/** Paleta de marca. `o-500` corregido a #FF8000 el 2026-08-10 con el Portfolio Oranje 2024. */
export const brand = {
  'o-50': '#FFF6E8',
  'o-500': '#FF8000',
  'o-700': '#C85F00',
} as const

export const neutral = {
  bg: '#F6F4F1',
  surface: '#FFFFFF',
  'surface-2': '#FBFAF8',
  'surface-3': '#EFEBE6',
  line: '#E3DDD5',
  ink: '#1A1108',
  'ink-2': '#4A3F35',
  'ink-3': '#7A6D60',
  /** 2.7:1 — reprueba AA a propósito. Placeholder y deshabilitado, nunca texto legible. */
  'ink-4': '#A79A8C',
} as const

export const semantic = {
  red: '#E11919',
  yellow: '#FFD500',
  green: '#1FA84A',
  blue: '#3B7DDD',
  purple: '#7B2CBF',
} as const

/**
 * Los 12 estados del Semáforo del Colaborador. Sirven también a Requisición y
 * Onboarding: un color se ve igual en todos los semáforos, lo que cambia es qué
 * significa en cada uno.
 *
 * NO se mapean a variables de shadcn (D-16): los consume `SemaforoBadge`.
 */
export const statusLight = {
  'st-blanco': '#FFFFFF',
  'st-negro': '#1A1108',
  'st-verde-manzana': '#8CC63F',
  'st-azul-claro': '#5BC0EB',
  /** NO es `o-500`. Separación medida: ΔE 11.0. Ver regla 2 de contraste. */
  'st-naranja': '#F2711C',
  'st-rosa': '#FF6FA5',
  'st-morado': '#7B2CBF',
  'st-rojo': '#E11919',
  'st-amarillo': '#FFD500',
  'st-verde': '#1FA84A',
  'st-cafe': '#8B5E34',
  'st-gris': '#9A9A9A',
} as const

/**
 * Color de texto de cada chip de semáforo. No es preferencia: sale de medir.
 * `st-amarillo` con blanco da 1.4:1 y `o-500` da 2.5:1 — ambos ilegibles.
 */
export const statusLightForeground = {
  'st-blanco': neutral.ink,
  'st-negro': '#FFFFFF',
  'st-verde-manzana': neutral.ink,
  'st-azul-claro': neutral.ink,
  'st-naranja': neutral.ink,
  'st-rosa': neutral.ink,
  'st-morado': '#FFFFFF',
  'st-rojo': '#FFFFFF',
  'st-amarillo': neutral.ink,
  'st-verde': '#FFFFFF',
  'st-cafe': '#FFFFFF',
  'st-gris': neutral.ink,
} as const satisfies Record<keyof typeof statusLight, string>

export const radius = {
  'r-sm': '8px',
  'r-md': '12px',
  'r-lg': '18px',
} as const

export const layout = {
  /** Ancho del sidebar */
  sb: '248px',
  /** Alto del header */
  hd: '64px',
} as const

/** Tintadas con el valor de `ink`, no negro puro: un negro neutro ensucia el naranja. */
export const shadow = {
  'sh-sm': '0 1px 2px rgba(26, 17, 8, .06)',
  'sh-md': '0 4px 12px rgba(26, 17, 8, .08)',
  'sh-lg': '0 12px 32px rgba(26, 17, 8, .12)',
  'sh-orange': '0 6px 20px rgba(255, 128, 0, .28)',
} as const

export const ease = 'cubic-bezier(.4, 0, .2, 1)'

/**
 * Montserrat, verificada contra el Portfolio Oranje 2024 (D-17).
 * Se sirve desde el bundle: `import '@fontsource-variable/montserrat'`.
 */
export const font = {
  sans: "'Montserrat Variable', 'Montserrat', ui-sans-serif, system-ui, sans-serif",
} as const

export const color = { ...brand, ...neutral, ...semantic, ...statusLight } as const

export type ColorToken = keyof typeof color
export type StatusLightToken = keyof typeof statusLight

export const tokens = {
  brand,
  neutral,
  semantic,
  statusLight,
  statusLightForeground,
  color,
  radius,
  layout,
  shadow,
  ease,
  font,
} as const
