import { Trans, useLingui } from '@lingui/react/macro'
import { MaterialIcon, toast } from '@oranje/ui'
import { useState, type ReactNode } from 'react'

import { useApproveTimesheetMutation, useSubmitTimesheetMutation } from '../api/timesheetApi'
import type { TimesheetRow } from '../types/timesheet.types'

import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { useCan } from '@/shared/hooks/useCan'

/**
 * Aprueba de un golpe todas las semanas elegibles de la lista visible — Hugo,
 * 2026-10-12. Elegible = sin anomalías por resolver y no aprobada todavía;
 * una Abierta se manda y se aprueba en el mismo paso (herencia de D-09), una
 * ya Enviada a aprobación solo se aprueba. Mismo aviso de "se congela" que
 * la confirmación individual en `WeekActionBar`.
 */
export function BulkApproveButton({ rows }: { rows: TimesheetRow[] }): ReactNode {
  const { t } = useLingui()
  const can = useCan()
  const [submitSheet] = useSubmitTimesheetMutation()
  const [approveSheet] = useApproveTimesheetMutation()
  const [isConfirming, setIsConfirming] = useState(false)
  const [isRunning, setIsRunning] = useState(false)

  const canApprove = can('timesheet:approve_hours')
  const eligible = rows.filter(
    (row) =>
      row.weekStatus !== 'APPROVED' &&
      (row.weekStatus !== 'OPEN' || row.entries.every((entry) => !entry.hasAnomaly)),
  )

  if (!canApprove || eligible.length === 0) return null

  async function approveAll(): Promise<void> {
    setIsRunning(true)
    setIsConfirming(false)
    let okCount = 0
    let failCount = 0
    for (const row of eligible) {
      try {
        if (row.weekStatus === 'OPEN') {
          await submitSheet(row.timesheetId).unwrap()
        }
        await approveSheet(row.timesheetId).unwrap()
        okCount += 1
      } catch {
        failCount += 1
      }
    }
    setIsRunning(false)
    if (failCount === 0) {
      toast.success(t`${okCount} semanas aprobadas`)
    } else {
      toast.error(
        t`${okCount} se aprobaron; ${failCount} no — algo cambió mientras tanto. Revísalas una por una.`,
      )
    }
  }

  return (
    <>
      {/* Vive junto a la lista porque actúa sobre TODA la lista, no sobre una
          persona — mezclarla con "Enviar/Aprobar" de la tabla (alcance de UN
          renglón) confundiría los dos alcances (Hugo, 2026-10-12, consultada
          la skill de UX). El ícono + la línea de apoyo son para que no se
          lea como decoración junto a las tarjetas de abajo. */}
      <div className="flex flex-col gap-1 rounded-lg border border-green/30 bg-green/5 p-2.5">
        <button
          type="button"
          disabled={isRunning}
          onClick={() => {
            setIsConfirming(true)
          }}
          className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md bg-green px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:bg-green/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500 disabled:cursor-wait disabled:opacity-60"
        >
          <MaterialIcon name="check_circle" className="text-base" aria-hidden />
          {isRunning ? t`Aprobando…` : t`Aprobar todas (${eligible.length})`}
        </button>
        <p className="px-0.5 text-center text-xs text-ink-3">
          <Trans>Semanas sin anomalías pendientes, listas para aprobar</Trans>
        </p>
      </div>

      {isConfirming && (
        <Modal
          isOpen
          onClose={() => {
            setIsConfirming(false)
          }}
          title={t`¿Aprobar ${eligible.length} semanas de un golpe?`}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setIsConfirming(false)
                }}
              >
                <Trans>Cancelar</Trans>
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  void approveAll()
                }}
              >
                <Trans>Sí, aprobarlas</Trans>
              </Button>
            </>
          }
        >
          <p className="text-sm text-ink-2">
            <Trans>
              El hotel ya no podrá editar estos días: ni marca manual ni corregir una marca. Si algo
              cambia después, contacta a Oranje.
            </Trans>
          </p>
        </Modal>
      )}
    </>
  )
}
