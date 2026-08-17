import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'

import {
  useAuthorizeRequisitionMutation,
  useRejectRequisitionMutation,
} from '../api/authorizationsApi'
import type {
  AuthorizationRequest,
  AuthorizationUrgencyPreview,
  StatusChangeReason,
} from '../types/requisition.types'
import {
  resolveAuthorizationSchema,
  type ResolveAuthorizationForm,
} from '../types/resolveAuthorization.schema'

import { Button } from '@/shared/components/Button'
import { FormField } from '@/shared/components/FormField'
import { SectionCard } from '@/shared/components/SectionCard'
import { URGENCY_COLOR_NAME, URGENCY_LABEL } from '@/shared/constants/requisitionStatus'
import { formatDayMonth } from '@/shared/lib/formatters'

const CONTROL_CLASS =
  'w-full rounded-md border border-line bg-surface px-4 py-3 text-sm focus:border-o-500 focus:outline-none'

const REASON_FIELD_ID = 'resolution-reason'

/**
 * La advertencia de qué pasará al firmar, en palabras.
 *
 * Se arma con los números que manda el backend y no con un `Date` local: la
 * urgencia es una función del reloj, y calcularla aquí haría que una pestaña
 * abierta desde ayer prometiera una cosa y el servidor hiciera otra.
 */
function describeUrgencyPreview(preview: AuthorizationUrgencyPreview): string {
  const when = preview.daysAhead === 1 ? 'está a 1 día' : `está a ${String(preview.daysAhead)} días`

  const born =
    preview.positionCount === 1
      ? 'la posición nace'
      : `las ${String(preview.positionCount)} posiciones nacen`

  return `Al autorizar, la urgencia se calcula contra la fecha de inicio: ${formatDayMonth(
    preview.startDate,
  )} ${when}, así que ${born} en ${URGENCY_COLOR_NAME[preview.urgency]} (${URGENCY_LABEL[preview.urgency]})`
}

/**
 * Autorizar o rechazar. Las dos acciones comparten el mismo motivo, y por eso
 * comparten formulario en vez de ser dos diálogos.
 */
export function AuthorizationResolutionForm({
  request,
  reasons,
  authorizerRole,
  authorizerScope,
}: {
  request: AuthorizationRequest
  reasons: StatusChangeReason[]
  authorizerRole: string
  authorizerScope: string
}): ReactNode {
  const [authorize] = useAuthorizeRequisitionMutation()
  const [reject] = useRejectRequisitionMutation()

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ResolveAuthorizationForm>({
    resolver: zodResolver(resolveAuthorizationSchema),
    defaultValues: { reasonId: '' },
  })

  // Al cambiar de requisición se limpia: un motivo escrito para una no vale
  // para la siguiente, y arrastrarlo es la manera de firmar algo con la razón
  // equivocada.
  useEffect(() => {
    reset({ reasonId: '' })
  }, [request.id, reset])

  const submitAuthorize = handleSubmit(async (values) => {
    try {
      await authorize({
        requisitionId: request.id,
        reasonId: values.reasonId === '' ? null : values.reasonId,
      }).unwrap()
    } catch {
      setError('root', { message: 'No se pudo autorizar. Reintenta en unos segundos.' })
    }
  })

  const submitReject = handleSubmit(async (values) => {
    if (values.reasonId === '') {
      setError('reasonId', { message: 'El motivo es obligatorio al rechazar' })
      return
    }

    try {
      await reject({ requisitionId: request.id, reasonId: values.reasonId }).unwrap()
    } catch {
      setError('root', { message: 'No se pudo rechazar. Reintenta en unos segundos.' })
    }
  })

  return (
    <SectionCard
      title="Resolución"
      subtitle="El motivo es obligatorio al rechazar; opcional al autorizar. Queda en requisition_state_history"
    >
      {/* Enter dispara autorizar, que es la acción esperada; rechazar exige el clic. */}
      <form
        onSubmit={(event) => {
          void submitAuthorize(event)
        }}
        className="flex flex-col gap-5"
      >
        <p className="flex items-start gap-3 rounded-lg bg-yellow/15 px-4 py-3.5 text-sm text-ink-2">
          <span className="material-icons-outlined text-lg leading-none text-ink" aria-hidden>
            bolt
          </span>
          {describeUrgencyPreview(request.urgencyPreview)}
        </p>

        <FormField
          label="Motivo (catalogs.status_change_reason)"
          htmlFor={REASON_FIELD_ID}
          error={errors.reasonId?.message}
        >
          <select id={REASON_FIELD_ID} className={CONTROL_CLASS} {...register('reasonId')}>
            <option value="">Selecciona un motivo</option>
            {reasons.map((reason) => (
              <option key={reason.id} value={reason.id}>
                {reason.label}
              </option>
            ))}
          </select>
        </FormField>

        {errors.root?.message !== undefined && (
          <p className="text-sm text-red">{errors.root.message}</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-ink-3">
            Autorizas como {authorizerRole} — alcance: {authorizerScope}
          </p>

          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                void submitReject()
              }}
              disabled={isSubmitting}
            >
              Rechazar
            </Button>
            <Button variant="primary" type="submit" disabled={isSubmitting}>
              Autorizar requisición
            </Button>
          </div>
        </div>
      </form>
    </SectionCard>
  )
}
