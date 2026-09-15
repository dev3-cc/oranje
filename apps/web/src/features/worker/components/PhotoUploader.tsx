import { Trans, useLingui } from '@lingui/react/macro'
import { toast } from '@oranje/ui'
import { useRef, useState, type ReactNode } from 'react'

import { useCompleteSignupMutation } from '../api/workerApi'

import { useUploadFileMutation } from '@/app/filesApi'
import { Button } from '@/shared/components/Button'
import { apiErrorMessage } from '@/shared/lib/apiError'

/**
 * Subir mi foto (Hugo, 2026-09-15): normalmente la captura la Reclutadora en
 * la entrevista, pero un expediente migrado puede llegar sin ella — el
 * colaborador también debe poder subirla, junto al transporte y el SSN/ITIN.
 * `POST /files` (WORKER_PHOTO) → `PATCH /workers/me/signup`.
 */
export function PhotoUploader({ photoUrl }: { photoUrl: string | null }): ReactNode {
  const { t } = useLingui()
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploadFile, { isLoading: isUploadingFile }] = useUploadFileMutation()
  const [save, { isLoading: isSaving }] = useCompleteSignupMutation()
  const [error, setError] = useState<string | null>(null)
  const isBusy = isUploadingFile || isSaving
  const shown = preview ?? photoUrl

  async function onChosen(file: File): Promise<void> {
    setError(null)
    setPreview(URL.createObjectURL(file))
    try {
      const { path } = await uploadFile({ file, purpose: 'WORKER_PHOTO' }).unwrap()
      await save({ photoPath: path }).unwrap()
      toast.success(t`Foto guardada`)
    } catch (cause) {
      setPreview(null)
      setError(
        apiErrorMessage(cause, {
          byCode: {
            UNSUPPORTED_FILE_TYPE: t`Ese formato no se pudo leer: usa JPG, PNG o WebP.`,
          },
          fallback: t`No se pudo subir tu foto. Inténtalo de nuevo.`,
        }),
      )
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        aria-label={shown ? t`Cambiar mi foto` : t`Subir mi foto`}
        title={shown ? t`Cambiar mi foto` : t`Subir mi foto`}
        disabled={isBusy}
        onClick={() => {
          inputRef.current?.click()
        }}
        className="group relative size-16 shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-line bg-o-50 disabled:cursor-wait"
      >
        {shown ? (
          <img src={shown} alt="" className="size-full object-cover" />
        ) : (
          <span
            aria-hidden
            className="flex size-full items-center justify-center text-2xl text-o-700"
          >
            <span className="material-icons-outlined">photo_camera</span>
          </span>
        )}
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center bg-ink/50 text-[10px] font-semibold text-surface opacity-0 transition-opacity group-hover:opacity-100"
        >
          {isBusy ? t`Subiendo…` : t`Cambiar`}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="user"
        className="hidden"
        aria-label={t`Foto`}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void onChosen(file)
        }}
      />
      <div className="flex flex-col gap-1">
        <Button
          variant="secondary"
          disabled={isBusy}
          onClick={() => {
            inputRef.current?.click()
          }}
        >
          {shown ? <Trans>Cambiar foto</Trans> : <Trans>Subir mi foto</Trans>}
        </Button>
        {error !== null && (
          <p role="alert" className="text-xs text-red">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
