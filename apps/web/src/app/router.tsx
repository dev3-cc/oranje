import { type ReactElement } from 'react'
import { createBrowserRouter, Navigate, useLocation, useParams } from 'react-router'

import { RequireSession } from './RequireSession'
import { RoleHome } from './RoleHome'

import { AppShell, type RouteHandle } from '@/layouts/AppShell'
import { ModulePlaceholder } from '@/shared/components/ModulePlaceholder'

/**
 * Las rutas pasaron de español a inglés el 2026-09-15 (D-11: los
 * identificadores del sistema van en inglés). Las viejas siguen vivas y
 * redirigen, porque hay enlaces guardados, correos con ellas y —lo que de
 * verdad obliga— **códigos QR ya impresos y pegados en la puerta de un hotel**
 * que apuntan a `/colaborador/ponchar?qr=…`.
 *
 * Por eso el redirector conserva el parámetro de ruta Y la cadena de consulta:
 * perder el `?qr=` dejaría al colaborador en la pantalla de ponchar sin su
 * código, que es justo lo que se corrigió en el PR #50.
 */
const LEGACY_PATHS: Array<{ from: string; to: string }> = [
  { from: 'colaborador', to: '/collaborator' },
  { from: 'colaborador/perfil', to: '/collaborator/profile' },
  { from: 'colaborador/ponchar', to: '/collaborator/punch' },
  { from: 'colaborador/avisos', to: '/collaborator/notifications' },
  { from: 'colaborador/alta-2', to: '/collaborator/signup-2' },
  { from: 'colaborador/alta-3', to: '/collaborator/signup-3' },
  { from: 'usuarios', to: '/users' },
  { from: 'catalogos', to: '/catalogs' },
  { from: 'correos-corporativos', to: '/corporate-emails' },
  { from: 'propuestas', to: '/proposals' },
  { from: 'propuestas/:prospectId/:version', to: '/proposals/:prospectId/:version' },
  { from: 'pipeline/:prospectId/propuesta', to: '/pipeline/:prospectId/proposal' },
  { from: 'requisiciones', to: '/requisitions' },
  { from: 'requisiciones/autorizacion', to: '/requisitions/authorization' },
  { from: 'requisiciones/:requisitionId', to: '/requisitions/:requisitionId' },
  { from: 'pool-colaboradores', to: '/collaborator-pool' },
  { from: 'pool-colaboradores/:workerId', to: '/collaborator-pool/:workerId' },
  { from: 'reportes', to: '/reports' },
  { from: 'mi-equipo', to: '/my-team' },
  { from: 'clientes-activos', to: '/active-clients' },
  { from: 'documentos-tc', to: '/contracts' },
  { from: 'documentos-tc/:contractId', to: '/contracts/:contractId' },
  { from: 'contratos', to: '/contracts' },
  { from: 'contratos/:contractId', to: '/contracts/:contractId' },
  { from: 'mi-personal', to: '/my-staff' },
  { from: 'auditorias', to: '/audits' },
  { from: 'mi-territorio', to: '/my-territory' },
  { from: 'accidentes', to: '/accidents' },
  { from: 'hoteles/:hotelId/qr-ponche', to: '/hotels/:hotelId/punch-qr' },
]

/** Manda a la ruta nueva conservando los parámetros y la cadena de consulta. */
function LegacyRedirect({ to }: { to: string }): ReactElement {
  const params = useParams()
  const { search, hash } = useLocation()
  const target = to.replace(/:([A-Za-z]+)/g, (_match, name: string) => params[name] ?? '')

  return <Navigate to={`${target}${search}${hash}`} replace />
}

function legacyRoutes(paths: typeof LEGACY_PATHS): Array<{ path: string; element: ReactElement }> {
  return paths.map(({ from, to }) => ({ path: from, element: <LegacyRedirect to={to} /> }))
}

/* Las del Colaborador van FUERA del AppShell, al lado de su propia app: dentro
   del shell del staff, el Colaborador es expulsado a su inicio antes de que el
   redirector alcance a correr, y el QR impreso perdía su código. */
const LEGACY_WORKER_ROUTES = legacyRoutes(
  LEGACY_PATHS.filter((route) => route.from.startsWith('colaborador')),
)
const LEGACY_STAFF_ROUTES = legacyRoutes(
  LEGACY_PATHS.filter((route) => !route.from.startsWith('colaborador')),
)

/**
 * Módulos del sidebar que ya navegan pero todavía no tienen diseño. Cada uno
 * sale de aquí y pasa a ser una feature propia cuando llegue su maqueta.
 */
const PENDING_MODULES = [{ path: 'accidents', title: 'Accidentes' }]

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
/** Vistas que trabajan a lo ancho: el shell no les acota el `max-w`. */
const FULL_WIDTH: RouteHandle = { fullWidth: true }

export const router = createBrowserRouter([
  {
    /** Ruta pública. Lazy: three.js no viaja en el bundle inicial. */
    path: '/login',
    lazy: async () => {
      const m = await import('@/features/auth')
      return { Component: m.LoginPage }
    },
  },
  {
    /** La misma puerta con los textos del Colaborador (ROL-C-01). */
    path: '/collaborator/login',
    lazy: async () => {
      const m = await import('@/features/auth')
      return { Component: m.ColaboradorLoginPage }
    },
  },
  {
    path: '/',
    /** Sin sesión no hay shell: el guard intenta el refresh y decide. */
    Component: RequireSession,
    children: [
      {
        /** La hoja del QR de ponche, para imprimir: en papel no hay sidebar. */
        path: 'hotels/:hotelId/punch-qr',
        lazy: async () => {
          const m = await import('@/features/onboarding')
          return { Component: m.HotelPunchQrPrintPage }
        },
      },
      ...LEGACY_WORKER_ROUTES,
      {
        /**
         * El apartado del Colaborador (ROL-C-01): web responsive que imita la
         * app móvil de la maqueta. Vive FUERA del AppShell — el Colaborador no
         * usa el sidebar del staff.
         */
        path: 'collaborator',
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
            path: 'profile',
            lazy: async () => {
              const m = await import('@/features/worker')
              return { Component: m.ProfilePage }
            },
          },
          {
            path: 'password',
            lazy: async () => {
              const m = await import('@/features/worker')
              return { Component: m.PasswordPage }
            },
          },
          {
            path: 'punch',
            lazy: async () => {
              const m = await import('@/features/worker')
              return { Component: m.PunchPage }
            },
          },
          {
            path: 'signup-2',
            lazy: async () => {
              const m = await import('@/features/worker')
              return { Component: m.Phase2Page }
            },
          },
          {
            path: 'signup-3',
            lazy: async () => {
              const m = await import('@/features/worker')
              return { Component: m.Phase3Page }
            },
          },
          {
            path: 'notifications',
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
          { index: true, Component: RoleHome },
          {
            path: 'dashboard',
            lazy: async () => {
              const m = await import('@/features/dashboard')
              return { Component: m.DashboardPage }
            },
          },
          {
            path: 'users',
            lazy: async () => {
              const m = await import('@/features/admin')
              return { Component: m.UsersPage }
            },
          },
          {
            path: 'catalogs',
            lazy: async () => {
              const m = await import('@/features/admin')
              return { Component: m.CatalogsPage }
            },
          },
          {
            path: 'corporate-emails',
            lazy: async () => {
              const m = await import('@/features/admin')
              return { Component: m.CorporateEmailPage }
            },
          },
          {
            path: 'pipeline',
            handle: FULL_WIDTH,
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
            path: 'pipeline/:prospectId/proposal',
            lazy: async () => {
              const m = await import('@/features/onboarding')
              return { Component: m.ProposalEditorPage }
            },
          },
          {
            /* Vista transversal de solo lectura; el editor vive dentro del hotel. */
            path: 'proposals',
            lazy: async () => {
              const m = await import('@/features/onboarding')
              return { Component: m.ProposalListPage }
            },
          },
          {
            /* Una versión concreta, en solo lectura. A donde lleva «Ver propuesta». */
            path: 'proposals/:prospectId/:version',
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
            path: 'requisitions',
            lazy: async () => {
              const m = await import('@/features/requisitions')
              return { Component: m.RequisitionBoardPage }
            },
          },
          {
            /**
             * Va ANTES que `:requisitionId`, que si no se tragaría «authorization»
             * como si fuera el id de una requisición.
             */
            path: 'requisitions/authorization',
            lazy: async () => {
              const m = await import('@/features/requisitions')
              return { Component: m.RequisitionAuthorizationPage }
            },
          },
          {
            /* El detalle cuelga del tablero: se llega desde el folio de una fila. */
            path: 'requisitions/:requisitionId',
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
            handle: FULL_WIDTH,
            lazy: async () => {
              const m = await import('@/features/timesheet')
              return { Component: m.TimesheetPage }
            },
          },
          {
            path: 'timesheet-global',
            handle: FULL_WIDTH,
            lazy: async () => {
              const m = await import('@/features/timesheet')
              return { Component: m.TimesheetGlobalPage }
            },
          },
          {
            path: 'collaborator-pool',
            lazy: async () => {
              const m = await import('@/features/recruitment')
              return { Component: m.PoolPage }
            },
          },
          {
            /* El Expediente cuelga del Pool: se llega desde el nombre de la fila. */
            path: 'collaborator-pool/:workerId',
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
            path: 'reports',
            lazy: async () => {
              const m = await import('@/features/reports')
              return { Component: m.ReportsPage }
            },
          },
          {
            path: 'my-team',
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
            path: 'active-clients',
            lazy: async () => {
              const m = await import('@/features/clients')
              return { Component: m.ClientPortfolioPage }
            },
          },
          {
            path: 'contracts',
            lazy: async () => {
              const m = await import('@/features/contracts')
              return { Component: m.ContractListPage }
            },
          },
          {
            /* El contrato cuelga de la lista: se llega desde el «Abrir» de su fila. */
            path: 'contracts/:contractId',
            lazy: async () => {
              const m = await import('@/features/contracts')
              return { Component: m.ContractDetailPage }
            },
          },
          ...LEGACY_STAFF_ROUTES,
          {
            path: 'my-staff',
            lazy: async () => {
              const m = await import('@/features/personnel')
              return { Component: m.PersonnelPage }
            },
          },
          {
            path: 'audits',
            lazy: async () => {
              const m = await import('@/features/audits')
              return { Component: m.AuditsPage }
            },
          },
          {
            path: 'observability',
            lazy: async () => {
              const m = await import('@/features/observability')
              return { Component: m.ObservabilityPage }
            },
          },
          {
            path: 'my-territory',
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
