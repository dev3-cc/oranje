import { createBrowserRouter, Navigate } from 'react-router'

import { RequireSession } from './RequireSession'

import { AppShell } from '@/layouts/AppShell'
import { ModulePlaceholder } from '@/shared/components/ModulePlaceholder'

/**
 * Módulos del sidebar que ya navegan pero todavía no tienen diseño. Cada uno
 * sale de aquí y pasa a ser una feature propia cuando llegue su maqueta.
 */
const PENDING_MODULES = [{ path: 'accidentes', title: 'Accidentes' }]

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
        /**
         * El apartado del Colaborador (ROL-C-01): web responsive que imita la
         * app móvil de la maqueta. Vive FUERA del AppShell — el Colaborador no
         * usa el sidebar del staff.
         */
        path: 'colaborador',
        lazy: async () => {
          const m = await import('@/features/worker')
          return { Component: m.MobileShell }
        },
        children: [
          {
            index: true,
            lazy: async () => {
              const m = await import('@/features/worker')
              return { Component: m.HomePage }
            },
          },
          {
            path: 'perfil',
            lazy: async () => {
              const m = await import('@/features/worker')
              return { Component: m.ProfilePage }
            },
          },
          {
            path: 'alta-2',
            lazy: async () => {
              const m = await import('@/features/worker')
              return { Component: m.Phase2Page }
            },
          },
          {
            path: 'alta-3',
            lazy: async () => {
              const m = await import('@/features/worker')
              return { Component: m.Phase3Page }
            },
          },
          {
            path: 'avisos',
            lazy: async () => {
              const m = await import('@/features/worker')
              return { Component: m.NotificationsPage }
            },
          },
        ],
      },
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
            path: 'usuarios',
            lazy: async () => {
              const m = await import('@/features/admin')
              return { Component: m.UsersPage }
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
            path: 'schedule',
            lazy: async () => {
              const m = await import('@/features/schedule')
              return { Component: m.SchedulePage }
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
            path: 'timesheet-global',
            lazy: async () => {
              const m = await import('@/features/timesheet')
              return { Component: m.TimesheetGlobalPage }
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
            /* El Expediente cuelga del Pool: se llega desde el nombre de la fila. */
            path: 'pool-colaboradores/:workerId',
            lazy: async () => {
              const m = await import('@/features/recruitment')
              return { Component: m.WorkerDetailPage }
            },
          },
          {
            path: 'self-pick',
            lazy: async () => {
              const m = await import('@/features/recruitment')
              return { Component: m.SelfPickPage }
            },
          },
          {
            /* La asignación cuelga de la bolsa: se llega desde una tarjeta. */
            path: 'self-pick/:requisitionId/:positionId',
            lazy: async () => {
              const m = await import('@/features/recruitment')
              return { Component: m.SlotAssignmentPage }
            },
          },
          {
            path: 'reportes',
            lazy: async () => {
              const m = await import('@/features/reports')
              return { Component: m.ReportsPage }
            },
          },
          {
            path: 'mi-equipo',
            lazy: async () => {
              const m = await import('@/features/team')
              return { Component: m.TeamPage }
            },
          },
          {
            path: 'blacklist',
            lazy: async () => {
              const m = await import('@/features/recruitment')
              return { Component: m.BlacklistPage }
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
            path: 'mi-personal',
            lazy: async () => {
              const m = await import('@/features/personnel')
              return { Component: m.PersonnelPage }
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
