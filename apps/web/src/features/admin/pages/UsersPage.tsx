import { cn, MaterialIcon } from '@oranje/ui'
import { useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'

import { useGetStaffRolesQuery, useGetStaffUsersQuery } from '../api/adminApi'
import { HotelUsersSection } from '../components/HotelUsersSection'
import { UserFormDialog } from '../components/UserFormDialog'
import {
  AccountStatusChip,
  CellStat,
  DATE_FORMAT,
  initialsOf,
  StatusTabs,
} from '../components/userListParts'
import type { StaffUser } from '../types/admin.types'

import personajeConfiguracion from '@/assets/ilustrations/personaje-configuracion.svg'
import { Button } from '@/shared/components/Button'
import { FilterReset } from '@/shared/components/FilterReset'
import { FilterSelect } from '@/shared/components/FilterSelect'
import { LoadError } from '@/shared/components/LoadError'
import { NoticeCard } from '@/shared/components/NoticeCard'
import { SearchField } from '@/shared/components/SearchField'
import { TableSkeleton } from '@/shared/components/TableSkeleton'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { IS_DEV_UI } from '@/shared/lib/devMode'

type Scope = 'staff' | 'hotels'

/** El ámbito vive en la URL (`?ambito=hoteles`): un enlace a la pestaña se puede compartir. */
const SCOPES: ReadonlyArray<[Scope, string, string]> = [
  ['staff', 'Personal Oranje', 'badge'],
  ['hotels', 'Personal de hoteles', 'apartment'],
]

export function UsersPage(): ReactNode {
  const [searchParams, setSearchParams] = useSearchParams()
  const scope: Scope = searchParams.get('ambito') === 'hoteles' ? 'hotels' : 'staff'

  function setScope(next: Scope): void {
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current)
        if (next === 'hotels') params.set('ambito', 'hoteles')
        else params.delete('ambito')
        return params
      },
      { replace: true },
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-ink">Usuarios del sistema</h1>
          <p className="mt-1 text-sm text-ink-3">
            {IS_DEV_UI
              ? scope === 'staff'
                ? 'identity.user · personal interno de Oranje · users:manage — solo el Administrador (ROL-ADM-01)'
                : 'identity.user · hotel_id NOT NULL · users:manage_hotel — solo el Administrador (ROL-ADM-01)'
              : scope === 'staff'
                ? 'El personal interno de Oranje: quién es, qué rol tiene y si ya entró.'
                : 'Las cuentas de cada hotel: Supervisores, Managers de Área y Managers Generales.'}
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Ámbito"
          className="flex w-fit gap-1 rounded-xl bg-surface-2 p-1"
        >
          {SCOPES.map(([key, label, icon]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={scope === key}
              onClick={() => {
                setScope(key)
              }}
              className={cn(
                'flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs transition-colors',
                scope === key
                  ? 'border border-line bg-surface font-semibold text-ink'
                  : 'text-ink-3 hover:text-ink',
              )}
            >
              <MaterialIcon name={icon} className="text-base" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </header>

      {scope === 'staff' ? <StaffUsersSection /> : <HotelUsersSection />}
    </div>
  )
}

function StaffUsersSection(): ReactNode {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [tab, setTab] = useState<'active' | 'inactive'>('active')
  const [editing, setEditing] = useState<StaffUser | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)

  /* El campo responde al instante; la consulta espera a que se deje de teclear. */
  const settledSearch = useDebounce(search).trim()
  const hasFilters = search.trim() !== '' || roleFilter !== 'ALL'

  const { data: roles = [] } = useGetStaffRolesQuery()

  const commonParams = {
    ...(settledSearch ? { search: settledSearch } : {}),
    ...(roleFilter !== 'ALL' ? { roleCode: roleFilter } : {}),
  }

  /**
   * Dos consultas, no una: el personal interno de Oranje YA pasó el tope de
   * 100 filas del back entre activos e inactivos acumulados (meses de altas
   * de prueba). Una sola consulta con `includeInactive` mezclaba ambos en la
   * misma página paginada — con los inactivos dominando por volumen, un
   * activo recién creado podía quedar fuera de esa ventana. Pedir los
   * activos APARTE (sin `includeInactive`, el back ya filtra `isActive` del
   * lado del servidor) garantiza que los ~50 activos reales siempre entren
   * completos, sin importar cuántos inactivos haya.
   */
  const activeQuery = useGetStaffUsersQuery(commonParams)
  const allQuery = useGetStaffUsersQuery({ ...commonParams, includeInactive: true })

  const active = activeQuery.data?.rows ?? []
  /* Capado a lo que trae `allQuery` (100 filas): con cientos de inactivos
     acumulados, esa pestaña no ve el historial completo todavía — pendiente
     de paginación real si hace falta navegarlo entero. */
  const inactive = useMemo(
    () => (allQuery.data?.rows ?? []).filter((u) => !u.isActive),
    [allQuery.data],
  )
  const visible = tab === 'active' ? active : inactive
  const activeTotal = activeQuery.data?.total ?? active.length
  /* Inactivos = el total SIN filtrar menos el total de activos — ambos vienen
     del `meta.total` del back, así que el contador es exacto aunque la lista
     visible de arriba esté recortada a 100 filas. */
  const inactiveTotal = allQuery.data
    ? Math.max(0, allQuery.data.total - activeTotal)
    : inactive.length

  const isLoading = tab === 'active' ? activeQuery.isLoading : allQuery.isLoading
  const isFetching = activeQuery.isFetching || allQuery.isFetching
  const isError = activeQuery.isError || allQuery.isError
  const error = activeQuery.error ?? allQuery.error
  function refetch(): void {
    void activeQuery.refetch()
    void allQuery.refetch()
  }

  const nameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const user of [...active, ...(allQuery.data?.rows ?? [])]) map.set(user.id, user.fullName)
    return map
  }, [active, allQuery.data])

  /* El módulo entero es del Administrador (users:manage): el 403 dice quién sigue. */
  if ((error as { status?: number } | undefined)?.status === 403) {
    return (
      <NoticeCard
        image={personajeConfiguracion}
        title="Usuarios del sistema es del Administrador"
        role="status"
      >
        El alta, la edición y la baja del personal interno de Oranje las hace el Administrador; tu
        rol no tiene este módulo.
      </NoticeCard>
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        <StatusTabs
          tab={tab}
          onChange={setTab}
          activeTotal={activeTotal}
          inactiveTotal={inactiveTotal}
        />
        <span className="flex-1" />
        <SearchField
          isSearching={isFetching && settledSearch !== ''}
          value={search}
          onChange={setSearch}
          label="Buscar usuario"
          placeholder="Nombre o correo, p. ej. Ana López…"
          className="w-72"
        />
        <FilterSelect
          label="Rol"
          anyLabel="todos"
          value={roleFilter}
          options={roles.map((role) => ({ value: role.code, label: role.name }))}
          onChange={setRoleFilter}
          icon="badge"
        />
        <FilterReset
          activeCount={(search.trim() !== '' ? 1 : 0) + (roleFilter !== 'ALL' ? 1 : 0)}
          onReset={() => {
            setSearch('')
            setRoleFilter('ALL')
          }}
        />
        <Button
          variant="primary"
          onClick={() => {
            setEditing(null)
            setIsFormOpen(true)
          }}
        >
          Agregar usuario
        </Button>
      </div>

      {isError ? (
        <LoadError
          message="No se pudieron cargar los usuarios. Reintenta en unos segundos."
          onRetry={() => {
            void refetch()
          }}
        />
      ) : isLoading ? (
        <TableSkeleton rows={6} columns={4} />
      ) : visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
          {hasFilters
            ? 'Nadie coincide con esa búsqueda. Prueba otro nombre, correo o rol, o quita los filtros.'
            : tab === 'active'
              ? 'Todavía no hay personal activo. Agrega al primer usuario con el botón de arriba.'
              : 'Nadie está de baja. Las personas que des de baja aparecerán aquí.'}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-line bg-surface">
          {visible.map((user) => (
            <li key={user.id} className="border-b border-line last:border-b-0">
              <button
                type="button"
                onClick={() => {
                  setEditing(user)
                  setIsFormOpen(true)
                }}
                className="flex w-full cursor-pointer items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-2"
              >
                {user.photoUrl ? (
                  <img
                    src={user.photoUrl}
                    alt=""
                    className="size-10 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span
                    aria-hidden
                    className={cn(
                      'flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      user.isActive ? 'bg-o-50 text-o-700' : 'bg-surface-3/70 text-ink-3',
                    )}
                  >
                    {initialsOf(user.fullName)}
                  </span>
                )}

                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        'truncate text-sm font-bold',
                        user.isActive ? 'text-ink' : 'text-ink-3',
                      )}
                    >
                      {user.fullName}
                    </span>
                    {user.hasAccount && (
                      <span title="Ya entró al sistema" aria-label="Ya entró al sistema">
                        <MaterialIcon name="verified" className="shrink-0 text-base text-o-500" />
                      </span>
                    )}
                  </span>
                  <span className="truncate text-xs text-ink-3">{user.email}</span>
                </div>

                <CellStat
                  value={DATE_FORMAT.format(new Date(user.createdAt))}
                  label="Fecha de alta"
                />
                <CellStat
                  value={user.reportsToUserId ? (nameById.get(user.reportsToUserId) ?? '—') : '—'}
                  label="Reporta a"
                  {...(user.reportsToUserId ? {} : { tone: 'muted' as const })}
                />
                <CellStat value={user.role.name} label="Rol" />

                <div className="hidden w-36 shrink-0 justify-end lg:flex">
                  <AccountStatusChip isActive={user.isActive} hasAccount={user.hasAccount} />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs leading-relaxed text-ink-3">
        El correo no se edita: es con el que la persona entra. Para cambiar de persona, da de baja y
        da de alta. La cuenta queda enlazada la primera vez que entra. Las cuentas de los hoteles
        tienen su propia pestaña: «Personal de hoteles».
      </p>

      <UserFormDialog
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false)
        }}
        user={editing}
        roles={roles}
        reportsToOptions={active}
      />
    </>
  )
}
