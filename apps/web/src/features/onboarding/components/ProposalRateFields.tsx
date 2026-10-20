import { Trans, useLingui } from '@lingui/react/macro'
import {
  MaterialIcon,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@oranje/ui'
import { useState, type ReactNode } from 'react'
import { Controller, useFieldArray, type Control, type UseFormRegister } from 'react-hook-form'

import type { ProposalDraftForm } from '../types/proposalDraft.schema'

import { Button } from '@/shared/components/Button'
import { MoneyInput } from '@/shared/components/MoneyInput'

/**
 * El cuadro de tarifas de la propuesta: un renglón por puesto, con lo que Oranje
 * le paga al colaborador y lo que el hotel le paga a Oranje.
 *
 * Es el mismo cuadro que firma el hotel en el Exhibit «A» del Documento de T&C,
 * así que se captura aquí una vez y de aquí se copia al contrato.
 *
 * El margen se muestra calculado a la derecha, pero NUNCA se guarda ni se usa
 * para derivar el bill: en el contrato real de Lithia Springs cada puesto tiene
 * su propio porcentaje (30%, 28.5%, 26.75%) porque cada renglón se negocia.
 */
export function ProposalRateFields({
  control,
  register,
  industries,
  positions,
  errors,
}: {
  control: Control<ProposalDraftForm>
  register: UseFormRegister<ProposalDraftForm>
  /** La industria que filtra el puesto (2026-10-17): Oranje deja de ser solo hoteles. */
  industries: Array<{ id: string; name: string }>
  positions: Array<{ id: string; name: string; industryId: string | null }>
  errors: {
    rates?: {
      message?: string | undefined
      [index: number]:
        | {
            positionId?: { message?: string | undefined } | undefined
            payRate?: { message?: string | undefined } | undefined
            billRate?: { message?: string | undefined } | undefined
          }
        | undefined
    }
  }
}): ReactNode {
  const { t } = useLingui()
  const { fields, append, remove } = useFieldArray({ control, name: 'rates' })
  /* Sin puestos en el catálogo no hay nada que cotizar: se dice quién los da de
     alta, en vez de dejar un selector vacío que parece roto. */
  const hasPositions = positions.length > 0
  /** La industria elegida por renglón: solo filtra el puesto de ESE renglón,
      no viaja al back. Por índice, igual que en Contratos — una propuesta que
      ya trae puesto (al reabrir un borrador) la deriva de ahí sin pedirla de
      nuevo. */
  const [rowIndustry, setRowIndustry] = useState<Record<number, string>>({})

  function industryOf(index: number, positionId: string): string {
    return (
      rowIndustry[index] ??
      positions.find((position) => position.id === positionId)?.industryId ??
      ''
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {!hasPositions && (
        <p role="status" className="rounded-md bg-yellow/25 p-4 text-sm leading-relaxed text-ink">
          <Trans>
            El catálogo no tiene puestos todavía. Pídele al Administrador que los agregue en
            Catálogos · Departamentos y posiciones; sin ellos no se puede cotizar.
          </Trans>
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {fields.map((field, index) => {
          const rowError = errors.rates?.[index]

          return (
            <li key={field.id} className="rounded-lg border border-line bg-surface-2 p-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor={`rate-industry-${String(index)}`}
                    className="text-xs font-semibold text-ink-3"
                  >
                    <Trans>Industria</Trans>
                  </label>
                  <Controller
                    control={control}
                    name={`rates.${String(index) as '0'}.positionId` as const}
                    render={({ field: positionField }) => {
                      const industryId = industryOf(index, positionField.value)
                      return (
                        <Select
                          {...(industryId ? { value: industryId } : {})}
                          onValueChange={(value) => {
                            setRowIndustry((prev) => ({ ...prev, [index]: value }))
                            // Cambiar de industria deja el puesto elegido sin sentido.
                            positionField.onChange('')
                          }}
                          disabled={!hasPositions}
                        >
                          <SelectTrigger
                            id={`rate-industry-${String(index)}`}
                            aria-label={t`Industria`}
                            className="w-full"
                          >
                            <SelectValue placeholder={t`Industria…`} />
                          </SelectTrigger>
                          <SelectContent>
                            {industries.map((industry) => (
                              <SelectItem key={industry.id} value={industry.id}>
                                {industry.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )
                    }}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor={`rate-position-${String(index)}`}
                    className="text-xs font-semibold text-ink-3"
                  >
                    <Trans>Puesto</Trans>
                  </label>
                  {/* El puesto sale del catálogo. Radix y no `select` nativo:
                      la app no tiene ninguno desde la migración a shadcn. */}
                  <Controller
                    control={control}
                    name={`rates.${String(index) as '0'}.positionId` as const}
                    render={({ field }) => {
                      const industryId = industryOf(index, field.value)
                      const options = positions.filter(
                        (position) => industryId === '' || position.industryId === industryId,
                      )
                      return (
                        <Select
                          {...(field.value ? { value: field.value } : {})}
                          onValueChange={field.onChange}
                          disabled={!hasPositions}
                        >
                          <SelectTrigger
                            id={`rate-position-${String(index)}`}
                            aria-label={t`Puesto`}
                            className="w-full"
                          >
                            <SelectValue placeholder={t`Elige el puesto…`} />
                          </SelectTrigger>
                          <SelectContent>
                            {options.map((position) => (
                              <SelectItem key={position.id} value={position.id}>
                                {position.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )
                    }}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor={`rate-pay-${String(index)}`}
                    className="text-xs font-semibold text-ink-3"
                  >
                    <Trans>Pay rate</Trans>
                  </label>
                  <MoneyInput
                    id={`rate-pay-${String(index)}`}
                    className="py-2.5"
                    {...register(`rates.${String(index) as '0'}.payRate` as const, {
                      valueAsNumber: true,
                    })}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor={`rate-bill-${String(index)}`}
                    className="text-xs font-semibold text-ink-3"
                  >
                    <Trans>Bill rate</Trans>
                  </label>
                  <MoneyInput
                    id={`rate-bill-${String(index)}`}
                    className="py-2.5"
                    {...register(`rates.${String(index) as '0'}.billRate` as const, {
                      valueAsNumber: true,
                    })}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    remove(index)
                  }}
                  aria-label={t`Quitar el renglón ${String(index + 1)}`}
                  className="flex size-10 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-surface hover:text-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
                >
                  <MaterialIcon name="delete" aria-hidden className="text-lg" />
                </button>
              </div>

              {(rowError?.positionId?.message ??
                rowError?.payRate?.message ??
                rowError?.billRate?.message) !== undefined && (
                <p role="alert" className="mt-2 text-sm text-red">
                  {rowError?.positionId?.message ??
                    rowError?.payRate?.message ??
                    rowError?.billRate?.message}
                </p>
              )}
            </li>
          )
        })}
      </ul>

      {errors.rates?.message !== undefined && (
        <p role="alert" className="text-sm text-red">
          {errors.rates.message}
        </p>
      )}

      <div>
        <Button
          type="button"
          variant="secondary"
          disabled={!hasPositions}
          onClick={() => {
            append({ positionId: '', payRate: 0, billRate: 0 })
          }}
        >
          <Trans>Agregar puesto</Trans>
        </Button>
      </div>
    </div>
  )
}
