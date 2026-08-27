import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import type { ReactNode } from 'react'

import loadingData from '@/assets/loader/loading_data/oranje-loading.lottie'

/**
 * La animación oficial de «cargando datos» (Lottie), con su texto. Es la
 * pieza que comparten LoadingState y los skeletons: un solo lugar decide qué
 * se ve mientras el sistema trae información.
 */
export function DataLoader({
  label,
  className = 'h-24 w-24',
}: {
  label?: string
  className?: string
}): ReactNode {
  return (
    <div role="status" className="flex flex-col items-center gap-1.5">
      <DotLottieReact src={loadingData} loop autoplay className={className} />
      {label !== undefined && <p className="text-sm font-medium text-ink-2">{label}</p>}
    </div>
  )
}
