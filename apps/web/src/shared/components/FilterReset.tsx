import { MaterialIcon } from '@oranje/ui'
import type { ReactNode } from 'react'

/**
 * «Quitar filtros»: aparece SOLO cuando hay filtros activos (auditoría del
 * 2026-09-04: ninguna pantalla tenía forma de volver a ver todo sin abrir
 * cada select). Dice cuántos hay para que la persona entienda por qué la
 * lista está corta. Es un botón con texto — no un icono suelto.
 */
export function FilterReset({
  activeCount,
  onReset,
}: {
  /** Cuántos filtros están fuera de su valor «todos». 0 = no se dibuja. */
  activeCount: number
  onReset: () => void
}): ReactNode {
  if (activeCount === 0) return null
  return (
    <button
      type="button"
      onClick={onReset}
      className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-dashed border-o-500/60 px-3 py-1.5 text-sm font-medium text-o-700 transition-colors hover:bg-o-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
    >
      <MaterialIcon name="filter_alt_off" className="text-base" aria-hidden />
      Quitar filtros
      <span className="rounded-full bg-o-500 px-1.5 text-[11px] font-bold text-ink">
        {activeCount}
      </span>
    </button>
  )
}
