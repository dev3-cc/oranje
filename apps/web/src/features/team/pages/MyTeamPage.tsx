import type { ReactNode } from 'react'

import { HotelTeamPage } from './HotelTeamPage'
import { RecruitmentTeamPage } from './RecruitmentTeamPage'
import { TeamPage } from './TeamPage'

import { useGetSessionQuery } from '@/app/sessionApi'
import { CardGridSkeleton } from '@/shared/components/CardGridSkeleton'

/**
 * `/my-team` es de quien tiene equipo a cargo, y cada departamento lo ve a su
 * modo: el BDC sus BDs y su ciclo comercial; la Manager de Reclutamiento sus
 * Líderes y Reclutadoras con su carga; el Manager General sus gerentes y
 * supervisores. Mismo patrón que el Dashboard.
 */
export function MyTeamPage(): ReactNode {
  const { data: session, isLoading } = useGetSessionQuery()

  if (isLoading) {
    return <CardGridSkeleton cards={4} className="grid-cols-1 md:grid-cols-2 xl:grid-cols-4" />
  }
  if (session?.roleId === 'ROL-R-03') return <RecruitmentTeamPage session={session} />
  if (session?.roleId === 'ROL-H-03') return <HotelTeamPage session={session} />
  return <TeamPage />
}
