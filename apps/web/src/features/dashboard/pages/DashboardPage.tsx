import type { ReactNode } from 'react'

import { HotelDashboard } from '../components/HotelDashboard'
import { RecruitmentDashboard } from '../components/RecruitmentDashboard'
import { SalesDashboard } from '../components/SalesDashboard'

import { useGetSessionQuery } from '@/app/sessionApi'
import { CardGridSkeleton } from '@/shared/components/CardGridSkeleton'

export function DashboardPage(): ReactNode {
  const { data: session, isLoading } = useGetSessionQuery()

  if (isLoading) {
    return <CardGridSkeleton cards={6} className="grid-cols-1 md:grid-cols-2 xl:grid-cols-3" />
  }

  if (session?.roleId.startsWith('ROL-R-')) return <RecruitmentDashboard session={session} />
  if (session?.roleId.startsWith('ROL-H-')) return <HotelDashboard session={session} />
  return <SalesDashboard />
}
