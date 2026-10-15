import type { I18n } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { Alert, AlertDescription, Input, toast } from '@oranje/ui'
import { useState, type ReactNode } from 'react'

import {
  useClearTimesheetPayOverrideMutation,
  useSetTimesheetPayOverrideMutation,
} from '../api/settlementApi'

import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { apiErrorMessage } from '@/shared/lib/apiError'

/** Lo mínimo que el diálogo necesita de la hoja que va a corregir. */
export interface PayOverrideTarget {
  timesheetId: string
  workerName: string
  /** Lo calculado hoy, para arrancar el formulario con esos valores. */
  regularMinutes: number
  overtimeMinutes: number
  payRate: string | null
  isOverridden: boolean
  overrideReason: string | null
}

function overrideErrorMessage(error: unknown, i18n: I18n): string {
  return apiErrorMessage(error, { fallback: i18n._(msg`No se pudo guardar la corrección.`) })
}

/**
 * Corrección de Contabilidad sobre la vista previa de pago (Hugo,
 * 2026-10-08): tarifa y reparto de horas. El monto no se edita directamente
 * — se recalcula siempre del resto, aquí y en la corrida real.
 */
/**
 * Monta uno por hoja: el `key={target.timesheetId}` del caller hace que un
 * cambio de objetivo remonte el formulario, así el estado inicial siempre
 * arranca de lo que esa hoja tiene hoy y nunca arrastra lo de la anterior.
 */
export function PayOverrideDialog({
  target,
  onClose,
}: {
  target: PayOverrideTarget | null
  onClose: () => void
}): ReactNode {
  const { t, i18n } = useLingui()
  const [regularHours, setRegularHours] = useState(() =>
    ((target?.regularMinutes ?? 0) / 60).toFixed(2),
  )
  const [overtimeHours, setOvertimeHours] = useState(() =>
    ((target?.overtimeMinutes ?? 0) / 60).toFixed(2),
  )
  const [payRate, setPayRate] = useState(() => target?.payRate ?? '')
  const [reason, setReason] = useState('')
  const [setOverride, { isLoading: isSaving, isError: isSaveError, error: saveError }] =
    useSetTimesheetPayOverrideMutation()
  const [clearOverride, { isLoading: isClearing }] = useClearTimesheetPayOverrideMutation()

  if (!target) return null

  const regular = Number(regularHours)
  const overtime = Number(overtimeHours)
  const rate = Number(payRate)
  const canSave =
    Number.isFinite(regular) &&
    regular >= 0 &&
    Number.isFinite(overtime) &&
    overtime >= 0 &&
    Number.isFinite(rate) &&
    rate > 0 &&
    reason.trim().length >= 4

  async function save(): Promise<void> {
    if (!target || !canSave) return
    try {
      await setOverride({
        id: target.timesheetId,
        regularMinutes: Math.round(regular * 60),
        overtimeMinutes: Math.round(overtime * 60),
        payRate: rate,
        reason: reason.trim(),
      }).unwrap()
      toast.success(t`Corrección guardada`)
      onClose()
    } catch {
      // El error se pinta abajo; el diálogo se queda abierto.
    }
  }

  async function clear(): Promise<void> {
    if (!target) return
    try {
      await clearOverride(target.timesheetId).unwrap()
      toast.success(t`Corrección eliminada — vuelve a lo calculado`)
      onClose()
    } catch {
      toast.error(t`No se pudo quitar la corrección.`)
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t`Corregir pago de ${target.workerName}`}
      className="max-w-lg"
      footer={
        <>
          <Button onClick={onClose} disabled={isSaving || isClearing}>
            <Trans>Cancelar</Trans>
          </Button>
          {target.isOverridden && (
            <Button
              variant="secondary"
              disabled={isSaving || isClearing}
              onClick={() => {
                void clear()
              }}
            >
              {isClearing ? t`Quitando…` : t`Quitar corrección`}
            </Button>
          )}
          <Button
            variant="primary"
            disabled={!canSave || isSaving || isClearing}
            onClick={() => {
              void save()
            }}
          >
            {isSaving ? t`Guardando…` : t`Guardar corrección`}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-3">
        <Trans>
          El multiplicador de horas extra no se corrige aquí — sigue siendo el del hotel. El monto
          se recalcula solo, con lo que escribas.
        </Trans>
      </p>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-3">
            <Trans>Horas regulares</Trans>
          </span>
          <Input
            inputMode="decimal"
            value={regularHours}
            onChange={(event) => {
              setRegularHours(event.target.value)
            }}
            aria-label={t`Horas regulares`}
          />
          {/* Mismo criterio que Motivo: si bloquea Guardar, se dice por qué
              — ninguno de los tres campos lo decía (Hugo, 2026-10-15:
              "revisa que esté controlado los mensajes que no dejen activar
              el botón"). */}
          {regularHours.trim().length > 0 && !(Number.isFinite(regular) && regular >= 0) && (
            <p className="text-xs text-red">
              <Trans>Un número válido, 0 o más.</Trans>
            </p>
          )}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-3">
            <Trans>Horas extra</Trans>
          </span>
          <Input
            inputMode="decimal"
            value={overtimeHours}
            onChange={(event) => {
              setOvertimeHours(event.target.value)
            }}
            aria-label={t`Horas extra`}
          />
          {overtimeHours.trim().length > 0 && !(Number.isFinite(overtime) && overtime >= 0) && (
            <p className="text-xs text-red">
              <Trans>Un número válido, 0 o más.</Trans>
            </p>
          )}
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-3">
          <Trans>Tarifa por hora</Trans>
        </span>
        <Input
          inputMode="decimal"
          placeholder="20.00"
          value={payRate}
          onChange={(event) => {
            setPayRate(event.target.value)
          }}
          aria-label={t`Tarifa por hora`}
        />
        {payRate.trim().length > 0 && !(Number.isFinite(rate) && rate > 0) && (
          <p className="text-xs text-red">
            <Trans>Un número mayor a 0.</Trans>
          </p>
        )}
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-3">
          <Trans>
            Motivo{' '}
            <span className="font-normal text-ink-4">(obligatorio, mínimo 4 caracteres)</span>
          </Trans>
        </span>
        <textarea
          value={reason}
          onChange={(event) => {
            setReason(event.target.value)
          }}
          rows={2}
          placeholder={t`Por qué se corrige — p. ej. «El contrato traía la tarifa vieja.»`}
          className="rounded-md border border-line bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-4 focus:border-o-500 focus:outline-none"
        />
        {/* Sin esto, "Guardar corrección" se quedaba apagado sin decir por
            qué — se veía como que no dejaba corregir (Hugo, 2026-10-15: "no
            deja corregir pago de Diego"); era el motivo demasiado corto
            ("ok", 2 letras), nunca un error del formulario. */}
        {reason.trim().length > 0 && reason.trim().length < 4 && (
          <p className="text-xs text-red">
            <Trans>Escribe al menos 4 caracteres para poder guardar.</Trans>
          </p>
        )}
      </label>

      {isSaveError && (
        <Alert variant="destructive">
          <AlertDescription>{overrideErrorMessage(saveError, i18n)}</AlertDescription>
        </Alert>
      )}
    </Modal>
  )
}
