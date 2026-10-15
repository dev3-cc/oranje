import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { MaterialIcon, toast } from '@oranje/ui'
import { useState, type ReactNode } from 'react'

import { IncludeAdjustmentDialog } from '../components/IncludeAdjustmentDialog'

import personajeContabilidad from '@/assets/ilustrations/personaje-contabilidad.svg'
import personajePagado from '@/assets/ilustrations/personaje-pago-procesado.svg'
import {
  useGetApprovedPendingInclusionQuery,
  useIncludePayAdjustmentMutation,
  type PayAdjustment,
} from '@/features/recruitment'
import { LoadError } from '@/shared/components/LoadError'
import { Modal } from '@/shared/components/Modal'
import { OnboardingIntro } from '@/shared/components/OnboardingIntro'
import { SettlementEffectBadge } from '@/shared/components/SettlementEffectBadge'
import { TableSkeleton } from '@/shared/components/TableSkeleton'
import { useIntroSeen } from '@/shared/hooks/useIntroSeen'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { formatDateTime, formatMoney } from '@/shared/lib/formatters'

const INTRO_SLIDES: readonly {
  image: string
  title: MessageDescriptor
  text: MessageDescriptor
}[] = [
  {
    image: personajeContabilidad,
    title: msg`Reclutamiento pide, el Observador aprueba`,
    text: msg`Una eventual puede llevar un ajuste de tarifa o un gasto con concepto (Uber…). El Observador los revisa, pero eso todavía no les hace nada a tus números.`,
  },
  {
    image: personajePagado,
    title: msg`Tú decides si entra a la nómina`,
    text: msg`Aprobado no es lo mismo que incluido: aquí ves qué haría cada uno a la próxima corrida y decides, uno por uno, antes de que pese en algo.`,
  },
] as const

/**
 * Lo que Reclutamiento pidió y el Observador aprobó, para una asignación
 * eventual — ajuste de tarifa o gasto con concepto — todavía sin decidir si
 * pesa en la nómina. Esa decisión es de Contabilidad, viendo antes qué hace
 * cada uno (Hugo, 2026-10-09): aprobado no es lo mismo que incluido.
 */
export function PayAdjustmentsInclusionPage(): ReactNode {
  const { t, i18n } = useLingui()
  const { isIntroOpen, dismissIntro, reopenIntro } = useIntroSeen('ajustes-a-incluir')
  const {
    data: rows = [],
    isLoading,
    isError,
    refetch,
  } = useGetApprovedPendingInclusionQuery(undefined, { refetchOnMountOrArgChange: true })
  const [include, { isLoading: isIncluding }] = useIncludePayAdjustmentMutation()
  const [target, setTarget] = useState<PayAdjustment | null>(null)

  async function confirmInclude(): Promise<void> {
    if (!target) return
    try {
      await include({ id: target.id }).unwrap()
      toast.success(t`Incluido en la nómina`)
      setTarget(null)
    } catch (error) {
      toast.error(apiErrorMessage(error, { fallback: t`No se pudo incluir. Inténtalo de nuevo.` }))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            <Trans>Ajustes a incluir</Trans>
          </h1>
          <p className="mt-1.5 text-sm text-ink-3">
            <Trans>
              El ajuste de tarifa o el gasto de una eventual, ya aprobado por el Observador.
              Mientras no lo incluyas, no pesa en la nómina.
            </Trans>
          </p>
        </div>
        <button
          type="button"
          onClick={reopenIntro}
          className="cursor-pointer rounded-md px-2 py-1 text-xs font-semibold whitespace-nowrap text-o-700 hover:bg-o-50"
        >
          <Trans>¿Cómo funciona?</Trans>
        </button>
      </header>

      <Modal
        isOpen={isIntroOpen}
        onClose={dismissIntro}
        title={t`Cómo funcionan los ajustes a incluir`}
        chromeless
      >
        <OnboardingIntro
          slides={INTRO_SLIDES.map((slide) => ({
            image: slide.image,
            title: i18n._(slide.title),
            text: i18n._(slide.text),
          }))}
          startLabel={t`Entendido`}
          onDone={dismissIntro}
        />
      </Modal>

      {isError && (
        <LoadError
          message={t`No se pudieron cargar los ajustes. Reintenta en unos segundos.`}
          onRetry={() => {
            void refetch()
          }}
        />
      )}

      {isLoading ? (
        <TableSkeleton rows={4} columns={5} />
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
          <Trans>Sin ajustes por incluir: no hay nada aprobado pendiente de decisión.</Trans>
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <ApprovedAdjustmentCard
              key={row.id}
              row={row}
              onInclude={() => {
                setTarget(row)
              }}
            />
          ))}
        </ul>
      )}

      <IncludeAdjustmentDialog
        isOpen={target !== null}
        target={target}
        isIncluding={isIncluding}
        onClose={() => {
          setTarget(null)
        }}
        onConfirm={() => {
          void confirmInclude()
        }}
      />
    </div>
  )
}

function ApprovedAdjustmentCard({
  row,
  onInclude,
}: {
  row: PayAdjustment
  onInclude: () => void
}): ReactNode {
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-bold text-ink">
          {row.worker.fullName} · {row.hotelName}
        </p>
        <p className="text-xs text-ink-3">{row.requisitionNumber}</p>
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-ink-2">
          <MaterialIcon name="payments" className="text-base text-ink-4" aria-hidden />
          <span className="font-semibold text-ink">{formatMoney(Number(row.amount))}</span>
          <span className="text-ink-3">
            {row.payConcept ? (
              <Trans>· gasto: {row.payConcept.name}</Trans>
            ) : (
              <Trans>· ajuste a la tarifa de la posición</Trans>
            )}
          </span>
          {row.settlementEffect && <SettlementEffectBadge effect={row.settlementEffect} />}
        </p>
        <p className="mt-1 text-sm text-ink-3">«{row.reason}»</p>
        <p className="mt-1 text-xs text-ink-4">
          <Trans>
            Aprobado por {row.approvedBy?.fullName ?? '—'}
            {row.approvedAt && <> · {formatDateTime(row.approvedAt)}</>}
          </Trans>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 self-start">
        <button
          type="button"
          onClick={onInclude}
          className="cursor-pointer rounded-md bg-o-500 px-3 py-1.5 text-sm font-semibold text-ink shadow-xs transition-colors hover:bg-o-400"
        >
          <Trans>Incluir en la nómina</Trans>
        </button>
      </div>
    </li>
  )
}
