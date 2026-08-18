import { createBrowserRouter, Navigate } from 'react-router'

import { RequireSession } from './RequireSession'

import { AppShell } from '@/layouts/AppShell'
import { ModulePlaceholder } from '@/shared/components/ModulePlaceholder'

/**
 * Módulos del sidebar que ya navegan pero todavía no tienen diseño. Cada uno
 * sale de aquí y pasa a ser una feature propia cuando llegue su maqueta.
 */
const PENDING_MODULES = [
  { path: 'mi-equipo', title: 'Mi Equipo' },
  { path: 'reportes', title: 'Reportes' },
  { path: 'schedule', title: 'Schedule' },
  { path: 'mi-personal', title: 'Mi Personal' },
  { path: 'accidentes', title: 'Accidentes' },
]

/**
 * React Router 8 en *data mode* (D-17).
 *
 * NO se usa framework mode: trae SSR y rutas por archivo, y D-04 dice que esta
 * app es un artefacto estático detrás del Load Balancer, sin servidor que la
 * renderice.
 *
 * Cada ruta de primer nivel corresponde a un módulo del sidebar del rol
 * (ver `Estructura General App`), no a un módulo del backend.
 */
export const router = createBrowserRouter([
  {
    /** La única ruta pública. Lazy: three.js no viaja en el bundle inicial. */
    path: '/login',
    lazy: async () => {
      const m = await import('@/features/auth')
      return { Component: m.LoginPage }
    },
  },
  {
    path: '/',
    /** Sin sesión no hay shell: el guard intenta el refresh y decide. */
    Component: RequireSession,
    children: [
      {
        Component: AppShell,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          {
            path: 'dashboard',
            lazy: async () => {
              const m = await import('@/features/dashboard')
              return { Component: m.DashboardPage }
            },
          },
          {
            path: 'pipeline',
            lazy: async () => {
              const m = await import('@/features/onboarding')
              return { Component: m.PipelinePage }
            },
          },
          {
            /* El detalle cuelga de la ruta del tablero: se llega desde una tarjeta. */
            path: 'pipeline/:prospectId',
            lazy: async () => {
              const m = await import('@/features/onboarding')
              return { Component: m.ProspectDetailPage }
            },
          },
          {
            /**
             * La propuesta vive DENTRO del hotel, no en un módulo aparte: su
             * historial y la creación de versiones cuelgan del prospecto. Clientes
             * Activos son los mismos hoteles en otro estado del semáforo, así que
             * apuntarán a esta misma ruta.
             */
            path: 'pipeline/:prospectId/propuesta',
            lazy: async () => {
              const m = await import('@/features/onboarding')
              return { Component: m.ProposalEditorPage }
            },
          },
          {
            /* Vista transversal de solo lectura; el editor vive dentro del hotel. */
            path: 'propuestas',
            lazy: async () => {
              const m = await import('@/features/onboarding')
              return { Component: m.ProposalListPage }
            },
          },
          {
            /* Una versión concreta, en solo lectura. A donde lleva «Ver propuesta». */
            path: 'propuestas/:prospectId/:version',
            lazy: async () => {
              const m = await import('@/features/onboarding')
              return { Component: m.ProposalVersionPage }
            },
          },
          {
            path: 'conversion',
            lazy: async () => {
              const m = await import('@/features/conversion')
              return { Component: m.ConversionQueuePage }
            },
          },
          {
            /* La maqueta que llegó es esta: la conversión de un prospecto concreto. */
            path: 'conversion/:prospectId',
            lazy: async () => {
              const m = await import('@/features/conversion')
              return { Component: m.ConversionPage }
            },
          },
          {
            path: 'requisiciones',
            lazy: async () => {
              const m = await import('@/features/requisitions')
              return { Component: m.RequisitionBoardPage }
            },
          },
          {
            /**
             * Va ANTES que `:requisitionId`, que si no se tragaría «autorizacion»
             * como si fuera el id de una requisición.
             */
            path: 'requisiciones/autorizacion',
            lazy: async () => {
              const m = await import('@/features/requisitions')
              return { Component: m.RequisitionAuthorizationPage }
            },
          },
          {
            /* El detalle cuelga del tablero: se llega desde el folio de una fila. */
            path: 'requisiciones/:requisitionId',
            lazy: async () => {
              const m = await import('@/features/requisitions')
              return { Component: m.RequisitionDetailPage }
            },
          },
          {
            path: 'timesheet',
            lazy: async () => {
              const m = await import('@/features/timesheet')
              return { Component: m.TimesheetPage }
            },
          },
          {
            path: 'pool-colaboradores',
            lazy: async () => {
              const m = await import('@/features/recruitment')
              return { Component: m.PoolPage }
            },
          },
          {
            path: 'clientes-activos',
            lazy: async () => {
              const m = await import('@/features/clients')
              return { Component: m.ClientPortfolioPage }
            },
          },
          {
            path: 'documentos-tc',
            lazy: async () => {
              const m = await import('@/features/contracts')
              return { Component: m.ContractListPage }
            },
          },
          {
            /* El contrato cuelga de la lista: se llega desde el «Abrir» de su fila. */
            path: 'documentos-tc/:contractId',
            lazy: async () => {
              const m = await import('@/features/contracts')
              return { Component: m.ContractDetailPage }
            },
          },
          {
            path: 'mi-territorio',
            lazy: async () => {
              const m = await import('@/features/territory')
              return { Component: m.TerritoryPage }
            },
          },
          ...PENDING_MODULES.map((module) => ({
            path: module.path,
            element: <ModulePlaceholder title={module.title} />,
          })),
        ],
      },
    ],
  },
])
