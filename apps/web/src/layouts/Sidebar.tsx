import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
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
  SidebarMenuSkeleton,
  cn,
  useSidebar,
} from '@oranje/ui'
import type { ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router'

import { useGetSessionQuery, useLogoutMutation, useUpdateMyLocaleMutation } from '@/app/sessionApi'
import logoAnimado from '@/assets/loader/oranje-sidebar-light.lottie'
import { LanguageSwitch } from '@/shared/components/LanguageSwitch'
import { SoundSwitch } from '@/shared/components/SoundSwitch'
import { roleLabelOf } from '@/shared/constants/roles'

interface NavModule {
  label: MessageDescriptor
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
const INSPECTOR = 'ROL-I-01'
const COORDINADOR_INSPECCION = 'ROL-I-02'
const OBSERVADOR = 'ROL-OBS-01'

const VENTAS = [BD, BDC] as const
const RECLUTAMIENTO = [RECLUTADORA, LIDER_GRUPO, MGR_RECLUTAMIENTO] as const
const HOTEL = [SUPERVISOR, MGR_AREA, MGR_GENERAL] as const
/* Inspección no tiene arquitectura ni permisos más allá del accidente
   (`accident:read|medical_follow_up|close` del Inspector): sin mapa veía
   los 20 módulos y todos le respondían 403 menos Accidentes. */
const INSPECCION = [INSPECTOR, COORDINADOR_INSPECCION] as const

const STAFF = [...VENTAS, ...RECLUTAMIENTO, ...HOTEL] as const

const MAPPED_ROLES: ReadonlySet<string> = new Set([...STAFF, ...INSPECCION, ADMIN, OBSERVADOR])

const MODULES: NavModule[] = [
  { label: msg`Dashboard`, to: '/dashboard', icon: 'space_dashboard', roles: STAFF },
  /* Observador (ROL-OBS-01, Roles del Sistema.md 2026-09-21): transversal, de
     solo lectura — no ve nada más del sidebar del staff, ni siquiera el
     Dashboard, que compone datos por rol que el Observador no tiene. */
  {
    label: msg`Observador`,
    to: '/observability',
    icon: 'monitoring',
    roles: [OBSERVADOR],
  },
  { label: msg`Usuarios`, to: '/users', icon: 'manage_accounts', roles: [ADMIN] },
  { label: msg`Catálogos`, to: '/catalogs', icon: 'category', roles: [ADMIN] },
  {
    label: msg`Correos corporativos`,
    to: '/corporate-emails',
    icon: 'alternate_email',
    roles: [ADMIN],
  },
  { label: msg`Pipeline`, to: '/pipeline', icon: 'view_kanban', roles: VENTAS },
  { label: msg`Mi Territorio`, to: '/my-territory', icon: 'map', roles: VENTAS },
  { label: msg`Propuestas`, to: '/proposals', icon: 'description', roles: VENTAS },
  { label: msg`Contratos`, to: '/contracts', icon: 'gavel', roles: VENTAS },
  { label: msg`Conversión`, to: '/conversion', icon: 'swap_horiz', roles: [BDC] },
  { label: msg`Clientes Activos`, to: '/active-clients', icon: 'apartment', roles: VENTAS },
  { label: msg`Mi Equipo`, to: '/my-team', icon: 'groups', roles: [BDC] },
  { label: msg`Reportes`, to: '/reports', icon: 'bar_chart', roles: [BDC] },
  {
    label: msg`Requisiciones`,
    to: '/requisitions',
    icon: 'assignment',
    /* El Inspector también las crea, acotado a su zona (Reglas de Negocio,
       2026-09-24); el Coordinador entra por herencia de jerarquía. */
    roles: [...RECLUTAMIENTO, ...HOTEL, ...INSPECCION],
  },
  {
    label: msg`Pool de Colaboradores`,
    to: '/collaborator-pool',
    icon: 'badge',
    roles: RECLUTAMIENTO,
  },
  {
    label: msg`Self-Pick`,
    to: '/self-pick',
    icon: 'flash_on',
    /* Herencia por jerarquía (Reglas de Negocio, 2026-09-14): el Líder y el
       Manager de Reclutamiento también toman requisiciones y asignan slots. */
    roles: RECLUTAMIENTO,
  },
  { label: msg`Blacklist`, to: '/blacklist', icon: 'block', roles: RECLUTAMIENTO },
  /* Beta «Ponche por Horario» (fecha indefinida, Reglas de Negocio, 2026-09-23):
     nadie planea turnos a mano y la pantalla ya no tiene entradas propias que
     mostrar — el Timesheet ya dice quién ponchó. `roles: []` oculta el enlace
     sin borrar el módulo; revertir es volver a `roles: HOTEL`. */
  { label: msg`Schedule`, to: '/schedule', icon: 'calendar_month', roles: [] },
  { label: msg`Timesheet`, to: '/timesheet', icon: 'schedule', roles: HOTEL },
  {
    label: msg`Timesheet Global`,
    to: '/timesheet-global',
    icon: 'fact_check',
    roles: [MGR_GENERAL],
  },
  { label: msg`Mi Personal`, to: '/my-staff', icon: 'badge', roles: HOTEL },
  { label: msg`Accidentes`, to: '/accidents', icon: 'report', roles: [...HOTEL, ...INSPECCION] },
  /* Auditar es del Supervisor y, desde el 2026-09-24, del Inspector (sus
     hoteles de zona) — ninguno de sus jefes lo ve (fuera de la herencia por
     jerarquía a propósito, Hugo). */
  { label: msg`Auditorías`, to: '/audits', icon: 'fact_check', roles: [SUPERVISOR, INSPECTOR] },
]

function modulesForRole(roleId: string | undefined): NavModule[] {
  if (!roleId || !MAPPED_ROLES.has(roleId)) return MODULES
  return MODULES.filter((module) => !module.roles || module.roles.includes(roleId))
}

/** Filas fijas mientras la sesión resuelve — ni todas las secciones ni ninguna, solo "cargando". */
const SKELETON_ROWS = 7

export function Sidebar(): ReactNode {
  const { data: session, isLoading: isSessionLoading } = useGetSessionQuery()
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation()
  const [updateMyLocale] = useUpdateMyLocaleMutation()
  const { i18n } = useLingui()
  const { setOpenMobile } = useSidebar()
  const location = useLocation()
  const navigate = useNavigate()

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
              {isSessionLoading ? (
                Array.from({ length: SKELETON_ROWS }, (_, row) => (
                  <SidebarMenuItem key={row}>
                    <SidebarMenuSkeleton showIcon />
                  </SidebarMenuItem>
                ))
              ) : (
                <>
                  {modulesForRole(session?.roleId).map((module) => {
                    /* NavLink recibe un className de FUNCIÓN (isActive de su
                       propio render-prop); Slot de asChild solo sabe fusionar
                       strings y lo aplastaba a su código fuente — el fondo
                       naranja nunca se pintaba en ningún módulo. Se calcula
                       aquí, como string, y se pasa también a SidebarMenuButton
                       (su variante ya trae `data-[active=true]:bg-sidebar-accent`). */
                    const isActive = location.pathname === module.to
                    return (
                      <SidebarMenuItem key={module.to}>
                        <SidebarMenuButton asChild isActive={isActive} className="h-auto">
                          <NavLink
                            to={module.to}
                            onClick={() => {
                              setOpenMobile(false)
                            }}
                            className={cn(
                              'flex items-center gap-3 px-3 py-2.5 text-sm',
                              !isActive && 'text-ink-2',
                            )}
                          >
                            <span
                              className="material-icons-outlined text-xl leading-none"
                              aria-hidden
                            >
                              {module.icon}
                            </span>
                            {i18n._(module.label)}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {session && (
        <SidebarFooter>
          {/* Tarjeta de perfil simple (Hugo, 2026-09-15: "se ve feo" el
              encabezado con portada y avatar encimado — una fila plana con
              foto, nombre y rol, sin perder cerrar sesión ni el idioma). */}
          <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                {session.photoUrl ? (
                  <img
                    src={session.photoUrl}
                    alt=""
                    aria-hidden
                    className="size-9 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-o-500 text-sm font-bold text-ink"
                  >
                    {session.shortName.charAt(0)}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{session.shortName}</p>
                  <p className="truncate text-xs text-ink-3">{roleLabelOf(session.roleId).title}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  /* Navegar ANTES de que la sesión se limpie: si se espera
                     a que `logout` resuelva, `RequireSession` alcanza a
                     redirigir con `state.from` = esta misma ruta (p. ej.
                     `/users`), y quien entre después con OTRO rol
                     aterriza ahí en vez de en su inicio — el bug de
                     "se queda pegado en la pantalla del rol anterior". Al
                     salir a `/login` de inmediato, ese guard ya no está
                     montado cuando el logout termina. */
                  void navigate('/login', { replace: true })
                  void logout()
                }}
                disabled={isLoggingOut}
                title={i18n._(msg`Cerrar sesión`)}
                aria-label={i18n._(msg`Cerrar sesión`)}
                className="shrink-0 cursor-pointer rounded-md p-2 text-ink-3 transition-colors hover:bg-surface-2 hover:text-red disabled:opacity-50"
              >
                <span className="material-icons-outlined text-xl leading-none" aria-hidden>
                  logout
                </span>
              </button>
            </div>
            {/* Idioma junto a la cuenta (D-36), en su propio renglón: al lado del
                nombre se topaba con él en tarjetas angostas — un control de
                Español/English con etiquetas completas no cabe ahí. */}
            <LanguageSwitch
              size="sm"
              className="w-full"
              onChange={(locale) => {
                void updateMyLocale(locale)
              }}
            />
            {/* El sonido se apaga aquí mismo: es del aparato, no de la persona. */}
            <SoundSwitch className="w-full justify-center" />
          </div>
        </SidebarFooter>
      )}
    </SidebarRoot>
  )
}
