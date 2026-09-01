import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import type { ReactNode } from 'react'

import { useGetSessionQuery } from '@/app/sessionApi'
import auraAnimation from '@/assets/dashboard/oranje-aura.lottie'
import { FoldText } from '@/shared/components/FoldText'

function initialsOf(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase()
}

/**
 * La cabecera con identidad de TODOS los dashboards: el título ES la persona
 * — su foto con el aura Lottie detrás, su nombre y su alcance en una línea.
 * Nació en el de Ventas; Reclutamiento y Hotel la comparten para que cada
 * rol reciba el mismo trato. `children` es el adorno del fondo (el globo).
 */
export function IdentityHeader({
  name,
  subtitle,
  children,
}: {
  name: string
  subtitle: string
  children?: ReactNode
}): ReactNode {
  const { data: session } = useGetSessionQuery()

  return (
    <header className="relative overflow-hidden rounded-none bg-transparent px-0 py-2 shadow-none sm:rounded-2xl sm:bg-surface sm:px-8 sm:py-7 sm:shadow-md">
      {/* En móvil la FOTO va sola hasta arriba, centrada; en escritorio, avatar y nombre en fila. */}
      <div className="relative z-10 flex max-w-xl flex-col items-center gap-3 text-center sm:flex-row sm:items-center sm:gap-4 sm:text-left">
        {/* El aura Lottie vive DETRÁS del avatar, centrada y sin atrapar clics. */}
        <div className="relative flex size-32 shrink-0 items-center justify-center sm:size-24">
          <DotLottieReact
            src={auraAnimation}
            loop
            autoplay
            className="pointer-events-none absolute inset-0 size-full"
          />
          {session?.photoUrl ? (
            <img
              src={session.photoUrl}
              alt=""
              aria-hidden
              className="relative size-20 rounded-full object-cover shadow-md sm:size-16"
            />
          ) : (
            <span
              aria-hidden
              className="relative flex size-20 items-center justify-center rounded-full bg-o-500/15 text-2xl font-bold text-o-700 sm:size-16"
            >
              {initialsOf(name)}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            <FoldText text={name} />
          </h1>
          <p className="mt-1.5 text-sm text-ink-3">{subtitle}</p>
        </div>
      </div>
      {children}
    </header>
  )
}
