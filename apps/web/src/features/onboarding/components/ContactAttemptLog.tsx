import { MaterialIcon } from '@oranje/ui'
import { useState, type ReactNode } from 'react'

import type { ContactAttempt } from '../types/prospect.types'

import { SectionCard } from '@/shared/components/SectionCard'
import { formatDayMonth } from '@/shared/lib/formatters'

/**
 * La bitácora es append-only para todos MENOS para el autor de cada intento:
 * él puede corregir su dedazo o borrar la prueba (la API lo verifica, aquí
 * solo se ofrece la acción a quien puede usarla). Borrar pide doble clic:
 * primero pregunta, el segundo ejecuta.
 */
export function ContactAttemptLog({
  attempts,
  sessionUserId,
  onEdit,
  onDelete,
}: {
  attempts: ContactAttempt[]
  sessionUserId?: string | undefined
  onEdit?: (attempt: ContactAttempt) => void
  onDelete?: (attempt: ContactAttempt) => void
}): ReactNode {
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  return (
    <SectionCard title="Bitácora de intentos de contacto">
      {attempts.length === 0 ? (
        <p className="py-2 text-sm text-ink-3">
          Sin intentos registrados. Usa «Registrar intento» para anotar el primero.
        </p>
      ) : (
        <ul>
          {attempts.map((attempt, index) => {
            const isOwn = sessionUserId !== undefined && attempt.userId === sessionUserId
            const isConfirming = confirmingId === attempt.id

            return (
              <li
                key={attempt.id}
                className={
                  index === 0
                    ? 'grid grid-cols-[64px_130px_1fr_auto_auto] items-baseline gap-4 pb-3.5'
                    : 'grid grid-cols-[64px_130px_1fr_auto_auto] items-baseline gap-4 border-t border-line py-3.5 last:pb-0'
                }
              >
                <span className="text-sm text-ink-3">{formatDayMonth(attempt.occurredAt)}</span>
                <span className="text-sm font-semibold text-ink">{attempt.channel}</span>
                <span className="text-sm text-ink-2">{attempt.outcome}</span>
                <span className="text-sm text-ink-3">{attempt.byName}</span>

                <span className="flex items-center gap-1 justify-self-end">
                  {isOwn && onEdit && !isConfirming && (
                    <button
                      type="button"
                      aria-label="Corregir este intento"
                      title="Corregir este intento"
                      onClick={() => {
                        onEdit(attempt)
                      }}
                      className="rounded p-1 text-ink-4 transition-colors hover:bg-surface-2 hover:text-o-700"
                    >
                      <MaterialIcon name="edit" className="text-base" />
                    </button>
                  )}
                  {isOwn &&
                    onDelete &&
                    (isConfirming ? (
                      <span className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmingId(null)
                            onDelete(attempt)
                          }}
                          className="rounded bg-red/10 px-2 py-0.5 text-xs font-semibold text-red transition-colors hover:bg-red/20"
                        >
                          Sí, borrar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmingId(null)
                          }}
                          className="rounded px-2 py-0.5 text-xs text-ink-3 hover:bg-surface-2"
                        >
                          Conservar
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        aria-label="Eliminar este intento"
                        title="Eliminar este intento"
                        onClick={() => {
                          setConfirmingId(attempt.id)
                        }}
                        className="rounded p-1 text-ink-4 transition-colors hover:bg-surface-2 hover:text-red"
                      >
                        <MaterialIcon name="delete" className="text-base" />
                      </button>
                    ))}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </SectionCard>
  )
}
