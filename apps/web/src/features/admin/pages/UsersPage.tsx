import { cn, DataTable, Input, type ColumnDef } from '@oranje/ui'
import { useMemo, useState, type ReactNode } from 'react'

import { useGetStaffRolesQuery, useGetStaffUsersQuery } from '../api/adminApi'
import { UserFormDialog } from '../components/UserFormDialog'
import type { StaffUser } from '../types/admin.types'

import { Button } from '@/shared/components/Button'
import { FilterSelect } from '@/shared/components/FilterSelect'
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

function SoftChip({
  tone,
  children,
}: {
  tone: 'orange' | 'green' | 'gray'
  children: ReactNode
}): ReactNode {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
        tone === 'orange' && 'bg-o-50 text-o-700',
        tone === 'green' && 'bg-green/10 text-green',
        tone === 'gray' && 'bg-surface-3/70 text-ink-3',
      )}
    >
      {children}
    </span>
  )
}

export function UsersPage(): ReactNode {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [inactiveFilter, setInactiveFilter] = useState('no')
  const [editing, setEditing] = useState<StaffUser | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)

  const { data: roles = [] } = useGetStaffRolesQuery()
  const { data: users = [], isLoading } = useGetStaffUsersQuery({
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(roleFilter !== 'ALL' ? { roleCode: roleFilter } : {}),
    includeInactive: inactiveFilter === 'yes',
  })

  const nameById = useMemo(() => new Map(users.map((user) => [user.id, user.fullName])), [users])

  const columns = useMemo<ColumnDef<StaffUser, unknown>[]>(
    () => [
      {
        accessorKey: 'fullName',
        header: 'Nombre',
        cell: ({ row }) => (
          <span className="flex items-center gap-3">
            <span
              aria-hidden
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                row.original.isActive ? 'bg-o-50 text-o-700' : 'bg-surface-3/70 text-ink-3',
              )}
            >
              {initialsOf(row.original.fullName)}
            </span>
            <span
              className={cn(
                'text-sm font-bold whitespace-nowrap',
                row.original.isActive ? 'text-ink' : 'text-ink-3',
              )}
            >
              {row.original.fullName}
            </span>
          </span>
        ),
      },
      { accessorKey: 'email', header: 'Correo' },
      {
        accessorKey: 'role',
        header: 'Rol',
        cell: ({ row }) => (
          <SoftChip tone={row.original.isActive ? 'orange' : 'gray'}>
            {row.original.role.name}
          </SoftChip>
        ),
      },
      {
        accessorKey: 'reportsToUserId',
        header: 'Reporta a',
        cell: ({ row }) =>
          row.original.reportsToUserId ? (nameById.get(row.original.reportsToUserId) ?? '—') : '—',
      },
      {
        accessorKey: 'hasAccount',
        header: 'Cuenta',
        cell: ({ row }) =>
          row.original.hasAccount ? (
            <SoftChip tone="green">Enlazada</SoftChip>
          ) : (
            <SoftChip tone="gray">Invitación enviada</SoftChip>
          ),
      },
      {
        accessorKey: 'isActive',
        header: 'Estado',
        cell: ({ row }) =>
          row.original.isActive ? (
            <SoftChip tone="green">Activo</SoftChip>
          ) : (
            <SoftChip tone="gray">Inactivo</SoftChip>
          ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Alta',
        cell: ({ row }) => (
          <span className="text-xs whitespace-nowrap text-ink-3">
            {DATE_FORMAT.format(new Date(row.original.createdAt))}
          </span>
        ),
      },
    ],
    [nameById],
  )

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
        <Input
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
          }}
          placeholder="Buscar por nombre o correo…"
          aria-label="Buscar usuario"
          className="h-auto w-72 rounded-full py-2.5"
        />
        <FilterSelect
          label="Rol"
          anyLabel="todos"
          value={roleFilter}
          options={roles.map((role) => ({ value: role.code, label: role.name }))}
          onChange={setRoleFilter}
          icon="badge"
        />
        <FilterSelect
          label="Inactivos"
          anyLabel="ocultos"
          anyValue="no"
          value={inactiveFilter}
          options={[{ value: 'yes', label: 'incluidos' }]}
          onChange={setInactiveFilter}
          icon="visibility"
        />
        <span className="flex-1" />
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
        <p className="py-8 text-center text-sm text-ink-3">Cargando usuarios…</p>
      ) : (
        <DataTable
          columns={columns}
          data={users}
          dense
          emptyMessage="Nadie coincide con el filtro."
          onRowClick={(user) => {
            setEditing(user)
            setIsFormOpen(true)
          }}
        />
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
        reportsToOptions={users.filter((user) => user.isActive)}
      />
    </div>
  )
}
