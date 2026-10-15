import { Trans, useLingui } from '@lingui/react/macro'
import { Suspense, lazy, useState, type ReactNode } from 'react'

import { useGetHotelOverviewQuery } from '../api/roleDashboardsApi'

import { StatTile } from './ActivityCards'
import { IdentityHeader } from './IdentityHeader'
import { InviteHotelAccountCard } from './InviteHotelAccountCard'
import { RequisitionMiniList } from './RequisitionMiniList'

const DashboardGlobe = lazy(() =>
  import('./DashboardGlobe').then((module) => ({ default: module.DashboardGlobe })),
)

import personajeDashboard from '@/assets/ilustrations/personaje-dashboard.svg'
import { HotelPunchQrPanel } from '@/features/onboarding'
import { CardGridSkeleton } from '@/shared/components/CardGridSkeleton'
import { GuidedTour, type TourStep } from '@/shared/components/GuidedTour'
import { LoadError } from '@/shared/components/LoadError'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import type { SessionUser } from '@/shared/types/session.types'

export function HotelDashboard({ session }: { session: SessionUser }): ReactNode {
  const { t } = useLingui()
  const { data: overview, isLoading, isError, refetch } = useGetHotelOverviewQuery()
  /* El recorrido se reabre desde «Ver el recorrido». */
  const [startTour, setStartTour] = useState<() => void>(() => () => undefined)

  /* Para una cuenta recién creada del hotel: qué es cada número y a dónde ir
     desde aquí. */
  const pasos: readonly TourStep[] = [
    {
      anchor: 'hotel-stats',
      title: t`Tus cuatro números`,
      description: t`Cuántas requisiciones tienes trabajándose, cuántas esperan firma, cuántas ya se cubrieron y cuántas semanas de horas siguen sin aprobar — esas últimas no se pagan hasta que alguien las apruebe.`,
    },
    {
      anchor: 'hotel-punch',
      title: t`Cómo poncha tu gente`,
      description: t`Tu hotel usa selfie o el QR del acceso. Si usa QR, desde aquí imprimes la hoja que se pega en la entrada, y puedes regenerarla si se filtró.`,
    },
    {
      anchor: 'hotel-requisitions',
      title: t`Tus requisiciones recientes`,
      description: t`Con su cobertura. Toca una para abrirla y ver puesto por puesto quién la está cubriendo.`,
    },
  ]

  if (isLoading) {
    return <CardGridSkeleton cards={6} className="grid-cols-1 md:grid-cols-2 xl:grid-cols-3" />
  }

  if (isError || !overview) {
    return (
      <LoadError
        message={t`No se pudo cargar el dashboard. Reintenta en unos segundos.`}
        onRetry={() => {
          void refetch()
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <IdentityHeader
        name={session.name}
        subtitle={`${session.roleTitle}${session.hotel ? ` · ${session.hotel.name}` : ''}`}
      >
        <Suspense fallback={null}>
          <DashboardGlobe />
        </Suspense>
      </IdentityHeader>

      <InviteHotelAccountCard session={session} />

      <p className="text-sm text-ink-3">
        <Trans>¿Primera vez aquí?</Trans>{' '}
        <button
          type="button"
          onClick={startTour}
          className="cursor-pointer font-medium text-o-700 hover:underline"
        >
          <Trans>Ver el recorrido</Trans>
        </button>
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" data-tour="hotel-stats">
        <StatTile
          value={String(overview.openRequisitions)}
          label={t`Requisiciones abiertas`}
          foot={t`Autorizadas y en proceso`}
          tintClass="bg-o-500/10"
          delay={0.05}
        />
        <StatTile
          value={String(overview.draftRequisitions)}
          label={t`Por autorizar`}
          foot={t`En elaboración (Verde manzana)`}
          tintClass="bg-st-verde-manzana/10"
          delay={0.12}
        />
        <StatTile
          value={String(overview.coveredRequisitions)}
          label={t`Cubiertas`}
          foot={t`Al 100% (Azul claro)`}
          tintClass="bg-st-azul-claro/10"
          delay={0.18}
        />
        <StatTile
          value={String(overview.pendingTimesheets)}
          label={t`Timesheets sin aprobar`}
          foot={IS_DEV_UI ? 'Sin aprobación no se paga (D-09)' : t`Sin aprobación no se paga`}
          tintClass="bg-yellow/15"
          delay={0.24}
        />
      </div>

      {/* Cómo se poncha en SU hotel y, con QR, la hoja para imprimir: el
          Supervisor y los Managers no pasan por el Pipeline. */}
      {session.hotel && (
        <div data-tour="hotel-punch">
          <HotelPunchQrPanel hotelId={session.hotel.id} />
        </div>
      )}

      <div data-tour="hotel-requisitions">
        <RequisitionMiniList
          title={t`Requisiciones del hotel`}
          subtitle={t`Las más recientes, con su cobertura`}
          requisitions={overview.requisitions}
          emptyLabel={t`Este hotel no tiene requisiciones todavía.`}
        />
      </div>

      {/* Es la primera pantalla que ve una cuenta nueva del hotel, y los
          gerentes rotan: aquí el recorrido es lo que orienta. */}
      <GuidedTour
        storageKey="hotel-dashboard-tour"
        steps={pasos}
        character={personajeDashboard}
        onReady={(start) => {
          setStartTour(() => start)
        }}
      />
    </div>
  )
}
