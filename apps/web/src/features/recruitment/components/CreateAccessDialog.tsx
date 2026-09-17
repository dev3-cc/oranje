import { Trans, useLingui } from '@lingui/react/macro'
import { Alert, AlertDescription, Input, MaterialIcon, toast } from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import { useCreateWorkerAccessMutation, useGetAccessDomainQuery } from '../api/poolApi'
import type { WorkerAccessCredential } from '../types/pool.types'

import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { useCan } from '@/shared/hooks/useCan'
import { apiErrorMessage } from '@/shared/lib/apiError'

/**
 * El acceso del colaborador: su cuenta de Oranje y su buzón @oranjepeople.com,
 * con UNA contraseña temporal que se muestra aquí una sola vez y se entrega
 * en mano. Nada viaja por correo — el buzón al que llegaría es el que se está
 * creando (Reglas de Negocio § Acceso del Colaborador).
 *
 * El diálogo no se cierra solo: la contraseña no se vuelve a ver.
 */
export function CreateAccessDialog({
  isOpen,
  onClose,
  worker,
}: {
  isOpen: boolean
  onClose: () => void
  worker: { id: string; fullName: string } | null
}): ReactNode {
  const { t } = useLingui()
  const can = useCan()
  const { data: domain = '' } = useGetAccessDomainQuery(undefined, { skip: !isOpen })
  const [createAccess, { isLoading, isError, error }] = useCreateWorkerAccessMutation()
  const [localPart, setLocalPart] = useState('')
  const [credential, setCredential] = useState<WorkerAccessCredential | null>(null)

  useEffect(() => {
    if (!isOpen || !worker) return
    setLocalPart(proposeLocalPart(worker.fullName))
    setCredential(null)
  }, [isOpen, worker])

  const isValidLocalPart = /^[a-z0-9][a-z0-9._-]*[a-z0-9]$/.test(localPart)

  async function submit(): Promise<void> {
    if (!worker || !isValidLocalPart) return
    try {
      setCredential(await createAccess({ workerId: worker.id, localPart }).unwrap())
    } catch {
      return
    }
  }

  async function copy(text: string, done: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(done)
    } catch {
      /* Sin permiso de portapapeles: sigue visible en pantalla. */
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={credential ? t`Acceso creado` : t`Crear acceso`}
      description={
        credential
          ? t`La contraseña se muestra una sola vez. Dásela en mano a ${worker?.fullName ?? ''}.`
          : t`Su cuenta de Oranje y su correo corporativo, con una contraseña temporal para entregar en mano.`
      }
      footer={
        <div className="flex items-center justify-end gap-3">
          {credential ? (
            <Button variant="primary" onClick={onClose}>
              <Trans>Ya la anoté</Trans>
            </Button>
          ) : (
            <>
              {!isValidLocalPart && (
                <span className="mr-auto text-xs text-ink-3">
                  <Trans>Solo letras, números, punto y guión</Trans>
                </span>
              )}
              <Button variant="secondary" onClick={onClose} disabled={isLoading}>
                <Trans>Cancelar</Trans>
              </Button>
              <Button
                variant="primary"
                disabled={!isValidLocalPart || isLoading}
                onClick={() => {
                  void submit()
                }}
              >
                {isLoading ? t`Creando…` : t`Crear acceso`}
              </Button>
            </>
          )}
        </div>
      }
    >
      {credential ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-3">
              <Trans>Correo</Trans>
            </span>
            <div className="flex items-center gap-2 rounded-md border border-line bg-surface-2 px-4 py-3">
              <code className="flex-1 font-mono text-sm text-ink">{credential.email}</code>
              <Button
                onClick={() => {
                  void copy(credential.email, t`Correo copiado`)
                }}
              >
                <Trans>Copiar</Trans>
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-3">
              <Trans>Contraseña temporal</Trans>
            </span>
            <div className="flex items-center gap-2 rounded-md border border-line bg-surface-2 px-4 py-3">
              <code className="flex-1 font-mono text-base text-ink">{credential.password}</code>
              <Button
                onClick={() => {
                  void copy(credential.password, t`Contraseña copiada`)
                }}
              >
                <Trans>Copiar</Trans>
              </Button>
            </div>
            <p className="text-xs text-ink-3">
              <Trans>
                Sirve para entrar a la app y para el correo. Tiene 3 días para cambiarla desde su
                app; si no, su acceso se bloquea hasta que lo haga.
              </Trans>
            </p>
          </div>

          {credential.mailbox.created ? (
            <p className="flex items-center gap-2 text-sm text-ink-2">
              <MaterialIcon name="mark_email_read" className="text-lg text-green" aria-hidden />
              <Trans>El buzón de correo quedó listo con la misma contraseña.</Trans>
            </p>
          ) : (
            <Alert>
              <AlertDescription>
                <Trans>
                  La cuenta de Oranje ya existe, pero el buzón de correo no se pudo crear:{' '}
                  {credential.mailbox.reason}.
                </Trans>{' '}
                {can('users:manage_corporate_email') ? (
                  <Trans>
                    Créalo desde{' '}
                    <Link to="/corporate-emails" className="font-semibold underline">
                      Correos corporativos
                    </Link>
                    .
                  </Trans>
                ) : (
                  <Trans>Pídele al Administrador que lo cree desde Correos corporativos.</Trans>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-3">
              <Trans>Correo corporativo</Trans>
            </span>
            <div className="flex items-center gap-2">
              <Input
                value={localPart}
                onChange={(event) => {
                  setLocalPart(event.target.value.toLowerCase().trim())
                }}
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
              />
              <span className="shrink-0 font-mono text-sm text-ink-3">@{domain}</span>
            </div>
            <span className="text-xs text-ink-4">
              <Trans>Propuesto con la inicial y el apellido; cámbialo si ya existe.</Trans>
            </span>
          </label>

          <p className="rounded-md bg-surface-2 px-4 py-3 text-sm text-ink-2">
            <Trans>
              Con este correo entra a la app y revisa su buzón. La contraseña la genera el sistema y
              la verás una sola vez: anótala y dásela en persona, no por correo.
            </Trans>
          </p>

          {isError && (
            <Alert variant="destructive">
              <AlertDescription>
                {apiErrorMessage(error, {
                  byCode: {
                    EMAIL_TAKEN: t`Ese correo ya está en uso: prueba otro.`,
                    ACCESS_ALREADY_CREATED: t`Este colaborador ya tiene acceso.`,
                    FIREBASE_UNAVAILABLE: t`No se pudo crear la cuenta. Inténtalo de nuevo.`,
                  },
                  fallback: t`No se pudo crear el acceso. Inténtalo de nuevo.`,
                })}
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </Modal>
  )
}

/**
 * `Adam Mahmud` → `amahmud`; `María José Pérez López` → `mperez`. Sin acentos
 * ni espacios, que es lo que cPanel acepta sin pelear; la Reclutadora lo
 * corrige si choca con uno existente.
 */
export function proposeLocalPart(fullName: string): string {
  const parts = fullName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.replace(/[^a-z0-9]/g, ''))
    .filter((part) => part !== '')

  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0] as string

  // Con tres o más palabras, el apellido es la penúltima («María José Pérez
  // López» → pérez); con dos, la última.
  const surname =
    parts.length >= 4 ? (parts[parts.length - 2] as string) : (parts[parts.length - 1] as string)

  return `${(parts[0] as string).charAt(0)}${surname}`
}
