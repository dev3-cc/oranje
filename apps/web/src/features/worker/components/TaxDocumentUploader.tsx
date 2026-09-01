import { MaterialIcon, toast } from '@oranje/ui'
import { useRef, useState, type ReactNode } from 'react'

import { useUploadMyDocumentMutation } from '../api/workerApi'

import { useUploadFileMutation } from '@/app/filesApi'
import { Button } from '@/shared/components/Button'
import { apiErrorMessage } from '@/shared/lib/apiError'

/**
 * Subir el SSN/ITIN (RF-C-01): una foto clara o un PDF → `POST /files`
 * (WORKER_DOCUMENT) → `POST /workers/me/documents`. Vive en Mis datos y en
 * la pantalla de suspensión del día 5: cargarlo es lo que levanta el acceso
 * (D-33), así que nunca puede quedar detrás de la suspensión.
 */
export function TaxDocumentUploader({ hasDocument }: { hasDocument: boolean }): ReactNode {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploadFile, { isLoading: isUploadingFile }] = useUploadFileMutation()
  const [uploadDocument, { isLoading: isSavingDocument }] = useUploadMyDocumentMutation()
  const [error, setError] = useState<string | null>(null)
  const isBusy = isUploadingFile || isSavingDocument

  async function onChosen(file: File): Promise<void> {
    setError(null)
    try {
      const { path } = await uploadFile({ file, purpose: 'WORKER_DOCUMENT' }).unwrap()
      await uploadDocument({ documentType: 'SSN_ITIN', filePath: path }).unwrap()
      toast.success('SSN o ITIN subido')
    } catch (cause) {
      setError(
        apiErrorMessage(cause, {
          byCode: {
            UNSUPPORTED_FILE_TYPE: 'Ese archivo no se pudo leer: sube una foto clara o un PDF.',
            FORBIDDEN:
              'Tu cuenta aún no tiene permiso para subir archivos: Oranje lo está habilitando.',
          },
          fallback: 'No se pudo subir tu documento. Inténtalo de nuevo.',
        }),
      )
    }
  }

  return (
    <div className="flex w-full flex-col gap-3">
      {hasDocument && (
        <div className="flex items-center gap-3 rounded-md bg-green/10 px-4 py-3 text-left">
          <MaterialIcon name="task_alt" className="text-xl text-green" aria-hidden />
          <span className="text-sm text-ink-2">
            Documento recibido. Si te equivocaste de archivo, súbelo de nuevo y reemplaza el
            anterior.
          </span>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        aria-label="Archivo del SSN o ITIN"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void onChosen(file)
        }}
      />
      <Button
        variant={hasDocument ? 'secondary' : 'primary'}
        disabled={isBusy}
        onClick={() => {
          inputRef.current?.click()
        }}
        className="w-full"
      >
        {isBusy ? 'Subiendo…' : hasDocument ? 'Subir otro archivo' : 'Subir mi SSN o ITIN'}
      </Button>
      <p className="text-xs text-ink-3">
        Una foto clara o un PDF. Oranje lo revisa y te avisa cuando quede verificado.
      </p>
      {error !== null && (
        <p role="alert" className="text-sm text-red">
          {error}
        </p>
      )}
    </div>
  )
}
