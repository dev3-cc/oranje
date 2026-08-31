import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'

import { useGetContractFormOptionsQuery, useUpsertContractRateMutation } from '../api/contractsApi'

import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { apiErrorMessage } from '@/shared/lib/apiError'

const MONEY_PATTERN = /^\d{1,8}(\.\d{1,2})?$/

/**
 * Alta o corrección de UNA tarifa del borrador (`PUT /contracts/:id/rates`):
 * elegir una posición que ya tiene fila la reemplaza — así es el upsert del
 * back, y solo funciona mientras el contrato sigue en Borrador.
 */
export function EditRateDialog({
  contractId,
  isOpen,
  onClose,
}: {
  contractId: string
  isOpen: boolean
  onClose: () => void
}): ReactNode {
  const { data: options } = useGetContractFormOptionsQuery(undefined, { skip: !isOpen })
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
      onClose()
    } catch {
      return
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Definir tarifa por posición"
      description="Si la posición ya tiene tarifa, esta la reemplaza."
    >
      <div className="flex flex-col gap-4">
        {isError && (
          <p role="alert" className="text-sm text-red">
            {apiErrorMessage(error, {
              byCode: {
                CONTRACT_NOT_DRAFT:
                  'Este contrato ya no es borrador: las tarifas quedaron congeladas al activarlo.',
                RATE_MARGIN_NEGATIVE:
                  'Lo que se factura no puede ser menor a lo que se paga a la persona.',
              },
              fallback: 'No se pudo guardar la tarifa. Inténtalo de nuevo.',
            })}
          </p>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink-2">Posición</span>
          <Select {...(positionId ? { value: positionId } : {})} onValueChange={setPositionId}>
            <SelectTrigger aria-label="Posición" className="w-full">
              <SelectValue placeholder="Elige la posición…" />
            </SelectTrigger>
            <SelectContent>
              {(options?.positions ?? []).map((position) => (
                <SelectItem key={position.id} value={position.id}>
                  {position.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-2">Se le paga al colaborador</span>
            <Input
              inputMode="decimal"
              placeholder="20.00"
              value={payRate}
              onChange={(event) => {
                setPayRate(event.target.value)
              }}
              aria-label="Tarifa de pago"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-2">Se le factura al hotel</span>
            <Input
              inputMode="decimal"
              placeholder="35.00"
              value={billRate}
              onChange={(event) => {
                setBillRate(event.target.value)
              }}
              aria-label="Tarifa de facturación"
            />
          </label>
        </div>

        {marginIsNegative && (
          <p className="text-xs text-red">Lo que se factura no puede ser menor a lo que se paga.</p>
        )}

        <div className="flex justify-end gap-3 border-t border-line pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={!canSubmit}
            onClick={() => {
              void submit()
            }}
          >
            {isLoading ? 'Guardando…' : 'Guardar tarifa'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
