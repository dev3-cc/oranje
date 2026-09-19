import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'

/*
 * StarBorder de reactbits (https://reactbits.dev/animations/star-border),
 * de su fuente oficial (react-bits, TS+Tailwind). Dos adaptaciones
 * documentadas: es un `div` fijo en vez del polimórfico `as` (el `as any`
 * del original no pasa nuestro strict; aquí solo envuelve tarjetas) y el
 * contenido interno NO impone el fondo oscuro de botón del original — los hijos son dueños de su superficie. Los keyframes
 * (`star-movement-*`) viven en `shadcn-vars.css`, con el `alternate` del
 * original.
 */

type StarBorderProps = HTMLAttributes<HTMLDivElement> & {
  className?: string
  children?: ReactNode
  color?: string
  speed?: CSSProperties['animationDuration']
  thickness?: number
}

export const StarBorder = ({
  className = '',
  color = 'var(--o-500)',
  speed = '6s',
  thickness = 1,
  children,
  ...rest
}: StarBorderProps): ReactNode => {
  return (
    <div
      className={`relative inline-block w-full overflow-hidden rounded-[20px] ${className}`}
      {...rest}
      style={{
        padding: `${String(thickness)}px 0`,
        ...rest.style,
      }}
    >
      <div
        aria-hidden
        className="absolute right-[-250%] bottom-[-11px] z-0 h-[50%] w-[300%] rounded-full opacity-70 motion-safe:animate-[star-movement-bottom_linear_infinite_alternate]"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animationDuration: speed,
        }}
      ></div>
      <div
        aria-hidden
        className="absolute top-[-10px] left-[-250%] z-0 h-[50%] w-[300%] rounded-full opacity-70 motion-safe:animate-[star-movement-top_linear_infinite_alternate]"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animationDuration: speed,
        }}
      ></div>
      <div className="relative z-[1] rounded-[20px]">{children}</div>
    </div>
  )
}
