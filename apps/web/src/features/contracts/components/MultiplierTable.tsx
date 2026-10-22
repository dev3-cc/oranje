import { Trans, useLingui } from '@lingui/react/macro'
import {
  Checkbox,
  Input,
  MaterialIcon,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
} from '@oranje/ui'
import { useState, type ReactNode } from 'react'

import { useUpdateContractMutation } from '../api/contractsApi'
import type { ContractMultiplier } from '../types/contract.types'
import { marginOf } from '../utils/validity'

import { Button } from '@/shared/components/Button'
import { SectionCard } from '@/shared/components/SectionCard'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { IS_DEV_UI } from '@/shared/lib/devMode'

const MULTIPLIER_PATTERN = /^\d+(\.\d{1,2})?$/
const MONEY_PATTERN = /^\d{1,6}(\.\d{1,2})?$/

function isValidMultiplier(value: string): boolean {
  return MULTIPLIER_PATTERN.test(value) && Number(value) >= 1 && Number(value) <= 5
}

/** 0 es válido a propósito: es "no se descuenta" (Hugo, 2026-10-21). */
function isValidMoney(value: string): boolean {
  return MONEY_PATTERN.test(value)
}

/** Lee el borrador si es un número válido; si no, el valor ya guardado — el margen nunca se rompe mientras se teclea. */
function draftOrSaved(draft: string, saved: number): number {
  return isValidMultiplier(draft) ? Number(draft) : saved
}

function formatMultiplier(value: number): string {
  return `${value.toFixed(2)} ×`
}

function formatMargin(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`
}

/**
 * Multiplicadores, comida y factura partida: términos del contrato que antes
 * se editaban en el modal «Editar contrato». Lápiz en el encabezado, igual
 * que «Datos del documento» y «Vigencia» — el mismo espacio pasa de mostrar
 * el dato a mostrar su input, sin modal (Hugo, 2026-10-20).
 */
export function MultiplierTable({
  contractId,
  overtime,
  holiday,
  mealDeductionAmount,
  splitsInvoiceByMonth,
  canEdit,
}: {
  contractId: string
  overtime: ContractMultiplier
  holiday: ContractMultiplier
  /** 0 = no se descuenta. */
  mealDeductionAmount: number
  splitsInvoiceByMonth: boolean
  /** Sin `terms_and_conditions:update` o con el contrato cerrado: sin lápiz, solo lectura. */
  canEdit: boolean
}): ReactNode {
  const { t } = useLingui()
  const [updateContract, { isLoading, isError, error }] = useUpdateContractMutation()
  const [isEditing, setIsEditing] = useState(false)
  const [overtimeBill, setOvertimeBill] = useState('')
  const [holidayBill, setHolidayBill] = useState('')
  const [holidayPay, setHolidayPay] = useState('')
  /** Si se deduce o no — controla el input, no reemplaza el monto (Hugo,
      2026-10-21): desmarcado manda 0.00, marcado manda lo que haya en
      `mealAmountDraft`. */
  const [mealChecked, setMealChecked] = useState(false)
  const [mealAmountDraft, setMealAmountDraft] = useState('')
  const [splitsDraft, setSplitsDraft] = useState(false)

  const canSubmit =
    !isLoading &&
    isValidMultiplier(overtimeBill) &&
    isValidMultiplier(holidayBill) &&
    isValidMultiplier(holidayPay) &&
    (!mealChecked || isValidMoney(mealAmountDraft))

  /** Siempre parte de lo ya guardado: nunca retoma un intento a medias previo. */
  function startEditing(): void {
    setOvertimeBill(overtime.bill.toFixed(2))
    setHolidayBill(holiday.bill.toFixed(2))
    setHolidayPay(holiday.pay.toFixed(2))
    setMealChecked(mealDeductionAmount > 0)
    // Si ya tenía monto se respeta; si no, 3.00 de arranque — el input no
    // nace en blanco al marcar la casilla (Hugo, 2026-10-21).
    setMealAmountDraft(mealDeductionAmount > 0 ? mealDeductionAmount.toFixed(2) : '3.00')
    setSplitsDraft(splitsInvoiceByMonth)
    setIsEditing(true)
  }

  async function save(): Promise<void> {
    if (!canSubmit) return
    try {
      await updateContract({
        contractId,
        overtimeBillMultiplier: Number(overtimeBill),
        holidayBillMultiplier: Number(holidayBill),
        holidayPayMultiplier: Number(holidayPay),
        mealDeductionAmount: mealChecked ? mealAmountDraft : '0.00',
        splitsInvoiceByMonth: splitsDraft,
      }).unwrap()
      toast.success(t`Multiplicadores actualizados`)
      setIsEditing(false)
    } catch {
      return
    }
  }

  return (
    <SectionCard
      title={t`Multiplicadores`}
      subtitle={
        IS_DEV_UI
          ? 'los cuatro son NOT NULL y ninguno puede bajar de 1.00'
          : t`Overtime y día festivo según el contrato (mínimo 1.00×)`
      }
      action={
        canEdit ? (
          <button
            type="button"
            aria-pressed={isEditing}
            aria-label={
              isEditing ? t`Cancelar edición de multiplicadores` : t`Editar multiplicadores`
            }
            onClick={() => {
              if (isEditing) {
                setIsEditing(false)
              } else {
                startEditing()
              }
            }}
            className="shrink-0 rounded-md p-1.5 text-ink-3 hover:bg-o-50 hover:text-o-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
          >
            <MaterialIcon name={isEditing ? 'close' : 'edit'} aria-hidden className="text-lg" />
          </button>
        ) : undefined
      }
    >
      {isError && (
        <p role="alert" className="mb-4 text-sm text-red">
          {apiErrorMessage(error, {
            byCode: {
              CONTRACT_CLOSED: t`Este contrato ya está cerrado: no admite más cambios.`,
              OVERTIME_MARGIN_NEGATIVE: t`El hotel no puede pagar menos recargo de overtime que el colaborador.`,
              HOLIDAY_MARGIN_NEGATIVE: t`El hotel no puede pagar menos recargo de festivo que el colaborador.`,
            },
            fallback: t`No se pudo guardar. Inténtalo de nuevo.`,
          })}
        </p>
      )}

      <Table className="min-w-[34rem] text-left">
        <TableHeader>
          <TableRow className="border-line">
            <TableHead scope="col" className="py-3 pr-4 text-sm font-normal text-ink-3">
              <span className="sr-only">
                <Trans>Concepto</Trans>
              </span>
            </TableHead>
            <TableHead scope="col" className="px-4 py-3 text-sm font-normal text-ink-3">
              <Trans>Se le paga al colaborador</Trans>
            </TableHead>
            <TableHead scope="col" className="px-4 py-3 text-sm font-normal text-ink-3">
              <Trans>Se le factura al hotel</Trans>
            </TableHead>
            <TableHead scope="col" className="px-4 py-3 text-sm font-normal text-ink-3">
              <Trans>Margen</Trans>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="border-line">
            <TableHead scope="row" className="py-5 pr-4 text-left text-base font-semibold text-ink">
              <Trans>Overtime</Trans>
            </TableHead>
            {/* El pago al colaborador no es del contrato: lo hereda del hotel y no se toca aquí. */}
            <TableCell className="px-4 py-5 text-base font-bold text-ink">
              {formatMultiplier(overtime.pay)}
            </TableCell>
            <TableCell className="px-4 py-5 text-base font-bold text-o-700">
              {isEditing ? (
                <Input
                  inputMode="decimal"
                  value={overtimeBill}
                  onChange={(event) => {
                    setOvertimeBill(event.target.value)
                  }}
                  aria-label={t`Multiplicador de overtime facturado`}
                  autoFocus
                  className="w-24"
                />
              ) : (
                formatMultiplier(overtime.bill)
              )}
            </TableCell>
            <TableCell className="px-4 py-5">
              <span className="inline-flex rounded-full bg-green/15 px-3 py-1.5 text-sm font-medium text-ink-2">
                {formatMargin(marginOf(overtime.pay, draftOrSaved(overtimeBill, overtime.bill)))}
              </span>
            </TableCell>
          </TableRow>
          <TableRow className="border-line">
            <TableHead scope="row" className="py-5 pr-4 text-left text-base font-semibold text-ink">
              <Trans>Día festivo</Trans>
            </TableHead>
            <TableCell className="px-4 py-5 text-base font-bold text-ink">
              {isEditing ? (
                <Input
                  inputMode="decimal"
                  value={holidayPay}
                  onChange={(event) => {
                    setHolidayPay(event.target.value)
                  }}
                  aria-label={t`Multiplicador de festivo pagado`}
                  className="w-24"
                />
              ) : (
                formatMultiplier(holiday.pay)
              )}
            </TableCell>
            <TableCell className="px-4 py-5 text-base font-bold text-o-700">
              {isEditing ? (
                <Input
                  inputMode="decimal"
                  value={holidayBill}
                  onChange={(event) => {
                    setHolidayBill(event.target.value)
                  }}
                  aria-label={t`Multiplicador de festivo facturado`}
                  className="w-24"
                />
              ) : (
                formatMultiplier(holiday.bill)
              )}
            </TableCell>
            <TableCell className="px-4 py-5">
              <span className="inline-flex rounded-full bg-green/15 px-3 py-1.5 text-sm font-medium text-ink-2">
                {formatMargin(
                  marginOf(
                    draftOrSaved(holidayPay, holiday.pay),
                    draftOrSaved(holidayBill, holiday.bill),
                  ),
                )}
              </span>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      {/* «Factura partida por mes» se oculta a propósito (Hugo, 2026-10-21):
          hoy no dispara nada, no se usa ni de lejos, así que no se le ofrece
          a nadie. El dato sigue viajando tal cual en cada guardado, por si
          hace falta de vuelta: solo se le quitó el control para cambiarlo.
          «Comida» tiene los dos controles (Hugo, 2026-10-21): la casilla
          prende/apaga, el input es el monto real cuando está prendida —
          antes el monto ("3 USD") estaba fijo en el texto, ahora se guarda
          de verdad. Desmarcada manda 0.00, mismo significado que el
          booleano de antes. */}
      <dl className="mt-4 border-t border-line pt-4">
        <div>
          <dt className="text-sm text-ink-3">
            <Trans>Comida</Trans>
          </dt>
          <dd className="mt-1.5">
            {isEditing ? (
              <div className="flex flex-col gap-2.5">
                <label className="flex items-center gap-2.5">
                  <Checkbox
                    checked={mealChecked}
                    onCheckedChange={(checked) => {
                      const isChecked = checked === true
                      setMealChecked(isChecked)
                      // No nace en blanco al marcar: si no había monto
                      // previo, arranca en 3.00 (Hugo, 2026-10-21).
                      if (isChecked && (mealAmountDraft === '' || Number(mealAmountDraft) === 0)) {
                        setMealAmountDraft('3.00')
                      }
                    }}
                  />
                  <span className="text-sm text-ink-2">
                    <Trans>Deduce comida</Trans>
                  </span>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm text-ink-2">
                    <Trans>Monto por día laborado (USD)</Trans>
                  </span>
                  <Input
                    inputMode="decimal"
                    value={mealAmountDraft}
                    onChange={(event) => {
                      setMealAmountDraft(event.target.value)
                    }}
                    disabled={!mealChecked}
                    placeholder="3.00"
                    aria-label={t`Monto de comida por día laborado`}
                    className="w-24"
                  />
                </label>
              </div>
            ) : (
              <span className="text-sm font-semibold text-ink">
                {mealDeductionAmount > 0 ? (
                  <Trans>Se descuenta, {mealDeductionAmount.toFixed(2)} USD por día laborado</Trans>
                ) : (
                  <Trans>No se descuenta</Trans>
                )}
              </span>
            )}
          </dd>
        </div>
      </dl>

      {isEditing && (
        <div className="mt-4 flex justify-end gap-3 border-t border-line pt-4">
          <Button
            variant="secondary"
            onClick={() => {
              setIsEditing(false)
            }}
          >
            <Trans>Cancelar</Trans>
          </Button>
          <Button
            variant="primary"
            disabled={!canSubmit}
            onClick={() => {
              void save()
            }}
          >
            {isLoading ? <Trans>Guardando…</Trans> : <Trans>Guardar cambios</Trans>}
          </Button>
        </div>
      )}
    </SectionCard>
  )
}
