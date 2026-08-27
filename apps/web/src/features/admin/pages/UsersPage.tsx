import { cn, Input, MaterialIcon } from '@oranje/ui'
import { useMemo, useState, type ReactNode } from 'react'

import { useGetStaffRolesQuery, useGetStaffUsersQuery } from '../api/adminApi'
import { UserFormDialog } from '../components/UserFormDialog'
import type { StaffUser } from '../types/admin.types'

import { Button } from '@/shared/components/Button'
import { FilterSelect } from '@/shared/components/FilterSelect'
import { LoadingState } from '@/shared/components/LoadingState'
import { IS_DEV_UI } from '@/shared/lib/devMode'

const DATE_FORMAT = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

function initialsOf(fullName: string): string {
  return fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase()
}

function CellStat({
  value,
  label,
  tone,
}: {
  value: ReactNode
  label: string
  tone?: 'muted'
}): ReactNode {
  return (
    <div className="hidden w-36 shrink-0 flex-col gap-0.5 md:flex">
      <span className={cn('text-sm', tone === 'muted' ? 'text-ink-3' : 'text-ink')}>{value}</span>
      <span className="text-xs text-ink-4">{label}</span>
    </div>
  )
}

export function UsersPage(): ReactNode {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [tab, setTab] = useState<'active' | 'inactive'>('active')
  const [editing, setEditing] = useState<StaffUser | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)

  const { data: roles = [] } = useGetStaffRolesQuery()
  const { data: users = [], isLoading } = useGetStaffUsersQuery({
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(roleFilter !== 'ALL' ? { roleCode: roleFilter } : {}),
    includeInactive: true,
  })

  const active = useMemo(() => users.filter((user) => user.isActive), [users])
  const inactive = useMemo(() => users.filter((user) => !user.isActive), [users])
  const visible = tab === 'active' ? active : inactive
  const nameById = useMemo(() => new Map(users.map((user) => [user.id, user.fullName])), [users])

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-[22px] font-bold text-ink">Usuarios del sistema</h1>
        <p className="mt-1 text-sm text-ink-3">
          {IS_DEV_UI
            ? 'identity.user · personal interno de Oranje · users:manage — solo el Administrador (ROL-ADM-01)'
            : 'El personal interno de Oranje: quién es, qué rol tiene y si ya entró.'}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2.5">
        {(
          [
            ['active', 'Activos', active.length],
            ['inactive', 'Inactivos', inactive.length],
          ] as Array<['active' | 'inactive', string, number]>
        ).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setTab(key)
            }}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors',
              tab === key
                ? 'bg-o-50 font-semibold text-o-700'
                : 'text-ink-3 hover:bg-surface-2 hover:text-ink',
            )}
          >
            <span
              className={cn(
                'flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-bold',
                tab === key ? 'bg-o-500 text-ink' : 'bg-surface-3 text-ink-2',
              )}
            >
              {count}
            </span>
            {label}
          </button>
        ))}
        <span className="flex-1" />
        <Input
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
          }}
          placeholder="Buscar por nombre o correo…"
          aria-label="Buscar usuario"
          className="h-auto w-64 rounded-full py-2.5"
        />
        <FilterSelect
          label="Rol"
          anyLabel="todos"
          value={roleFilter}
          options={roles.map((role) => ({ value: role.code, label: role.name }))}
          onChange={setRoleFilter}
          icon="badge"
        />
        <Button
          variant="primary"
          onClick={() => {
            setEditing(null)
            setIsFormOpen(true)
          }}
        >
          + Nuevo usuario
        </Button>
      </div>

      {isLoading ? (
        <LoadingState label="Cargando el personal del sistema…" />
      ) : visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
          {tab === 'active' ? 'Nadie coincide con el filtro.' : 'Nadie está de baja.'}
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
                      <span title="Cuenta enlazada" aria-label="Cuenta enlazada">
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
                  {!user.isActive ? (
                    <span className="rounded-full bg-surface-3/70 px-2.5 py-1 text-xs font-semibold text-ink-3">
                      Inactivo
                    </span>
                  ) : user.hasAccount ? (
                    <span className="rounded-full bg-green/10 px-2.5 py-1 text-xs font-semibold text-green">
                      Enlazada
                    </span>
                  ) : (
                    <span className="rounded-full bg-yellow/15 px-2.5 py-1 text-xs font-semibold text-o-700">
                      Invitación enviada
                    </span>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs leading-relaxed text-ink-3">
        El correo no se edita: es el vínculo con la cuenta de Firebase — cambiar de persona es dar
        de baja y dar de alta. La cuenta se enlaza sola en el primer login. Los roles de Hotel no se
        dan de alta aquí: nacen en la Conversión{IS_DEV_UI ? ' (RR-V-02)' : ''}.
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
    </div>
  )
}
