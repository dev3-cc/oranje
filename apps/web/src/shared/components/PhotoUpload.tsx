import { useRef, useState, type ReactNode } from 'react'

import { useUploadFileMutation } from '@/app/filesApi'
import { IS_DEV_UI } from '@/shared/lib/devMode'

/**
 * Foto con subida REAL: elige (o toma, en móvil) la imagen, la sube a
 * `POST /files` y entrega el `path` que las entidades guardan. La vista
 * previa es local (`URL.createObjectURL`), así que se ve al instante aunque
 * la URL firmada tarde.
 */
export function PhotoUpload({
  label = 'Foto',
  initials,
  currentUrl = null,
  onUploaded,
}: {
  label?: string
  /** Se pintan mientras no hay foto: el avatar del Expediente. */
  initials: string
  /** Foto ya guardada (URL firmada del backend), si existe. */
  currentUrl?: string | null
  onUploaded: (path: string) => void
}): ReactNode {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [upload, { isLoading, isError }] = useUploadFileMutation()

  const shown = preview ?? currentUrl

  async function handleFile(file: File): Promise<void> {
    setPreview(URL.createObjectURL(file))
    try {
      const stored = await upload({ file, purpose: 'WORKER_PHOTO' }).unwrap()
      onUploaded(stored.path)
    } catch {
      /* el error queda en `isError` y se pinta abajo */
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm text-ink-3">
        {label} <span className="text-ink-4">(opcional, no integra el perfil)</span>
        {IS_DEV_UI && <code className="text-xs text-ink-4"> · photo_path</code>}
      </span>
      <div className="flex items-center gap-3">
        {shown ? (
          <img
            src={shown}
            alt="Vista previa de la foto"
            className="size-12 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-o-50 text-sm font-bold text-o-700"
          >
            {initials === '' ? '·' : initials}
          </span>
        )}
        <button
          type="button"
          disabled={isLoading}
          onClick={() => {
            inputRef.current?.click()
          }}
          className="cursor-pointer rounded-md border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-2 disabled:opacity-50"
        >
          {isLoading ? 'Subiendo…' : shown ? 'Cambiar foto' : 'Tomar foto'}
        </button>
        {/* `capture` invita a la cámara en el teléfono; en escritorio abre archivos. */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          aria-label={label}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void handleFile(file)
          }}
        />
      </div>
      {isError && (
        <span className="text-xs text-red">No se pudo subir la foto. Inténtalo de nuevo.</span>
      )}
    </div>
  )
}
