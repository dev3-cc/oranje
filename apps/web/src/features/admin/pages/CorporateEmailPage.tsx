import type { I18n } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  MaterialIcon,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
} from '@oranje/ui'
import { useMemo, useState, type ReactNode } from 'react'

import {
  useCreateMailboxMutation,
  useDeleteMailboxMutation,
  useGetCorporateEmailsQuery,
  useResetMailboxPasswordMutation,
  type CorporateEmailRow,
} from '../api/corporateEmailApi'

import personajeConfiguracion from '@/assets/ilustrations/personaje-configuracion.svg'
import { Button } from '@/shared/components/Button'
import { LoadError } from '@/shared/components/LoadError'
import { Modal } from '@/shared/components/Modal'
import { NoticeCard } from '@/shared/components/NoticeCard'
import { SearchField } from '@/shared/components/SearchField'
import { TableSkeleton } from '@/shared/components/TableSkeleton'
import { useCan } from '@/shared/hooks/useCan'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { matchesSearch } from '@/shared/lib/text'

/** Iniciales para el avatar sin foto, como el «MS» del Pool. */
function initialsOf(fullName: string): string {
  return fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase()
}

/** El `i18n` viene del componente (`useLingui`): así el mensaje habla el idioma activo (D-36). */
function mailboxErrorMessage(error: unknown, i18n: I18n): string {
  return apiErrorMessage(error, {
    byCode: {
      NO_CORPORATE_EMAIL: i18n._(
        msg`Este colaborador no tiene un correo @oranjepeople.com asignado todavía.`,
      ),
      CPANEL_ERROR: (info) => info.message ?? i18n._(msg`cPanel rechazó la operación.`),
    },
    fallback: i18n._(msg`No se pudo completar la operación. Inténtalo de nuevo.`),
  })
}

export function CorporateEmailPage(): ReactNode {
  const { t, i18n } = useLingui()
  const can = useCan()
  const canManage = can('users:manage_corporate_email')

  const { data: rows, isLoading, isError, refetch } = useGetCorporateEmailsQuery()
  const [createMailbox, { isLoading: isCreating }] = useCreateMailboxMutation()
  const [resetPassword, { isLoading: isResetting }] = useResetMailboxPasswordMutation()
  const [deleteMailbox, { isLoading: isDeleting }] = useDeleteMailboxMutation()

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)
  const [revealed, setRevealed] = useState<{ email: string; password: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CorporateEmailRow | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyWorkerId, setBusyWorkerId] = useState<string | null>(null)

  const filtered = useMemo(
    () => (rows ?? []).filter((row) => matchesSearch(debouncedSearch, row.workerName)),
    [rows, debouncedSearch],
  )
  const withMailbox = (rows ?? []).filter((row) => row.mailboxExists).length

  async function handleCreate(row: CorporateEmailRow): Promise<void> {
    setActionError(null)
    setBusyWorkerId(row.workerId)
    try {
      const credential = await createMailbox(row.workerId).unwrap()
      setRevealed(credential)
      toast.success(t`Buzón creado: ${credential.email}`)
    } catch (error) {
      setActionError(mailboxErrorMessage(error, i18n))
    } finally {
      setBusyWorkerId(null)
    }
  }

  async function handleReset(row: CorporateEmailRow): Promise<void> {
    setActionError(null)
    setBusyWorkerId(row.workerId)
    try {
      const credential = await resetPassword(row.workerId).unwrap()
      setRevealed(credential)
    } catch (error) {
      setActionError(mailboxErrorMessage(error, i18n))
    } finally {
      setBusyWorkerId(null)
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!deleteTarget) return
    setActionError(null)
    try {
      await deleteMailbox(deleteTarget.workerId).unwrap()
      toast.success(t`Buzón eliminado`)
      setDeleteTarget(null)
    } catch (error) {
      setActionError(mailboxErrorMessage(error, i18n))
    }
  }

  async function copyPassword(): Promise<void> {
    if (!revealed) return
    try {
      await navigator.clipboard.writeText(revealed.password)
      toast.success(t`Contraseña copiada`)
    } catch {
      /* Sin permiso de portapapeles: la contraseña sigue visible en pantalla. */
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-ink">
            <Trans>Correos corporativos</Trans>
          </h1>
          <p className="mt-1 text-sm text-ink-3">
            {IS_DEV_UI ? (
              'users:manage_corporate_email · cPanel UAPI (A2 Hosting) sobre identity.user.email'
            ) : (
              <Trans>El buzón real detrás del correo @oranjepeople.com de cada colaborador</Trans>
            )}
            {rows && (
              <>
                {' · '}
                <Trans>
                  {String(withMailbox)} de {String(rows.length)} con buzón
                </Trans>
              </>
            )}
          </p>
        </div>
        <SearchField
          value={search}
          onChange={setSearch}
          label={t`Buscar colaborador`}
          placeholder={t`Nombre del colaborador, p. ej. Ana Rivera…`}
        />
      </header>

      {!canManage && (
        <NoticeCard
          image={personajeConfiguracion}
          title={t`Esto es del Administrador`}
          role="status"
        >
          <Trans>
            Crear y gestionar buzones corporativos es una acción del sistema, reservada al
            Administrador.
          </Trans>
        </NoticeCard>
      )}

      {isError && (
        <LoadError
          message={t`No se pudo cargar la lista de correos corporativos.`}
          onRetry={() => {
            void refetch()
          }}
        />
      )}

      {actionError && (
        <p role="alert" className="rounded-md bg-red/10 px-4 py-3 text-sm text-red">
          {actionError}
        </p>
      )}

      {isLoading ? (
        <TableSkeleton rows={6} columns={4} />
      ) : (
        canManage && (
          <div className="overflow-x-auto rounded-lg border border-line">
            <Table className="min-w-[52rem] text-left">
              <TableHeader>
                <TableRow className="border-line">
                  <TableHead className="px-4 py-3 text-xs font-semibold text-ink-3">
                    <Trans>Colaborador</Trans>
                  </TableHead>
                  <TableHead className="px-4 py-3 text-xs font-semibold text-ink-3">
                    <Trans>Correo</Trans>
                  </TableHead>
                  <TableHead className="px-4 py-3 text-xs font-semibold text-ink-3">
                    <Trans>Buzón</Trans>
                  </TableHead>
                  <TableHead className="px-4 py-3 text-xs font-semibold text-ink-3">
                    <Trans>Acciones</Trans>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="px-4 py-8 text-center text-sm text-ink-3">
                      {search.trim() === '' ? (
                        <Trans>Nadie tiene correo corporativo asignado todavía.</Trans>
                      ) : (
                        <Trans>Nadie en la lista se llama «{search}».</Trans>
                      )}
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((row) => {
                  const isBusy = busyWorkerId === row.workerId && (isCreating || isResetting)
                  return (
                    <TableRow key={row.workerId} className="border-line">
                      <TableCell className="px-4 py-3 text-sm font-medium whitespace-nowrap text-ink">
                        <span className="flex items-center gap-3">
                          {row.photoUrl ? (
                            <img
                              src={row.photoUrl}
                              alt=""
                              className="size-9 shrink-0 rounded-full object-cover"
                            />
                          ) : (
                            <span
                              aria-hidden
                              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-o-50 text-xs font-bold text-o-700"
                            >
                              {initialsOf(row.workerName)}
                            </span>
                          )}
                          {row.workerName}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3 font-mono text-sm text-ink-2">
                        {row.email}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <span
                          className={
                            row.mailboxExists
                              ? 'inline-flex items-center gap-1.5 rounded-full bg-green/15 px-2.5 py-1 text-xs font-medium text-green'
                              : 'inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink-3'
                          }
                        >
                          <MaterialIcon
                            name={row.mailboxExists ? 'mail' : 'mail_outline'}
                            className="text-sm"
                            aria-hidden
                          />
                          {row.mailboxExists ? <Trans>Creado</Trans> : <Trans>Sin crear</Trans>}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {!row.mailboxExists && (
                            <Button
                              variant="primary"
                              disabled={isBusy}
                              onClick={() => {
                                void handleCreate(row)
                              }}
                            >
                              {isBusy ? <Trans>Creando…</Trans> : <Trans>Crear buzón</Trans>}
                            </Button>
                          )}
                          {row.mailboxExists && (
                            <>
                              <Button
                                disabled={isBusy}
                                onClick={() => {
                                  void handleReset(row)
                                }}
                              >
                                {isBusy ? (
                                  <Trans>Reseteando…</Trans>
                                ) : (
                                  <Trans>Resetear contraseña</Trans>
                                )}
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() => {
                                  setActionError(null)
                                  setDeleteTarget(row)
                                }}
                              >
                                <Trans>Eliminar</Trans>
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )
      )}

      <Modal
        isOpen={revealed !== null}
        onClose={() => {
          setRevealed(null)
        }}
        title={t`Contraseña del buzón`}
        description={t`Se muestra una sola vez: cPanel no la vuelve a enseñar. Cópiala antes de cerrar.`}
      >
        {revealed && (
          <div className="flex flex-col gap-3">
            <p className="font-mono text-sm text-ink-3">{revealed.email}</p>
            <div className="flex items-center gap-2 rounded-md border border-line bg-surface-2 px-4 py-3">
              <code className="flex-1 font-mono text-base text-ink">{revealed.password}</code>
              <Button
                onClick={() => {
                  void copyPassword()
                }}
              >
                <Trans>Copiar</Trans>
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => {
          setDeleteTarget(null)
        }}
        title={t`Eliminar buzón`}
        description={t`Esto borra de verdad el buzón de ${deleteTarget?.email ?? ''} en cPanel — no se puede deshacer.`}
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setDeleteTarget(null)
              }}
            >
              <Trans>Cancelar</Trans>
            </Button>
            <Button
              variant="primary"
              disabled={isDeleting}
              onClick={() => {
                void confirmDelete()
              }}
            >
              {isDeleting ? <Trans>Eliminando…</Trans> : <Trans>Sí, eliminar buzón</Trans>}
            </Button>
          </div>
        }
      >
        <></>
      </Modal>
    </div>
  )
}
