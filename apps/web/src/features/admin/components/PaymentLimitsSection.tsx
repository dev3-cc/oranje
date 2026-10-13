import { Trans, useLingui } from '@lingui/react/macro'
import { toast } from '@oranje/ui'
import { useState, type ReactNode } from 'react'

import {
  useGetPaymentLimitsQuery,
  useUpdatePaymentLimitsMutation,
  type PaymentLimits,
} from '../api/paymentLimitsApi'

import { Button } from '@/shared/components/Button'
import { LoadError } from '@/shared/components/LoadError'
import { useCan } from '@/shared/hooks/useCan'
import { apiErrorMessage } from '@/shared/lib/apiError'

type LimitKey = keyof PaymentLimits

/**
 * Los límites de pago y aprobación. Los días son fijos por el ciclo (miércoles,
 * jueves, sábado); estas son las horas, en la zona de cada hotel. Vive junto a
 * los ajustes del correo porque es la misma clase de cosa: lo que el
 * Administrador mueve sin desplegar.
 */
export function PaymentLimitsSection(): ReactNode {
  const { t } = useLingui()
  const can = useCan()
  const canManage = can('settings:manage')

  const { data, isLoading, isError, refetch } = useGetPaymentLimitsQuery()
  const [updateLimits, { isLoading: isSaving }] = useUpdatePaymentLimitsMutation()

  /* El borrador vive aparte: lo que el servidor devolvió no se pisa mientras
     la persona escribe. Se reinicia cada vez que llega un valor nuevo. */
  const [draft, setDraft] = useState<PaymentLimits | null>(null)
  const [error, setError] = useState<string | null>(null)

  const values = draft ?? data ?? null

  if (isError) {
    return (
      <LoadError
        message={t`No se pudieron cargar los límites de pago.`}
        onRetry={(): void => void refetch()}
      />
    )
  }

  if (isLoading || values === null) {
    return <div className="h-48 animate-pulse rounded-[18px] bg-surface-3" />
  }

  const changed = (Object.keys(values) as LimitKey[]).filter((key) => values[key] !== data?.[key])

  function edit(key: LimitKey, value: string): void {
    setError(null)
    setDraft({ ...values!, [key]: value })
  }

  async function save(): Promise<void> {
    if (!draft || changed.length === 0) return

    const patch: Partial<PaymentLimits> = {}
    for (const key of changed) patch[key] = draft[key]

    setError(null)
    try {
      await updateLimits(patch).unwrap()
      setDraft(null)
      toast.success(t`Límites guardados`)
    } catch (caught) {
      setError(
        apiErrorMessage(caught, {
          fallback: t`No se pudieron guardar los límites. Inténtalo de nuevo.`,
        }),
      )
    }
  }

  return (
    <section className="rounded-[18px] border border-line bg-surface p-5">
      <h2 className="text-base font-semibold text-ink">
        <Trans>Calendario de pago y aprobación</Trans>
      </h2>
      <p className="mt-1 mb-4 text-sm text-ink-3">
        <Trans>
          Las horas son de la zona horaria de cada hotel. Los días son fijos: el plazo y el corte
          son miércoles, el envío de emergencia es jueves y el correo de horas sale el sábado.
        </Trans>
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Limite
          id="payment-approval-deadline"
          label={t`Plazo para aprobar las horas (miércoles)`}
          hint={t`El Manager de Área aprueba hasta esta hora.`}
          value={values.approvalDeadline}
          disabled={!canManage || isSaving}
          onChange={(value): void => edit('approvalDeadline', value)}
        />
        <Limite
          id="payment-cut"
          label={t`Corte de pago (miércoles)`}
          hint={t`Lo aprobado hasta aquí se paga ese día.`}
          value={values.paymentCut}
          disabled={!canManage || isSaving}
          onChange={(value): void => edit('paymentCut', value)}
        />
        <Limite
          id="payment-emergency-send"
          label={t`Envío de emergencia (jueves)`}
          hint={t`Paga lo que se aprobó después del corte del miércoles.`}
          value={values.emergencySend}
          disabled={!canManage || isSaving}
          onChange={(value): void => edit('emergencySend', value)}
        />
        <Limite
          id="hours-saturday-notice"
          label={t`Correo de horas (sábado)`}
          hint={t`Sale siempre, con o sin pendientes.`}
          value={values.saturdayNotice}
          disabled={!canManage || isSaving}
          onChange={(value): void => edit('saturdayNotice', value)}
        />
      </div>

      {!canManage && (
        <p className="mt-3 text-xs text-ink-3">
          <Trans>Cambiar esto es del Administrador.</Trans>
        </p>
      )}

      {error !== null && (
        <p role="alert" className="mt-4 text-sm text-st-rojo">
          {error}
        </p>
      )}

      {canManage && (
        <div className="mt-4 flex justify-end gap-2">
          {draft !== null && (
            <Button
              variant="secondary"
              onClick={(): void => {
                setDraft(null)
                setError(null)
              }}
              disabled={isSaving}
            >
              <Trans>Descartar cambios</Trans>
            </Button>
          )}
          <Button onClick={(): void => void save()} disabled={changed.length === 0 || isSaving}>
            <Trans>Guardar límites</Trans>
          </Button>
        </div>
      )}
    </section>
  )
}

function Limite({
  id,
  label,
  hint,
  value,
  disabled,
  onChange,
}: {
  id: string
  label: string
  hint: string
  value: string
  disabled: boolean
  onChange: (value: string) => void
}): ReactNode {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <input
        id={id}
        type="time"
        value={value}
        disabled={disabled}
        onChange={(event): void => onChange(event.target.value)}
        className="w-40 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink disabled:opacity-60"
      />
      <span className="text-xs text-ink-3">{hint}</span>
    </div>
  )
}
