import { Trans, useLingui } from '@lingui/react/macro'
import { Checkbox, Input, toast } from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'

import { useUpdateContractMutation } from '../api/contractsApi'
import type { ContractDetail } from '../types/contract.types'

import { Button } from '@/shared/components/Button'
import { DateField } from '@/shared/components/DateField'
import { Modal } from '@/shared/components/Modal'
import { apiErrorMessage } from '@/shared/lib/apiError'

const MULTIPLIER_PATTERN = /^\d+(\.\d{1,2})?$/

function isValidMultiplier(value: string): boolean {
  return MULTIPLIER_PATTERN.test(value) && Number(value) >= 1 && Number(value) <= 5
}

/**
 * Edita los términos ya pactados de un contrato ya creado (Hugo,
 * 2026-10-16): el BDC lo sigue tocando después de nacido, en Borrador y
 * también ya ACTIVO — lo ya pagado está a salvo porque la nómina copia la
 * tarifa vigente al generarse, nunca la lee en vivo. El corte semanal y el
 * recargo de overtime que paga Oranje NO viajan aquí: se heredan del hotel.
 */
export function EditContractDialog({
  contract,
  isOpen,
  onClose,
}: {
  contract: ContractDetail
  isOpen: boolean
  onClose: () => void
}): ReactNode {
  const { t } = useLingui()
  const [updateContract, { isLoading, isError, error }] = useUpdateContractMutation()

  const [validTo, setValidTo] = useState('')
  const [overtimeBill, setOvertimeBill] = useState('')
  const [holidayBill, setHolidayBill] = useState('')
  const [holidayPay, setHolidayPay] = useState('')
  const [deductsMeals, setDeductsMeals] = useState(false)
  const [splitsInvoiceByMonth, setSplitsInvoiceByMonth] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setValidTo(contract.validTo ?? '')
    setOvertimeBill(contract.multipliers.overtime.bill.toFixed(2))
    setHolidayBill(contract.multipliers.holiday.bill.toFixed(2))
    setHolidayPay(contract.multipliers.holiday.pay.toFixed(2))
    setDeductsMeals(contract.deductsMeals)
    setSplitsInvoiceByMonth(contract.splitsInvoiceByMonth)
  }, [isOpen, contract])

  const canSubmit =
    !isLoading &&
    isValidMultiplier(overtimeBill) &&
    isValidMultiplier(holidayBill) &&
    isValidMultiplier(holidayPay)

  async function submit(): Promise<void> {
    if (!canSubmit) return
    try {
      await updateContract({
        contractId: contract.id,
        validTo: validTo === '' ? null : validTo,
        overtimeBillMultiplier: Number(overtimeBill),
        holidayBillMultiplier: Number(holidayBill),
        holidayPayMultiplier: Number(holidayPay),
        deductsMeals,
        splitsInvoiceByMonth,
      }).unwrap()
      toast.success(t`Contrato actualizado`)
      onClose()
    } catch {
      return
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t`Editar contrato`} className="max-w-lg">
      <div className="flex flex-col gap-4">
        {isError && (
          <p role="alert" className="text-sm text-red">
            {apiErrorMessage(error, {
              byCode: {
                CONTRACT_CLOSED: t`Este contrato ya está cerrado: no admite más cambios.`,
                VALIDITY_BACKWARDS: t`La fecha de fin tiene que ser posterior al inicio.`,
                OVERTIME_MARGIN_NEGATIVE: t`El hotel no puede pagar menos recargo de overtime que el colaborador.`,
                HOLIDAY_MARGIN_NEGATIVE: t`El hotel no puede pagar menos recargo de festivo que el colaborador.`,
              },
              fallback: t`No se pudo guardar el contrato. Inténtalo de nuevo.`,
            })}
          </p>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink-2">
            <Trans>Vigente hasta (opcional)</Trans>
          </span>
          <DateField
            value={validTo}
            onChange={setValidTo}
            min={contract.validFrom}
            aria-label={t`Vigente hasta`}
          />
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-3">
              <Trans>Overtime · factura</Trans>
            </span>
            <Input
              inputMode="decimal"
              value={overtimeBill}
              onChange={(event) => {
                setOvertimeBill(event.target.value)
              }}
              aria-label={t`Multiplicador de overtime facturado`}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-3">
              <Trans>Festivo · factura</Trans>
            </span>
            <Input
              inputMode="decimal"
              value={holidayBill}
              onChange={(event) => {
                setHolidayBill(event.target.value)
              }}
              aria-label={t`Multiplicador de festivo facturado`}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-3">
              <Trans>Festivo · pago</Trans>
            </span>
            <Input
              inputMode="decimal"
              value={holidayPay}
              onChange={(event) => {
                setHolidayPay(event.target.value)
              }}
              aria-label={t`Multiplicador de festivo pagado`}
            />
          </label>
        </div>

        <label className="flex items-center gap-2.5">
          <Checkbox
            checked={deductsMeals}
            onCheckedChange={(checked) => setDeductsMeals(checked === true)}
          />
          <span className="text-sm text-ink-2">
            <Trans>Deduce comida (3 USD por día laborado)</Trans>
          </span>
        </label>

        <label className="flex items-center gap-2.5">
          <Checkbox
            checked={splitsInvoiceByMonth}
            onCheckedChange={(checked) => setSplitsInvoiceByMonth(checked === true)}
          />
          <span className="text-sm text-ink-2">
            <Trans>Factura partida por mes cuando una semana cruza dos meses</Trans>
          </span>
        </label>

        <div className="flex justify-end gap-3 border-t border-line pt-4">
          <Button variant="secondary" onClick={onClose}>
            <Trans>Cancelar</Trans>
          </Button>
          <Button
            variant="primary"
            disabled={!canSubmit}
            onClick={() => {
              void submit()
            }}
          >
            {isLoading ? <Trans>Guardando…</Trans> : <Trans>Guardar cambios</Trans>}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
