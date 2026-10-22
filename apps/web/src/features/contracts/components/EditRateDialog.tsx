import { Trans, useLingui } from '@lingui/react/macro'
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'

import { useUpsertContractRateMutation } from '../api/contractsApi'
import type { ContractRate } from '../types/contract.types'

import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { apiErrorMessage } from '@/shared/lib/apiError'

const MONEY_PATTERN = /^\d{1,8}(\.\d{1,2})?$/

/**
 * Corrige UNA tarifa ya cotizada (`PUT /contracts/:id/rates`, el mismo
 * upsert): el selector solo ofrece las posiciones que el contrato YA trae —
 * las que se cotizaron en la propuesta — no el catálogo completo (antes
 * mezclaba ahí cualquier puesto de cualquier industria; Hugo, 2026-10-20).
 * Agregar una posición que nunca se cotizó es un caso aparte, no este.
 */
export function EditRateDialog({
  contractId,
  rates,
  isOpen,
  onClose,
}: {
  contractId: string
  /** Las posiciones ya cotizadas del contrato — el único universo que se ofrece aquí. */
  rates: ContractRate[]
  isOpen: boolean
  onClose: () => void
}): ReactNode {
  const { t } = useLingui()
  const [upsertRate, { isLoading, isError, error }] = useUpsertContractRateMutation()

  const [positionId, setPositionId] = useState('')
  const [payRate, setPayRate] = useState('')
  const [billRate, setBillRate] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setPositionId('')
    setPayRate('')
    setBillRate('')
  }, [isOpen])

  /** Elegir una posición parte de lo que ya está cotizado, no de cero. */
  function selectPosition(id: string): void {
    setPositionId(id)
    const current = rates.find((rate) => rate.catalogPositionId === id)
    setPayRate(current?.payRate.toFixed(2) ?? '')
    setBillRate(current?.billRate.toFixed(2) ?? '')
  }

  const marginIsNegative =
    MONEY_PATTERN.test(payRate) &&
    MONEY_PATTERN.test(billRate) &&
    Number(billRate) < Number(payRate)

  const canSubmit =
    positionId !== '' &&
    MONEY_PATTERN.test(payRate) &&
    MONEY_PATTERN.test(billRate) &&
    !marginIsNegative &&
    !isLoading

  async function submit(): Promise<void> {
    if (!canSubmit) return
    try {
      await upsertRate({ contractId, catalogPositionId: positionId, payRate, billRate }).unwrap()
      toast.success(t`Tarifa guardada`)
      onClose()
    } catch {
      return
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t`Corregir tarifa`}
      description={t`Ajusta lo que ya se cotizó en la propuesta para esta posición.`}
    >
      <div className="flex flex-col gap-4">
        {isError && (
          <p role="alert" className="text-sm text-red">
            {apiErrorMessage(error, {
              byCode: {
                CONTRACT_CLOSED: t`Este contrato ya está cerrado: las tarifas quedaron congeladas.`,
                RATE_MARGIN_NEGATIVE: t`Lo que se factura no puede ser menor a lo que se paga a la persona.`,
              },
              fallback: t`No se pudo guardar la tarifa. Inténtalo de nuevo.`,
            })}
          </p>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink-2">
            <Trans>Posición</Trans>
          </span>
          <Select {...(positionId ? { value: positionId } : {})} onValueChange={selectPosition}>
            <SelectTrigger aria-label={t`Posición`} className="w-full">
              <SelectValue placeholder={t`Elige la posición…`} />
            </SelectTrigger>
            <SelectContent>
              {rates.map((rate) => (
                <SelectItem key={rate.catalogPositionId} value={rate.catalogPositionId}>
                  {rate.positionName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-2">
              <Trans>Se le paga al colaborador</Trans>
            </span>
            <Input
              inputMode="decimal"
              placeholder="20.00"
              value={payRate}
              onChange={(event) => {
                setPayRate(event.target.value)
              }}
              aria-label={t`Tarifa de pago`}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-2">
              <Trans>Se le factura al hotel</Trans>
            </span>
            <Input
              inputMode="decimal"
              placeholder="35.00"
              value={billRate}
              onChange={(event) => {
                setBillRate(event.target.value)
              }}
              aria-label={t`Tarifa de facturación`}
            />
          </label>
        </div>

        {marginIsNegative && (
          <p className="text-xs text-red">
            <Trans>Lo que se factura no puede ser menor a lo que se paga.</Trans>
          </p>
        )}

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
            {isLoading ? <Trans>Guardando…</Trans> : <Trans>Guardar tarifa</Trans>}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
