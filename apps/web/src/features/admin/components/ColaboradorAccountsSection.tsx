import { Trans, useLingui } from '@lingui/react/macro'
import { cn, MaterialIcon } from '@oranje/ui'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import { useGetCorporateEmailsQuery } from '../api/corporateEmailApi'

import { initialsOf } from './userListParts'

import { LoadError } from '@/shared/components/LoadError'
import { SearchField } from '@/shared/components/SearchField'
import { TableSkeleton } from '@/shared/components/TableSkeleton'
import { useCan } from '@/shared/hooks/useCan'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { matchesSearch } from '@/shared/lib/text'

/**
 * Colaboradores con correo corporativo ya asignado en Oranje: de solo
 * lectura, porque el alta es de Reclutamiento (Pool de Colaboradores), no del
 * Administrador — aquí solo se ve la cuenta y se enlaza al expediente y al
 * buzón real de cPanel.
 */
export function ColaboradorAccountsSection(): ReactNode {
  const { t } = useLingui()
  const [search, setSearch] = useState('')
  const settledSearch = useDebounce(search).trim()
  const canManageMailbox = useCan()('users:manage_corporate_email')

  const { data: rows, isLoading, isError, refetch } = useGetCorporateEmailsQuery()

  const visible = useMemo(
    () => (rows ?? []).filter((row) => matchesSearch(settledSearch, row.workerName, row.email)),
    [rows, settledSearch],
  )

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        <p className="text-xs text-ink-3">
          {IS_DEV_UI
            ? 'personal.worker + identity.user.email · solo lectura · el alta es de Reclutamiento'
            : t`Los colaboradores que ya tienen correo @oranjepeople.com. El alta es de Reclutamiento.`}
        </p>
        <span className="flex-1" />
        <SearchField
          value={search}
          onChange={setSearch}
          label={t`Buscar colaborador`}
          placeholder={t`Nombre o correo, p. ej. Ana Rivera…`}
          className="w-72"
        />
      </div>

      {isError ? (
        <LoadError
          message={t`No se pudo cargar la lista de colaboradores.`}
          onRetry={() => {
            void refetch()
          }}
        />
      ) : isLoading ? (
        <TableSkeleton rows={6} columns={4} />
      ) : visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
          {search.trim() === ''
            ? t`Todavía nadie tiene correo corporativo asignado.`
            : t`Nadie coincide con «${search}».`}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-line bg-surface">
          {visible.map((row) => (
            <li key={row.workerId} className="border-b border-line last:border-b-0">
              <div className="flex w-full items-center gap-4 px-5 py-4">
                <Link
                  to={`/collaborator-pool/${row.workerId}`}
                  className="flex min-w-0 flex-1 items-center gap-4"
                >
                  {row.photoUrl ? (
                    <img
                      src={row.photoUrl}
                      alt=""
                      className="size-10 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className={cn(
                        'flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                        row.isActive ? 'bg-o-50 text-o-700' : 'bg-surface-3/70 text-ink-3',
                      )}
                    >
                      {initialsOf(row.workerName)}
                    </span>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span
                      className={cn(
                        'truncate text-sm font-bold',
                        row.isActive ? 'text-ink' : 'text-ink-3',
                      )}
                    >
                      {row.workerName}
                    </span>
                    <span className="truncate font-mono text-xs text-ink-3">{row.email}</span>
                  </div>
                </Link>

                <span
                  className={cn(
                    'hidden shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold md:inline-flex',
                    row.isActive ? 'bg-green/10 text-green' : 'bg-surface-3/70 text-ink-3',
                  )}
                >
                  {row.isActive ? t`Activo` : t`Inactivo`}
                </span>

                <span
                  className={cn(
                    'hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium md:inline-flex',
                    row.mailboxExists ? 'bg-green/15 text-green' : 'bg-surface-2 text-ink-3',
                  )}
                >
                  <MaterialIcon
                    name={row.mailboxExists ? 'mail' : 'mail_outline'}
                    className="text-sm"
                    aria-hidden
                  />
                  {row.mailboxExists ? t`Buzón creado` : t`Buzón sin crear`}
                </span>

                {canManageMailbox && (
                  <Link
                    to="/corporate-emails"
                    className="shrink-0 text-xs font-semibold text-o-700 hover:underline"
                  >
                    <Trans>Gestionar buzón</Trans>
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
