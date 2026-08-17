/**
 * Preset de Tailwind 3 para `apps/mobile` (NativeWind 4).
 *
 * El web NO usa este archivo: va en Tailwind 4, donde el tema se declara en CSS
 * con `@theme` (ver `src/styles/tokens.css`). Esta es la segunda emisión de
 * `tokens.ts`, no una segunda fuente — enmienda de D-12.
 *
 * Se elimina cuando NativeWind 5 sea estable y el móvil suba a Tailwind 4.
 */
import { color, ease, font, layout, radius, shadow } from './tokens'

const preset = {
  theme: {
    extend: {
      colors: color,
      fontFamily: { sans: font.sans.split(',').map((f) => f.trim()) },
      borderRadius: {
        sm: radius['r-sm'],
        md: radius['r-md'],
        lg: radius['r-lg'],
      },
      spacing: { sb: layout.sb, hd: layout.hd },
      boxShadow: {
        sm: shadow['sh-sm'],
        md: shadow['sh-md'],
        lg: shadow['sh-lg'],
        orange: shadow['sh-orange'],
      },
      transitionTimingFunction: { oranje: ease },
    },
  },
}

export default preset
