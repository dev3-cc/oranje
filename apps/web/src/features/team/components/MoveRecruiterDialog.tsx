import { Trans, useLingui } from '@lingui/react/macro'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, toast } from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'

import { useMoveRecruiterMutation } from '../api/recruitmentTeamApi'

import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { apiErrorMessage } from '@/shared/lib/apiError'
import type { RecruitmentTeamMemberApi } from '@/shared/types/apiContract.types'

/** A dónde puede ir una Reclutadora: con una Líder del equipo o directo con la Manager. */
export interface TeamLeadOption {
  id: string
  label: string
}

/**
 * Cambiar a una Reclutadora de grupo. El diálogo ES la confirmación: elegir el
 * destino y pulsar el botón, que dice a quién va. Mover avisa a la persona y a
 * su nueva Líder, así que no puede pasar de un clic suelto.
 */
export function MoveRecruiterDialog({
  member,
  options,
  onClose,
}: {
  member: RecruitmentTeamMemberApi | null
  options: TeamLeadOption[]
  onClose: () => void
}): ReactNode {
  const { t } = useLingui()
  const [targetId, setTargetId] = useState('')
  const [moveRecruiter, { isLoading }] = useMoveRecruiterMutation()

  useEffect(() => {
    setTargetId('')
  }, [member?.id])

  if (!member) return null

  const choices = options.filter((option) => option.id !== member.reportsTo?.id)
  const target = choices.find((option) => option.id === targetId)

  const confirm = async (): Promise<void> => {
    if (!target) return
    try {
      await moveRecruiter({ memberId: member.id, reportsToUserId: target.id }).unwrap()
      toast.success(t`${member.fullName} ahora reporta a ${target.label}.`)
      onClose()
    } catch (error) {
      toast.error(
        apiErrorMessage(error, {
          byCode: {
            MEMBER_NOT_IN_TEAM: t`Esa Reclutadora ya no está en tu equipo. Recarga la página para ver tu equipo actual.`,
            INVALID_TEAM_LEAD: t`Solo puedes moverla con una Líder de tu equipo o contigo.`,
          },
          fallback: t`No se pudo mover. Reintenta en unos segundos.`,
        }),
      )
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t`Cambiar de Líder a ${member.fullName}`}
      description={t`Avisamos a la persona y a quien quede como su Líder. Sus requisiciones y colaboradores no cambian.`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            <Trans>Cancelar</Trans>
          </Button>
          <Button
            variant="primary"
            disabled={!target || isLoading}
            onClick={() => {
              void confirm()
            }}
          >
            {target ? t`Mover con ${target.label}` : t`Elige a quién`}
          </Button>
        </div>
      }
    >
      {choices.length === 0 ? (
        <p className="text-sm text-ink-3">
          <Trans>
            No hay otra Líder en tu equipo a la cual moverla. Cuando des de alta a una Líder y te
            reporte, aparecerá aquí.
          </Trans>
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <label htmlFor="move-recruiter-target" className="text-sm font-medium text-ink-2">
            <Trans>Pasa a reportar a</Trans>
          </label>
          <Select value={targetId} onValueChange={setTargetId}>
            <SelectTrigger
              id="move-recruiter-target"
              aria-label={t`Pasa a reportar a`}
              className="w-full"
            >
              <SelectValue placeholder={t`Elige una Líder o «Directo contigo»`} />
            </SelectTrigger>
            <SelectContent>
              {choices.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {member.reportsTo && (
            <p className="text-xs text-ink-3">
              <Trans>Hoy reporta a {member.reportsTo.fullName}.</Trans>
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
