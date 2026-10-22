import type { ReactNode } from 'react'

import { RecruitmentReportsPage } from './RecruitmentReportsPage'
import { ReportsPage } from './ReportsPage'

import { useGetSessionQuery } from '@/app/sessionApi'
import { CardGridSkeleton } from '@/shared/components/CardGridSkeleton'

/** `/reports` como `/my-team`: el BDC ve los de Ventas; la Manager de Reclutamiento, los suyos. */
export function ReportsByRolePage(): ReactNode {
  const { data: session, isLoading } = useGetSessionQuery()

  if (isLoading) return <CardGridSkeleton cards={4} className="grid-cols-1 xl:grid-cols-2" />
  if (session?.roleId === 'ROL-R-03') return <RecruitmentReportsPage />
  return <ReportsPage />
}
