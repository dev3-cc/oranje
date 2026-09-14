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

function mailboxErrorMessage(error: unknown): string {
  return apiErrorMessage(error, {
    byCode: {
      NO_CORPORATE_EMAIL: 'Este colaborador no tiene un correo @oranjepeople.com asignado todavía.',
      CPANEL_ERROR: (info) => info.message ?? 'cPanel rechazó la operación.',
    },
    fallback: 'No se pudo completar la operación. Inténtalo de nuevo.',
  })
}

export function CorporateEmailPage(): ReactNode {
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
      toast.success(`Buzón creado: ${credential.email}`)
    } catch (error) {
      setActionError(mailboxErrorMessage(error))
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
      setActionError(mailboxErrorMessage(error))
    } finally {
      setBusyWorkerId(null)
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!deleteTarget) return
    setActionError(null)
    try {
      await deleteMailbox(deleteTarget.workerId).unwrap()
      toast.success('Buzón eliminado')
      setDeleteTarget(null)
    } catch (error) {
      setActionError(mailboxErrorMessage(error))
    }
  }

  async function copyPassword(): Promise<void> {
    if (!revealed) return
    try {
      await navigator.clipboard.writeText(revealed.password)
      toast.success('Contraseña copiada')
    } catch {
      /* Sin permiso de portapapeles: la contraseña sigue visible en pantalla. */
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-ink">Correos corporativos</h1>
          <p className="mt-1 text-sm text-ink-3">
            {IS_DEV_UI
              ? 'users:manage_corporate_email · cPanel UAPI (A2 Hosting) sobre identity.user.email'
              : 'El buzón real detrás del correo @oranjepeople.com de cada colaborador'}
            {rows && ` · ${String(withMailbox)} de ${String(rows.length)} con buzón`}
          </p>
        </div>
        <SearchField
          value={search}
          onChange={setSearch}
          label="Buscar colaborador"
          placeholder="Nombre del colaborador, p. ej. Ana Rivera…"
        />
      </header>

      {!canManage && (
        <NoticeCard image={personajeConfiguracion} title="Esto es del Administrador" role="status">
          Crear y gestionar buzones corporativos es una acción del sistema, reservada al
          Administrador.
        </NoticeCard>
      )}

      {isError && (
        <LoadError
          message="No se pudo cargar la lista de correos corporativos."
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
                    Colaborador
                  </TableHead>
                  <TableHead className="px-4 py-3 text-xs font-semibold text-ink-3">
                    Correo
                  </TableHead>
                  <TableHead className="px-4 py-3 text-xs font-semibold text-ink-3">
                    Buzón
                  </TableHead>
                  <TableHead className="px-4 py-3 text-xs font-semibold text-ink-3">
                    Acciones
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="px-4 py-8 text-center text-sm text-ink-3">
                      {search.trim() === ''
                        ? 'Nadie tiene correo corporativo asignado todavía.'
                        : `Nadie en la lista se llama «${search}».`}
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
                          {row.mailboxExists ? 'Creado' : 'Sin crear'}
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
                              {isBusy ? 'Creando…' : 'Crear buzón'}
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
                                {isBusy ? 'Reseteando…' : 'Resetear contraseña'}
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() => {
                                  setActionError(null)
                                  setDeleteTarget(row)
                                }}
                              >
                                Eliminar
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
        title="Contraseña del buzón"
        description="Se muestra una sola vez: cPanel no la vuelve a enseñar. Cópiala antes de cerrar."
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
                Copiar
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
        title="Eliminar buzón"
        description={`Esto borra de verdad el buzón de ${deleteTarget?.email ?? ''} en cPanel — no se puede deshacer.`}
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setDeleteTarget(null)
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              disabled={isDeleting}
              onClick={() => {
                void confirmDelete()
              }}
            >
              {isDeleting ? 'Eliminando…' : 'Sí, eliminar buzón'}
            </Button>
          </div>
        }
      >
        <></>
      </Modal>
    </div>
  )
}
