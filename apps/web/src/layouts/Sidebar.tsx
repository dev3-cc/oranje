import { cn } from '@oranje/ui'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router'

import { useGetSessionQuery } from '@/app/sessionApi'
import logoOranje from '@/assets/logo/Logo_ORANJE_Orange.png'

/**
 * Sidebar de 248px (`--sb`): logo arriba, módulos del rol en medio y la tarjeta
 * del usuario abajo.
 *
 * Los módulos los fija el sidebar del rol en `Estructura General App`, no este
 * archivo. TODOS navegan: los que aún no tienen diseño caen en una pantalla que
 * lo dice. Dejarlos sin responder al clic hacía parecer que la app estaba rota.
 *
 * «Propuestas» es una vista transversal de SOLO LECTURA: crear y editar sigue
 * viviendo dentro de cada hotel del pipeline.
 *
 * Sin contadores: la maqueta del Pipeline dibuja una píldora con un 12 en este
 * módulo, pero no se sabe qué cuenta —la página dice 38 abiertos— y un número
 * que nadie sabe leer es peor que ninguno.
 *
 * UN SOLO SIDEBAR PARA TODOS LOS ROLES, a propósito y por ahora. Las maquetas
 * llegan de roles distintos —BD y BDC tienen sidebars diferentes—, y mientras se
 * diseñan los módulos conviven todos aquí para que ninguno quede inalcanzable.
 * La separación por rol se hace en una pasada aparte, al final.
 */
interface NavModule {
  label: string
  to: string
  /** Ícono de Material Icons (variante outlined). */
  icon: string
}

const MODULES: NavModule[] = [
  { label: 'Dashboard', to: '/dashboard', icon: 'space_dashboard' },
  { label: 'Pipeline', to: '/pipeline', icon: 'view_kanban' },
  { label: 'Mi Territorio', to: '/mi-territorio', icon: 'map' },
  { label: 'Propuestas', to: '/propuestas', icon: 'description' },
  { label: 'Documentos T&C', to: '/documentos-tc', icon: 'gavel' },
  { label: 'Conversión', to: '/conversion', icon: 'swap_horiz' },
  { label: 'Clientes Activos', to: '/clientes-activos', icon: 'apartment' },
  { label: 'Mi Equipo', to: '/mi-equipo', icon: 'groups' },
  { label: 'Reportes', to: '/reportes', icon: 'bar_chart' },
  { label: 'Requisiciones', to: '/requisiciones', icon: 'assignment' },
  { label: 'Pool de Colaboradores', to: '/pool-colaboradores', icon: 'badge' },
  { label: 'Schedule', to: '/schedule', icon: 'calendar_month' },
  { label: 'Timesheet', to: '/timesheet', icon: 'schedule' },
  { label: 'Mi Personal', to: '/mi-personal', icon: 'badge' },
  { label: 'Accidentes', to: '/accidentes', icon: 'report' },
]

export function Sidebar(): ReactNode {
  const { data: session } = useGetSessionQuery()

  return (
    <aside className="flex w-sb shrink-0 flex-col border-r border-line bg-surface">
      {/* A la altura del header para que el logo y el buscador queden alineados */}
      <div className="flex h-hd shrink-0 items-center gap-3 px-5">
        <img src={logoOranje} alt="Oranje" className="h-4 w-auto" />
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {MODULES.map((module) => (
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
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{session.shortName}</p>
              <p className="truncate text-xs text-ink-3">{session.roleTitle}</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
