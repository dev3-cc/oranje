import { useState, type ReactNode } from 'react'

import { useAuthorizeRequisitionMutation } from '../api/authorizationsApi'
import type { AuthorizationRequest, AuthorizationUrgencyPreview } from '../types/requisition.types'

import { Button } from '@/shared/components/Button'
import { SectionCard } from '@/shared/components/SectionCard'
import { URGENCY_COLOR_NAME, URGENCY_LABEL } from '@/shared/constants/requisitionStatus'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { formatDayMonth } from '@/shared/lib/formatters'

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

export function AuthorizationResolutionForm({
  request,
  authorizerRole,
  authorizerScope,
}: {
  request: AuthorizationRequest
  authorizerRole: string
  authorizerScope: string
}): ReactNode {
  const [authorize, { isLoading: isSubmitting }] = useAuthorizeRequisitionMutation()
  const [rootError, setRootError] = useState<string | null>(null)

  async function submitAuthorize(): Promise<void> {
    setRootError(null)
    try {
      await authorize({ requisitionId: request.id }).unwrap()
    } catch (error) {
      setRootError(
        apiErrorMessage(error, {
          byStatus: {
            403: `Tu rol no autoriza requisiciones: lo hacen el Manager de Área o el Manager General del hotel${IS_DEV_UI ? ' (D-09)' : ''}.`,
          },
          fallback: 'No se pudo autorizar.',
        }),
      )
    }
  }

  return (
    <SectionCard
      title="Resolución"
      subtitle={
        IS_DEV_UI
          ? 'Autorizar congela la urgencia contra la fecha de inicio (RR-H-05)'
          : 'Al autorizar se fija la urgencia según la fecha de inicio'
      }
    >
      {}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void submitAuthorize()
        }}
        className="flex flex-col gap-5"
      >
        <p className="flex items-start gap-3 rounded-lg bg-yellow/15 px-4 py-3.5 text-sm text-ink-2">
          <span className="material-icons-outlined text-lg leading-none text-ink" aria-hidden>
            bolt
          </span>
          {describeUrgencyPreview(request.urgencyPreview)}
        </p>

        {rootError !== null && <p className="text-sm text-red">{rootError}</p>}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-ink-3">
            Autorizas como {authorizerRole} — alcance: {authorizerScope}
          </p>

          <div className="flex gap-3">
            {}
            <Button
              variant="secondary"
              disabled
              title="El rechazo aún no existe en el backend (pendiente 21 del ADR)"
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
