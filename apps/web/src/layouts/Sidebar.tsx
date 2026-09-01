import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import {
  Sidebar as SidebarRoot,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  cn,
  useSidebar,
} from '@oranje/ui'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router'

import { useGetSessionQuery, useLogoutMutation } from '@/app/sessionApi'
import logoAnimado from '@/assets/loader/oranje-sidebar-light.lottie'

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
const ADMIN = 'ROL-ADM-01'

const VENTAS = [BD, BDC] as const
const RECLUTAMIENTO = [RECLUTADORA, LIDER_GRUPO, MGR_RECLUTAMIENTO] as const
const HOTEL = [SUPERVISOR, MGR_AREA, MGR_GENERAL] as const

const STAFF = [...VENTAS, ...RECLUTAMIENTO, ...HOTEL] as const

const MAPPED_ROLES: ReadonlySet<string> = new Set([...STAFF, ADMIN])

const MODULES: NavModule[] = [
  { label: 'Dashboard', to: '/dashboard', icon: 'space_dashboard', roles: STAFF },
  { label: 'Usuarios', to: '/usuarios', icon: 'manage_accounts', roles: [ADMIN] },
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
    // RF-05: el Manager de Reclutamiento supervisa; no toma requisiciones.
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
  const { setOpenMobile } = useSidebar()

  return (
    <SidebarRoot>
      <SidebarHeader className="h-hd justify-center px-5">
        <div className="w-44 aspect-[1024/100] self-start" role="img" aria-label="Oranje">
          <DotLottieReact src={logoAnimado} loop autoplay />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {modulesForRole(session?.roleId).map((module) => (
                <SidebarMenuItem key={module.label}>
                  <SidebarMenuButton asChild className="h-auto">
                    <NavLink
                      to={module.to}
                      onClick={() => {
                        setOpenMobile(false)
                      }}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 px-3 py-2.5 text-sm',
                          isActive
                            ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
                            : 'text-ink-2',
                        )
                      }
                    >
                      <span className="material-icons-outlined text-xl leading-none" aria-hidden>
                        {module.icon}
                      </span>
                      {module.label}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {session && (
        <SidebarFooter>
          {/* La tarjeta de perfil (referencia): portada difuminada con el logo, avatar encimado, nombre y rol. */}
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <div className="relative h-14">
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-br from-o-50 via-o-500/25 to-o-500/50 blur-[1px]"
              />
              <div
                className="absolute top-2 right-2 w-16 opacity-70"
                role="img"
                aria-label="Oranje"
              >
                <DotLottieReact src={logoAnimado} loop autoplay />
              </div>
              <div className="absolute -bottom-5 left-3">
                {session.photoUrl ? (
                  <img
                    src={session.photoUrl}
                    alt=""
                    aria-hidden
                    className="size-11 rounded-full border-2 border-surface object-cover shadow-sm"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="flex size-11 items-center justify-center rounded-full border-2 border-surface bg-o-500 text-sm font-bold text-ink shadow-sm"
                  >
                    {session.shortName.charAt(0)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-end justify-between gap-2 px-3 pt-6 pb-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{session.shortName}</p>
                <p className="truncate text-xs text-ink-3">{session.roleTitle}</p>
              </div>
              <div className="flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={() => {
                    void logout()
                  }}
                  disabled={isLoggingOut}
                  title="Cerrar sesión"
                  aria-label="Cerrar sesión"
                  className="cursor-pointer rounded-md p-2 text-ink-3 transition-colors hover:bg-surface-2 hover:text-red disabled:opacity-50"
                >
                  <span className="material-icons-outlined text-xl leading-none" aria-hidden>
                    logout
                  </span>
                </button>
              </div>
            </div>
          </div>
        </SidebarFooter>
      )}
    </SidebarRoot>
  )
}
