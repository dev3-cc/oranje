import {
  Input,
  MaterialIcon,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'

import { useCreateContractMutation, useGetContractFormOptionsQuery } from '../api/contractsApi'

import personajeAcceso from '@/assets/ilustrations/personaje-acceso-protegido.svg'
import personajeCronograma from '@/assets/ilustrations/personaje-cronograma.svg'
import personajePago from '@/assets/ilustrations/personaje-pago-procesado.svg'
import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { OnboardingIntro } from '@/shared/components/OnboardingIntro'
import { WEEK_DAY_NAMES } from '@/shared/constants/contractStatus'
import { useIntroSeen } from '@/shared/hooks/useIntroSeen'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { IS_DEV_UI } from '@/shared/lib/devMode'

/** Una fila de tarifa del borrador; los montos van como cadena (Estándares §3). */
interface RateDraft {
  catalogPositionId: string
  payRate: string
  billRate: string
}

const INTRO_SLIDES = [
  {
    image: personajeAcceso,
    title: 'El contrato es el candado',
    text: 'Un hotel solo puede tener un contrato vigente a la vez: es lo que respalda cada asignación y cada factura.',
  },
  {
    image: personajeCronograma,
    title: 'Vigencia y semana laboral',
    text: 'Las fechas de vigencia y el corte semanal que definas aquí mandan después en la nómina y en la factura.',
  },
  {
    image: personajePago,
    title: 'Las tarifas viven en el borrador',
    text: 'Nace en Borrador: las tarifas por posición se afinan ahí y activarlo es el paso final.',
  },
] as const

const EMPTY_RATE: RateDraft = { catalogPositionId: '', payRate: '', billRate: '' }

const MONEY_PATTERN = /^\d{1,8}(\.\d{1,2})?$/

function isCompleteRate(rate: RateDraft): boolean {
  return (
    rate.catalogPositionId !== '' &&
    MONEY_PATTERN.test(rate.payRate) &&
    MONEY_PATTERN.test(rate.billRate) &&
    Number(rate.billRate) >= Number(rate.payRate)
  )
}

function saveErrorMessage(error: unknown): string {
  return apiErrorMessage(error, {
    byCode: {
      RATE_MARGIN_NEGATIVE:
        'Hay una tarifa cotizada por debajo del costo: lo que se factura no puede ser menor a lo que se paga.',
      VALIDITY_BACKWARDS: 'La fecha de fin tiene que ser posterior al inicio.',
      WEEK_INVALID: 'La semana de nómina no puede empezar y terminar el mismo día.',
    },
    fallback: 'No se pudo crear el contrato. Revisa los datos e inténtalo de nuevo.',
  })
}

/**
 * El alta del Documento de T&C: nace en BORRADOR con sus tarifas, y activarlo
 * es un paso aparte en su detalle — así el back lo exige (las tarifas solo se
 * editan en DRAFT y activar pide al menos una).
 */
export function NewContractDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}): ReactNode {
  const navigate = useNavigate()
  const { data: options } = useGetContractFormOptionsQuery(undefined, { skip: !isOpen })
  const [createContract, { isLoading, isError, error }] = useCreateContractMutation()

  const [hotelId, setHotelId] = useState('')
  const [validFrom, setValidFrom] = useState('')
  const [validTo, setValidTo] = useState('')
  const [weekStartDay, setWeekStartDay] = useState(1)
  const [rateRows, setRateRows] = useState<RateDraft[]>([EMPTY_RATE])

  const { isIntroOpen: showIntro, dismissIntro } = useIntroSeen('new-contract')

  useEffect(() => {
    if (!isOpen) return
    setHotelId('')
    setValidFrom('')
    setValidTo('')
    setWeekStartDay(1)
    setRateRows([EMPTY_RATE])
  }, [isOpen])

  const completeRates = rateRows.filter(isCompleteRate)
  const canSubmit = hotelId !== '' && validFrom !== '' && completeRates.length > 0 && !isLoading

  function updateRate(index: number, patch: Partial<RateDraft>): void {
    setRateRows((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  async function submit(): Promise<void> {
    if (!canSubmit) return
    try {
      const created = await createContract({
        hotelId,
        validFrom,
        ...(validTo !== '' ? { validTo } : {}),
        weekStartDay,
        /** La semana termina el día anterior al que empieza: 7 días exactos. */
        weekEndDay: (weekStartDay + 6) % 7,
        overtimeBillMultiplier: 1.5,
        overtimePayMultiplier: 1,
        holidayBillMultiplier: 2,
        holidayPayMultiplier: 1,
        deductsMeals: false,
        splitsInvoiceByMonth: false,
        rates: completeRates,
      }).unwrap()
      onClose()
      void navigate(`/documentos-tc/${created.id}`)
    } catch {
      return
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nuevo contrato"
      description="Nace en Borrador: las tarifas se afinan ahí y activarlo es el paso final."
      className="max-w-2xl"
    >
      {showIntro ? (
        <OnboardingIntro
          slides={INTRO_SLIDES}
          startLabel="Comenzar el contrato"
          onDone={() => {
            dismissIntro()
          }}
        />
      ) : (
        <div className="flex flex-col gap-5">
          {isError && (
            <p role="alert" className="text-sm text-red">
              {saveErrorMessage(error)}
            </p>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-2">
              Hotel cliente
              {IS_DEV_UI && <code className="ml-2 text-[11px] text-ink-4">hotel_id</code>}
            </span>
            <Select {...(hotelId ? { value: hotelId } : {})} onValueChange={setHotelId}>
              <SelectTrigger aria-label="Hotel cliente" className="w-full">
                <SelectValue placeholder="Elige el hotel…" />
              </SelectTrigger>
              <SelectContent>
                {(options?.hotels ?? []).map((hotel) => (
                  <SelectItem key={hotel.id} value={hotel.id}>
                    {hotel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink-2">Vigente desde</span>
              <Input
                type="date"
                value={validFrom}
                onChange={(event) => {
                  setValidFrom(event.target.value)
                }}
                aria-label="Vigente desde"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink-2">Vigente hasta (opcional)</span>
              <Input
                type="date"
                value={validTo}
                min={validFrom}
                onChange={(event) => {
                  setValidTo(event.target.value)
                }}
                aria-label="Vigente hasta"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink-2">La semana de nómina empieza en</span>
              <Select
                value={String(weekStartDay)}
                onValueChange={(value) => {
                  setWeekStartDay(Number(value))
                }}
              >
                <SelectTrigger aria-label="Inicio de la semana de nómina" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEK_DAY_NAMES.map((name, index) => (
                    <SelectItem key={name} value={String(index)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-ink-2">
              Tarifas por posición
              {IS_DEV_UI && (
                <code className="ml-2 text-[11px] text-ink-4">contract_rate · bill ≥ pay</code>
              )}
            </p>
            {rateRows.map((row, index) => (
              /* El índice ES la identidad de la fila del borrador. */
              <div key={String(index)} className="flex flex-wrap items-center gap-2">
                <Select
                  {...(row.catalogPositionId ? { value: row.catalogPositionId } : {})}
                  onValueChange={(value) => {
                    updateRate(index, { catalogPositionId: value })
                  }}
                >
                  <SelectTrigger
                    aria-label={`Posición ${String(index + 1)}`}
                    className="w-full min-w-0 sm:w-auto sm:flex-1"
                  >
                    <SelectValue placeholder="Posición…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(options?.positions ?? []).map((position) => (
                      <SelectItem key={position.id} value={position.id}>
                        {position.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  inputMode="decimal"
                  placeholder="Pago 20.00"
                  value={row.payRate}
                  onChange={(event) => {
                    updateRate(index, { payRate: event.target.value })
                  }}
                  aria-label={`Pago ${String(index + 1)}`}
                  className="w-28"
                />
                <Input
                  inputMode="decimal"
                  placeholder="Factura 35.00"
                  value={row.billRate}
                  onChange={(event) => {
                    updateRate(index, { billRate: event.target.value })
                  }}
                  aria-label={`Factura ${String(index + 1)}`}
                  className="w-28"
                />
                <button
                  type="button"
                  aria-label={`Quitar posición ${String(index + 1)}`}
                  disabled={rateRows.length === 1}
                  onClick={() => {
                    setRateRows((rows) => rows.filter((_row, i) => i !== index))
                  }}
                  className="cursor-pointer rounded-md p-1.5 text-ink-3 hover:bg-surface-2 hover:text-red disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <MaterialIcon name="close" className="text-lg" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                setRateRows((rows) => [...rows, EMPTY_RATE])
              }}
              className="self-start cursor-pointer text-sm font-medium text-o-700 hover:underline"
            >
              + Agregar posición
            </button>
            {rateRows.some(
              (row) =>
                row !== EMPTY_RATE &&
                !isCompleteRate(row) &&
                row.billRate !== '' &&
                row.payRate !== '' &&
                Number(row.billRate) < Number(row.payRate),
            ) && (
              <p className="text-xs text-red">
                Lo que se factura no puede ser menor a lo que se paga.
              </p>
            )}
          </div>

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
              {isLoading ? 'Creando…' : 'Crear borrador'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
