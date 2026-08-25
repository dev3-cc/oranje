import { cn } from '@oranje/ui'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router'

import { useGetSessionQuery, useLogoutMutation } from '@/app/sessionApi'
import logoOranje from '@/assets/logo/Logo_ORANJE_Orange.png'

interface NavModule {
  label: string
  to: string
  icon: string
  roles?: readonly string[]
}

const BD = 'ROL-V-01'
const BDC = 'ROL-V-02'
const RECLUTADORA = 'ROL-R-01'
const LIDER_GRUPO = 'ROL-R-02'
const MGR_RECLUTAMIENTO = 'ROL-R-03'
const SUPERVISOR = 'ROL-H-01'
const MGR_AREA = 'ROL-H-02'
const MGR_GENERAL = 'ROL-H-03'

const VENTAS = [BD, BDC] as const
const RECLUTAMIENTO = [RECLUTADORA, LIDER_GRUPO, MGR_RECLUTAMIENTO] as const
const HOTEL = [SUPERVISOR, MGR_AREA, MGR_GENERAL] as const

const MAPPED_ROLES: ReadonlySet<string> = new Set([...VENTAS, ...RECLUTAMIENTO, ...HOTEL])

const MODULES: NavModule[] = [
  { label: 'Dashboard', to: '/dashboard', icon: 'space_dashboard' },
  { label: 'Pipeline', to: '/pipeline', icon: 'view_kanban', roles: VENTAS },
  { label: 'Mi Territorio', to: '/mi-territorio', icon: 'map', roles: VENTAS },
  { label: 'Propuestas', to: '/propuestas', icon: 'description', roles: VENTAS },
  { label: 'Documentos T&C', to: '/documentos-tc', icon: 'gavel', roles: VENTAS },
  { label: 'Conversión', to: '/conversion', icon: 'swap_horiz', roles: [BDC] },
  { label: 'Clientes Activos', to: '/clientes-activos', icon: 'apartment', roles: VENTAS },
  { label: 'Mi Equipo', to: '/mi-equipo', icon: 'groups', roles: [BDC] },
  { label: 'Reportes', to: '/reportes', icon: 'bar_chart', roles: [BDC] },
  {
    label: 'Requisiciones',
    to: '/requisiciones',
    icon: 'assignment',
    roles: [...RECLUTAMIENTO, ...HOTEL],
  },
  {
    label: 'Pool de Colaboradores',
    to: '/pool-colaboradores',
    icon: 'badge',
    roles: RECLUTAMIENTO,
  },
  {
    label: 'Self-Pick',
    to: '/self-pick',
    icon: 'flash_on',
    roles: [RECLUTADORA, LIDER_GRUPO],
  },
  { label: 'Blacklist', to: '/blacklist', icon: 'block', roles: RECLUTAMIENTO },
  { label: 'Schedule', to: '/schedule', icon: 'calendar_month', roles: HOTEL },
  { label: 'Timesheet', to: '/timesheet', icon: 'schedule', roles: HOTEL },
  { label: 'Timesheet Global', to: '/timesheet-global', icon: 'fact_check', roles: [MGR_GENERAL] },
  { label: 'Mi Personal', to: '/mi-personal', icon: 'badge', roles: HOTEL },
  { label: 'Accidentes', to: '/accidentes', icon: 'report', roles: HOTEL },
]

function modulesForRole(roleId: string | undefined): NavModule[] {
  if (!roleId || !MAPPED_ROLES.has(roleId)) return MODULES
  return MODULES.filter((module) => !module.roles || module.roles.includes(roleId))
}

export function Sidebar(): ReactNode {
  const { data: session } = useGetSessionQuery()
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation()

  return (
    <aside className="flex w-sb shrink-0 flex-col border-r border-line bg-surface">
      {}
      <div className="flex h-hd shrink-0 items-center gap-3 px-5">
        <img src={logoOranje} alt="Oranje" className="h-4 w-auto" />
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {modulesForRole(session?.roleId).map((module) => (
          <NavLink
            key={module.label}
            to={module.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors',
                isActive
                  ? 'bg-o-50 font-semibold text-o-700'
                  : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
              )
            }
          >
            <span className="material-icons-outlined text-xl leading-none" aria-hidden>
              {module.icon}
            </span>
            {module.label}
          </NavLink>
        ))}
      </nav>

      {session && (
        <div className="p-3">
          <div className="flex items-center gap-3 rounded-md bg-surface-2 p-3">
            <span className="size-9 shrink-0 rounded-full bg-o-500" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{session.shortName}</p>
              <p className="truncate text-xs text-ink-3">{session.roleTitle}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                void logout()
              }}
              disabled={isLoggingOut}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="shrink-0 rounded-md p-2 text-ink-3 transition-colors hover:bg-surface hover:text-red disabled:opacity-50"
            >
              <span className="material-icons-outlined text-xl leading-none" aria-hidden>
                logout
              </span>
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}
