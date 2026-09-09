import { cn, MaterialIcon } from '@oranje/ui'
import { useMemo, useState, type ReactNode } from 'react'

import {
  useGetHotelDepartmentOptionsQuery,
  useGetHotelOptionsQuery,
  useGetHotelUsersQuery,
} from '../api/adminApi'
import { HOTEL_ROLE_OPTIONS, type HotelUser } from '../types/admin.types'

import { HotelUserFormDialog } from './HotelUserFormDialog'
import { AccountStatusChip, CellStat, DATE_FORMAT, initialsOf, StatusTabs } from './userListParts'

import { Button } from '@/shared/components/Button'
import { FilterReset } from '@/shared/components/FilterReset'
import { FilterSelect } from '@/shared/components/FilterSelect'
import { LoadError } from '@/shared/components/LoadError'
import { SearchField } from '@/shared/components/SearchField'
import { TableSkeleton } from '@/shared/components/TableSkeleton'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { IS_DEV_UI } from '@/shared/lib/devMode'

/**
 * Las cuentas de los hoteles (Supervisor, Manager de Área, Manager General)
 * que administra el Administrador — Reglas de Negocio · Cuentas del hotel.
 */
export function HotelUsersSection(): ReactNode {
  const [search, setSearch] = useState('')
  const [hotelFilter, setHotelFilter] = useState('ALL')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [tab, setTab] = useState<'active' | 'inactive'>('active')
  const [editing, setEditing] = useState<HotelUser | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)

  const settledSearch = useDebounce(search).trim()
  const activeFilters =
    (search.trim() !== '' ? 1 : 0) +
    (hotelFilter !== 'ALL' ? 1 : 0) +
    (roleFilter !== 'ALL' ? 1 : 0)

  const { data: hotels = [] } = useGetHotelOptionsQuery()
  const { data: departments = [] } = useGetHotelDepartmentOptionsQuery()

  const commonParams = {
    ...(settledSearch ? { search: settledSearch } : {}),
    ...(hotelFilter !== 'ALL' ? { hotelId: hotelFilter } : {}),
    ...(roleFilter !== 'ALL' ? { roleCode: roleFilter } : {}),
  }
  const activeQuery = useGetHotelUsersQuery(commonParams)
  const allQuery = useGetHotelUsersQuery({ ...commonParams, includeInactive: true })

  const active = activeQuery.data?.rows ?? []
  const inactive = useMemo(
    () => (allQuery.data?.rows ?? []).filter((u) => !u.isActive),
    [allQuery.data],
  )
  const visible = tab === 'active' ? active : inactive
  const activeTotal = activeQuery.data?.total ?? active.length
  const inactiveTotal = allQuery.data
    ? Math.max(0, allQuery.data.total - activeTotal)
    : inactive.length

  const isLoading = tab === 'active' ? activeQuery.isLoading : allQuery.isLoading
  const isFetching = activeQuery.isFetching || allQuery.isFetching
  const isError = activeQuery.isError || allQuery.isError

  const nameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const user of [...active, ...(allQuery.data?.rows ?? [])]) map.set(user.id, user.fullName)
    return map
  }, [active, allQuery.data])

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
          label="Buscar cuenta del hotel"
          placeholder="Nombre, correo u hotel, p. ej. Xcaret…"
          className="w-72"
        />
        <FilterSelect
          label="Hotel"
          anyLabel="todos"
          value={hotelFilter}
          options={hotels.map((hotel) => ({ value: hotel.id, label: hotel.name }))}
          onChange={setHotelFilter}
          icon="apartment"
        />
        <FilterSelect
          label="Rol"
          anyLabel="todos"
          value={roleFilter}
          options={HOTEL_ROLE_OPTIONS.map((role) => ({ value: role.code, label: role.name }))}
          onChange={setRoleFilter}
          icon="badge"
        />
        <FilterReset
          activeCount={activeFilters}
          onReset={() => {
            setSearch('')
            setHotelFilter('ALL')
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
          Agregar cuenta del hotel
        </Button>
      </div>

      {isError ? (
        <LoadError
          message="No se pudieron cargar las cuentas de los hoteles. Reintenta en unos segundos."
          onRetry={() => {
            void activeQuery.refetch()
            void allQuery.refetch()
          }}
        />
      ) : isLoading ? (
        <TableSkeleton rows={6} columns={5} />
      ) : visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
          {activeFilters > 0
            ? 'Nadie coincide con esa búsqueda. Prueba otro nombre, correo, hotel o rol, o quita los filtros.'
            : tab === 'active'
              ? 'Todavía no hay cuentas de hotel activas. Agrega la primera con el botón de arriba.'
              : 'Ninguna cuenta de hotel está de baja. Las que des de baja aparecerán aquí.'}
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
                <span
                  aria-hidden
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    user.isActive ? 'bg-o-50 text-o-700' : 'bg-surface-3/70 text-ink-3',
                  )}
                >
                  {initialsOf(user.fullName)}
                </span>

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

                <CellStat value={user.hotel.name} label="Hotel" />
                <CellStat
                  value={user.role.name}
                  label={user.department ? user.department.name : 'Todo el hotel'}
                />
                <CellStat
                  value={user.reportsToUserId ? (nameById.get(user.reportsToUserId) ?? '—') : '—'}
                  label="Reporta a"
                  {...(user.reportsToUserId ? {} : { tone: 'muted' as const })}
                />
                <CellStat
                  value={DATE_FORMAT.format(new Date(user.createdAt))}
                  label="Fecha de alta"
                />

                <div className="hidden w-36 shrink-0 justify-end lg:flex">
                  <AccountStatusChip isActive={user.isActive} hasAccount={user.hasAccount} />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs leading-relaxed text-ink-3">
        Cada cuenta pertenece a un solo hotel. El primer Manager General nace en la Conversión
        {IS_DEV_UI ? ' (RR-V-02)' : ''}; los Supervisores, los Managers de Área y los Managers
        Generales adicionales se dan de alta aquí. El correo, el hotel y el rol no se editan:
        cambiar cualquiera es dar de baja y dar de alta.
      </p>

      <HotelUserFormDialog
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false)
        }}
        user={editing}
        hotels={hotels}
        departments={departments}
      />
    </>
  )
}
