import { MaterialIcon } from '@oranje/ui'
import { useState, type ReactNode } from 'react'

/**
 * La hoja: el contrato como documento, con una barra de zoom encima
 * (referencia: visor de documento a la izquierda, verificación a la
 * derecha). Es vista previa — el PDF firmado llegará por su lado.
 */
const ZOOMS = [0.8, 0.9, 1, 1.1, 1.25] as const

export function ContractPaper({ children }: { children: ReactNode }): ReactNode {
  const [zoomIndex, setZoomIndex] = useState(2)
  const zoom = ZOOMS[zoomIndex] ?? 1

  return (
    <section className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface-2">
      <div className="flex items-center gap-1 border-b border-line bg-surface px-3 py-2">
        <button
          type="button"
          aria-label="Alejar"
          disabled={zoomIndex === 0}
          onClick={() => {
            setZoomIndex((index) => Math.max(0, index - 1))
          }}
          className="flex size-9 cursor-pointer items-center justify-center rounded-md text-ink-2 hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <MaterialIcon name="remove" className="text-lg" />
        </button>
        <span className="w-14 text-center text-sm font-semibold text-ink">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          aria-label="Acercar"
          disabled={zoomIndex === ZOOMS.length - 1}
          onClick={() => {
            setZoomIndex((index) => Math.min(ZOOMS.length - 1, index + 1))
          }}
          className="flex size-9 cursor-pointer items-center justify-center rounded-md text-ink-2 hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <MaterialIcon name="add" className="text-lg" />
        </button>
        <span className="mx-1 h-5 w-px bg-line" aria-hidden />
        <button
          type="button"
          aria-label="Tamaño original"
          onClick={() => {
            setZoomIndex(2)
          }}
          className="flex size-9 cursor-pointer items-center justify-center rounded-md text-ink-2 hover:bg-surface-2"
        >
          <MaterialIcon name="restart_alt" className="text-lg" />
        </button>
        <span className="ml-auto text-xs text-ink-3">
          Vista previa · el PDF firmado llegará aparte
        </span>
      </div>

      <div className="overflow-auto p-4 sm:p-6">
        <div
          className="mx-auto w-full max-w-3xl origin-top rounded-md bg-surface p-6 shadow-md transition-transform duration-200 sm:p-8"
          style={{ transform: `scale(${String(zoom)})` }}
        >
          {children}
        </div>
      </div>
    </section>
  )
}
