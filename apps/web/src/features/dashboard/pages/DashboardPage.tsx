import type { ReactNode } from 'react'
import { Navigate } from 'react-router'

import { HotelDashboard } from '../components/HotelDashboard'
import { RecruitmentDashboard } from '../components/RecruitmentDashboard'
import { RecruitmentManagerDashboard } from '../components/RecruitmentManagerDashboard'
import { SalesDashboard } from '../components/SalesDashboard'

import { useGetSessionQuery } from '@/app/sessionApi'
import { CardGridSkeleton } from '@/shared/components/CardGridSkeleton'

export function DashboardPage(): ReactNode {
  const { data: session, isLoading } = useGetSessionQuery()

  if (isLoading) {
    return <CardGridSkeleton cards={6} className="grid-cols-1 md:grid-cols-2 xl:grid-cols-3" />
  }

  if (session?.roleId === 'ROL-ADM-01') return <Navigate to="/users" replace />
  /* Manager de QA (antes Observador, ROL-OBS-01) no tiene dashboard propio: su única pantalla es
     /observability, que ya compone las tres vistas transversales que necesita. */
  if (session?.roleId === 'ROL-Q-02') return <Navigate to="/observability" replace />
  /* Inspección no tiene dashboard propio. Hoy solo ve Requisiciones e
     Inspecciones (Hugo, 2026-10-21): el Inspector entra a Inspecciones y el
     Coordinador, que no inspecciona, a Requisiciones. */
  if (session?.roleId === 'ROL-I-01') return <Navigate to="/audits" replace />
  if (session?.roleId.startsWith('ROL-I-')) return <Navigate to="/requisitions" replace />
  /* La Manager ve el departamento entero; Líder y Reclutadora, su operación. */
  if (session?.roleId === 'ROL-R-03') return <RecruitmentManagerDashboard session={session} />
  if (session?.roleId.startsWith('ROL-R-')) return <RecruitmentDashboard session={session} />
  if (session?.roleId.startsWith('ROL-H-')) return <HotelDashboard session={session} />
  return <SalesDashboard />
}
