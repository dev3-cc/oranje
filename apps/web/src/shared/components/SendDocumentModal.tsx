import { Trans, useLingui } from '@lingui/react/macro'
import { useState, type ReactNode } from 'react'

import { Button } from './Button'
import { FormField } from './FormField'
import { Modal } from './Modal'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * «Enviar por correo» de Propuesta y Contrato (Hugo, 2026-10-17): el mismo
 * modal para los dos documentos, solo cambia el título y a quién se le
 * manda. El PDF ya lo generó quien abre el modal — aquí solo se pide el
 * destinatario y, si hace falta, una nota.
 *
 * No genera el PDF ni llama al API: eso es de cada pantalla, que sabe cuál
 * endpoint y qué documento adjuntar. Este componente solo junta `to`/`note`
 * y avisa con `onConfirm`.
 */
export function SendDocumentModal({
  isOpen,
  onClose,
  title,
  defaultTo = null,
  isSending,
  error = null,
  onConfirm,
}: {
  isOpen: boolean
  onClose: () => void
  title: string
  /** El correo del contacto principal del hotel, si se conoce. */
  defaultTo?: string | null
  isSending: boolean
  error?: string | null
  onConfirm: (params: { to: string; note: string }) => void
}): ReactNode {
  const { t } = useLingui()
  const [to, setTo] = useState(defaultTo ?? '')
  const [note, setNote] = useState('')

  const toValid = EMAIL_RE.test(to.trim())

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={t`Se manda desde notificaciones@oranjepeople.com — las respuestas del hotel llegan a tu correo.`}
      className="max-w-lg"
      footer={
        <>
          <Button onClick={onClose} disabled={isSending}>
            <Trans>Cancelar</Trans>
          </Button>
          <Button
            variant="primary"
            disabled={!toValid || isSending}
            onClick={() => {
              onConfirm({ to: to.trim(), note: note.trim() })
            }}
          >
            {isSending ? <Trans>Enviando…</Trans> : <Trans>Enviar correo</Trans>}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <FormField
          label={t`Para`}
          htmlFor="send-document-to"
          hint={t`Se propone el correo del contacto principal del hotel — puedes cambiarlo.`}
          error={to !== '' && !toValid ? t`Escribe un correo válido` : undefined}
        >
          <input
            id="send-document-to"
            type="email"
            required
            value={to}
            onChange={(event) => {
              setTo(event.target.value)
            }}
            placeholder={t`gerencia@hotel.com`}
            className="w-full rounded-md border border-line bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-4 focus:border-o-500 focus:outline-none"
          />
        </FormField>

        <FormField label={t`Nota para el hotel`} htmlFor="send-document-note">
          <textarea
            id="send-document-note"
            rows={3}
            value={note}
            onChange={(event) => {
              setNote(event.target.value)
            }}
            placeholder={t`Un mensaje breve antes del documento (opcional)…`}
            className="w-full resize-none rounded-md border border-line bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-4 focus:border-o-500 focus:outline-none"
          />
        </FormField>

        <p className="rounded-md bg-o-50 p-4 text-sm leading-relaxed text-ink-2">
          <Trans>
            El PDF del documento se adjunta solo. Queda registrado en el historial de correos.
          </Trans>
        </p>

        {error !== null && (
          <p role="alert" className="text-sm text-red">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
