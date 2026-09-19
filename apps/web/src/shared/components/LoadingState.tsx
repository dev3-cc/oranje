import type { ReactNode } from 'react'

import { DataLoader } from '@/shared/components/DataLoader'

/**
 * La carga de página completa: la animación oficial de datos + qué se está
 * trayendo. Para cargas de COMPONENTE (una lista dentro de un diálogo)
 * siguen bastando los skeletons o una línea — esto es para cuando la
 * pantalla entera espera.
 */
export function LoadingState({ label }: { label: string }): ReactNode {
  return (
    <div className="flex flex-col items-center rounded-xl border border-line bg-surface px-8 py-14 text-center">
      <DataLoader label={label} className="h-28 w-28" />
    </div>
  )
}
