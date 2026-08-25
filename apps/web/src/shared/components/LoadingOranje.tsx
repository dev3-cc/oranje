import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import type { ReactNode } from 'react'

import loadingAnimation from '@/assets/loader/loading.lottie'

export function LoadingOranje({ label = 'Cargando…' }: { label?: string }): ReactNode {
  return (
    <div
      role="status"
      aria-label={label}
      className="flex min-h-screen flex-col items-center justify-center gap-2 bg-surface-2"
    >
      <div className="h-44 w-44">
        <DotLottieReact src={loadingAnimation} loop autoplay />
      </div>
      <p className="text-sm text-ink-3">{label}</p>
    </div>
  )
}
