import { Trans, useLingui } from '@lingui/react/macro'
import { MaterialIcon } from '@oranje/ui'
import type { ReactNode } from 'react'

import { useAppSelector } from '@/app/hooks'
import { useGetSessionQuery } from '@/app/sessionApi'
import { selectSessionUser } from '@/app/sessionSlice'
import personajeBienvenida from '@/assets/ilustrations/personaje-bienvenida.svg'
import { NoticeCard } from '@/shared/components/NoticeCard'
import { roleLabelOf } from '@/shared/constants/roles'

/**
 * Inicio del hotel en la app. En esta primera versión dice quién eres, de qué
 * hotel y con qué alcance (D-09: el Manager General ve todo el hotel; el
 * Supervisor y el Manager de Área, su departamento). Las secciones llegan por
 * fases: Requisiciones, los KPIs, Mi personal, Timesheet.
 */
export function HotelHomePage(): ReactNode {
  const { t } = useLingui()
  const user = useAppSelector(selectSessionUser)
  const { data: session, isLoading } = useGetSessionQuery()

  const name = session?.name ?? user?.name ?? ''
  const firstName = name.trim().split(/\s+/)[0] ?? ''
  const role = roleLabelOf(session?.roleId ?? user?.roleId ?? '')
  const scope = session?.department?.name ?? t`Todo el hotel`

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-4 rounded-2xl bg-ink p-5 text-surface">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-surface/70">
            <Trans>Hola, {firstName}</Trans>
          </p>
          <h1 className="text-xl font-bold">{role.title}</h1>
        </div>
        <dl className="grid grid-cols-1 gap-3 text-sm" aria-busy={isLoading}>
          <div className="flex items-center gap-3">
            <MaterialIcon name="apartment" className="text-xl text-o-300" aria-hidden />
            <div>
              <dt className="text-xs text-surface/60">
                <Trans>Hotel</Trans>
              </dt>
              <dd className="font-semibold">{session?.hotel?.name ?? '—'}</dd>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <MaterialIcon name="groups" className="text-xl text-o-300" aria-hidden />
            <div>
              <dt className="text-xs text-surface/60">
                <Trans>Alcance</Trans>
              </dt>
              <dd className="font-semibold">{scope}</dd>
            </div>
          </div>
        </dl>
      </section>

      <NoticeCard image={personajeBienvenida} title={t`Tu hotel llega a la app`}>
        <Trans>
          Requisiciones, Timesheet y tu personal se suman a la app en las próximas versiones.
          Mientras, siguen en el web.
        </Trans>
      </NoticeCard>
    </div>
  )
}
