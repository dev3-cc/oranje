import type { I18n } from '@lingui/core'
import { msg, plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { Alert, AlertDescription, toast } from '@oranje/ui'
import { useState, type ReactNode } from 'react'

import { useAuthorizeRequisitionMutation } from '../api/authorizationsApi'
import type {
  AuthorizationRequest,
  AuthorizationUrgencyPreview,
  AuthorizerScope,
} from '../types/requisition.types'

import { Button } from '@/shared/components/Button'
import { SectionCard } from '@/shared/components/SectionCard'
import { URGENCY_COLOR_NAME, URGENCY_LABEL } from '@/shared/constants/requisitionStatus'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { formatDayMonth } from '@/shared/lib/formatters'

/** El `i18n` viene del componente (`useLingui`): así el mensaje habla el idioma activo (D-36). */
function authorizeErrorMessage(error: unknown, i18n: I18n): string {
  return apiErrorMessage(error, {
    byCode: {
      FORBIDDEN: IS_DEV_UI
        ? 'Tu rol no autoriza requisiciones: lo hacen el Manager de Área o el Manager General del hotel (D-09).'
        : i18n._(
            msg`Tu rol no autoriza requisiciones: lo hacen el Manager de Área o el Manager General del hotel.`,
          ),
      DEPARTMENT_OUT_OF_SCOPE: i18n._(
        msg`Esta requisición es de otro departamento: la autoriza su Manager de Área o el Manager General.`,
      ),
      HOTEL_OUT_OF_SCOPE: i18n._(msg`Esta requisición no es de tu hotel.`),
    },
    fallback: i18n._(msg`No se pudo autorizar la requisición. Inténtalo de nuevo.`),
  })
}

export function AuthorizationResolutionForm({
  request,
  authorizerRole,
  authorizerScope,
}: {
  request: AuthorizationRequest
  authorizerRole: string
  authorizerScope: AuthorizerScope
}): ReactNode {
  const { t, i18n } = useLingui()
  const [authorize, { isLoading: isSubmitting }] = useAuthorizeRequisitionMutation()
  const [rootError, setRootError] = useState<string | null>(null)

  function describeUrgencyPreview(preview: AuthorizationUrgencyPreview): string {
    const { daysAhead, positionCount } = preview
    const start = formatDayMonth(preview.startDate)
    const color = URGENCY_COLOR_NAME[preview.urgency]
    const label = URGENCY_LABEL[preview.urgency]

    return t`Al autorizar, la urgencia se calcula contra la fecha de inicio: ${start} ${plural(daysAhead, { one: 'está a # día', other: 'está a # días' })}, así que ${plural(positionCount, { one: 'la posición nace', other: 'las # posiciones nacen' })} en ${color} (${label})`
  }

  /** Hasta dónde llega la firma, en palabras (D-09). */
  const scopeLabel =
    authorizerScope === 'HOTEL'
      ? t`todos los departamentos de tu hotel`
      : IS_DEV_UI
        ? 'solo tu departamento (D-09)'
        : t`solo tu departamento`

  async function submitAuthorize(): Promise<void> {
    setRootError(null)
    try {
      await authorize({ requisitionId: request.id }).unwrap()
      toast.success(t`Requisición autorizada`)
    } catch (error) {
      setRootError(authorizeErrorMessage(error, i18n))
    }
  }

  return (
    <SectionCard
      title={t`Resolución`}
      subtitle={
        IS_DEV_UI
          ? 'Autorizar congela la urgencia contra la fecha de inicio (RR-H-05)'
          : t`Al autorizar se fija la urgencia según la fecha de inicio`
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

        {rootError !== null && (
          <Alert variant="destructive">
            <AlertDescription>{rootError}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-ink-3">
            <Trans>
              Autorizas como {authorizerRole} — alcance: {scopeLabel}
            </Trans>
          </p>

          <div className="flex gap-3">
            {}
            <Button
              variant="secondary"
              disabled
              title={
                IS_DEV_UI
                  ? 'El rechazo aún no existe en el backend (pendiente 21 del ADR)'
                  : t`Rechazar estará disponible próximamente`
              }
            >
              <Trans>Rechazar</Trans>
            </Button>
            <Button variant="primary" type="submit" disabled={isSubmitting}>
              <Trans>Autorizar requisición</Trans>
            </Button>
          </div>
        </div>
      </form>
    </SectionCard>
  )
}
