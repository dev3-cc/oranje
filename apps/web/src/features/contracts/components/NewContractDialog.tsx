import type { I18n, MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  cn,
  Input,
  MaterialIcon,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'

import { useCreateContractMutation, useGetContractFormOptionsQuery } from '../api/contractsApi'

import personajeAcceso from '@/assets/ilustrations/personaje-acceso-protegido.svg'
import personajeContratacion from '@/assets/ilustrations/personaje-contratacion.svg'
import personajeCronograma from '@/assets/ilustrations/personaje-cronograma.svg'
import personajePago from '@/assets/ilustrations/personaje-pago-procesado.svg'
import { Button } from '@/shared/components/Button'
import { DateField } from '@/shared/components/DateField'
import { Modal } from '@/shared/components/Modal'
import { OnboardingIntro } from '@/shared/components/OnboardingIntro'
import { WEEK_DAY_NAMES } from '@/shared/constants/contractStatus'
import { useIntroSeen } from '@/shared/hooks/useIntroSeen'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { IS_DEV_UI } from '@/shared/lib/devMode'

/** Una fila de tarifa del borrador; los montos van como cadena (Estándares §3). */
export interface RateDraft {
  catalogPositionId: string
  payRate: string
  billRate: string
}

/** El texto se traduce al pintar con `i18n._()` (D-36). */
const INTRO_SLIDES: readonly {
  image: string
  title: MessageDescriptor
  text: MessageDescriptor
}[] = [
  {
    image: personajeAcceso,
    title: msg`Solo el contrato define lo que se paga y se factura`,
    text: msg`Un hotel solo puede tener un contrato vigente a la vez: es lo que respalda cada asignación y cada factura.`,
  },
  {
    image: personajeCronograma,
    title: msg`Vigencia y semana laboral`,
    text: msg`Las fechas de vigencia y el corte semanal que definas aquí mandan después en la nómina y en la factura.`,
  },
  {
    image: personajePago,
    title: msg`Las tarifas solo se editan en borrador`,
    text: msg`Se crea como borrador. Ajusta las tarifas por posición y actívalo cuando esté listo.`,
  },
]

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

/** El `i18n` viene del componente (D-36). */
function saveErrorMessage(error: unknown, i18n: I18n): string {
  return apiErrorMessage(error, {
    byCode: {
      RATE_MARGIN_NEGATIVE: i18n._(
        msg`Hay una tarifa cotizada por debajo del costo: lo que se factura no puede ser menor a lo que se paga.`,
      ),
      VALIDITY_BACKWARDS: i18n._(msg`La fecha de fin tiene que ser posterior al inicio.`),
      WEEK_INVALID: i18n._(msg`La semana de nómina no puede empezar y terminar el mismo día.`),
    },
    fallback: i18n._(msg`No se pudo crear el contrato. Revisa los datos e inténtalo de nuevo.`),
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
  hotel = null,
  initialRates = null,
}: {
  isOpen: boolean
  onClose: () => void
  /**
   * El hotel ya decidido, cuando el contrato nace desde su ficha — que es el
   * camino normal (Reglas de Negocio: el Documento de T&C se crea dentro del
   * ciclo del hotel, no eligiéndolo de una lista). Sin él, el diálogo lo pide.
   */
  hotel?: { id: string; name: string; photoUrl?: string | null } | null
  /** El cuadro de la propuesta aceptada, para no recapturar lo ya cotizado. */
  initialRates?: RateDraft[] | null
}): ReactNode {
  const { t, i18n } = useLingui()
  const navigate = useNavigate()
  const { data: options } = useGetContractFormOptionsQuery(undefined, { skip: !isOpen })
  const [createContract, { isLoading, isError, error }] = useCreateContractMutation()

  const [hotelId, setHotelId] = useState(hotel?.id ?? '')
  const [validFrom, setValidFrom] = useState('')
  const [validTo, setValidTo] = useState('')
  const [weekStartDay, setWeekStartDay] = useState(1)
  const [rateRows, setRateRows] = useState<RateDraft[]>([EMPTY_RATE])

  const { isIntroOpen: showIntro, dismissIntro } = useIntroSeen('new-contract')

  const [isPhotoBroken, setIsPhotoBroken] = useState(false)
  useEffect(() => {
    setIsPhotoBroken(false)
  }, [hotel?.photoUrl])
  const heroPhoto = !isPhotoBroken && hotel?.photoUrl ? hotel.photoUrl : null

  useEffect(() => {
    if (!isOpen) return
    setHotelId(hotel?.id ?? '')
    setValidFrom('')
    setValidTo('')
    setWeekStartDay(1)
    /* Las tarifas llegan de la propuesta que el hotel aceptó: se revisan y se
       ajustan si hubo negociación, pero no se vuelven a teclear. */
    setRateRows(initialRates && initialRates.length > 0 ? initialRates : [EMPTY_RATE])
  }, [isOpen, hotel, initialRates])

  const completeRates = rateRows.filter(isCompleteRate)
  const canSubmit = hotelId !== '' && validFrom !== '' && completeRates.length > 0 && !isLoading
  /** Un botón apagado sin explicación es un muro: se dice qué falta. */
  const missing = [
    hotelId === '' ? t`elige el hotel` : null,
    validFrom === '' ? t`pon desde cuándo rige` : null,
    completeRates.length === 0 ? t`completa al menos una posición con su pago y su factura` : null,
  ].filter((item): item is string => item !== null)

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
      toast.success(t`Contrato creado — en Borrador`)
      onClose()
      void navigate(`/contratos/${created.id}`)
    } catch {
      return
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t`Nuevo contrato`}
      chromeless
      className="max-w-4xl"
    >
      {showIntro ? (
        <OnboardingIntro
          slides={INTRO_SLIDES.map((slide) => ({
            image: slide.image,
            title: i18n._(slide.title),
            text: i18n._(slide.text),
          }))}
          startLabel={t`Comenzar el contrato`}
          onDone={() => {
            dismissIntro()
          }}
        />
      ) : (
        <div className="grid max-h-[calc(100vh-3rem)] grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)]">
          {/* La foto del hotel al lado, como el alta de requisición: el mismo
              patrón (hero con degradado, personaje de respaldo sin foto). */}
          <aside className="relative hidden overflow-hidden md:block">
            {heroPhoto ? (
              <>
                <img
                  src={heroPhoto}
                  alt=""
                  aria-hidden
                  loading="lazy"
                  onError={() => {
                    setIsPhotoBroken(true)
                  }}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/30 to-ink/5"
                />
              </>
            ) : (
              <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-o-50 to-surface-3">
                <img
                  src={personajeContratacion}
                  alt=""
                  className="absolute top-8 left-1/2 h-40 w-auto -translate-x-1/2 opacity-90"
                />
              </div>
            )}
            <div
              className={cn(
                'relative flex h-full flex-col justify-end gap-2 p-5',
                heroPhoto ? 'text-surface' : 'text-ink',
              )}
            >
              <p className="text-xl leading-tight font-bold">{hotel?.name ?? t`Nuevo contrato`}</p>
              <p className={cn('text-sm', heroPhoto ? 'text-surface/85' : 'text-ink-2')}>
                <Trans>Nace en Borrador</Trans>
              </p>
            </div>
          </aside>

          <section className="flex max-h-[calc(100vh-3rem)] min-w-0 flex-col">
            <header className="border-b border-line px-6 py-5">
              <h2 className="text-xl font-bold text-ink">
                <Trans>Nuevo contrato</Trans>
              </h2>
              <p className="mt-1 text-sm text-ink-3">
                <Trans>
                  Nace en Borrador: las tarifas se afinan ahí y activarlo es el paso final.
                </Trans>
              </p>
            </header>

            <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
              {isError && (
                <p role="alert" className="text-sm text-red">
                  {saveErrorMessage(error, i18n)}
                </p>
              )}

              {/* Con el hotel decidido no se ofrece cambiarlo: el contrato es de
              ESE ciclo. Elegirlo de una lista es la excepción (renovación o un
              cliente antiguo sin propuesta en el sistema). */}
              {hotel ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-ink-2">
                    <Trans>Hotel cliente</Trans>
                  </span>
                  <p className="rounded-md bg-surface-2 px-4 py-3 text-sm font-semibold text-ink">
                    {hotel.name}
                  </p>
                </div>
              ) : (
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-ink-2">
                    <Trans>Hotel cliente</Trans>
                    {IS_DEV_UI && <code className="ml-2 text-[11px] text-ink-4">hotel_id</code>}
                  </span>
                  <Select {...(hotelId ? { value: hotelId } : {})} onValueChange={setHotelId}>
                    <SelectTrigger aria-label={t`Hotel cliente`} className="w-full">
                      <SelectValue placeholder={t`Elige el hotel…`} />
                    </SelectTrigger>
                    <SelectContent>
                      {(options?.hotels ?? []).map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {/* Calendario de shadcn y no `input[type=date]`: dentro de un
                Dialog de Radix el selector nativo se cierra solo (mismo fix que
                el alta de requisición). */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-ink-2">
                    <Trans>Vigente desde</Trans>
                  </span>
                  <DateField
                    value={validFrom}
                    onChange={setValidFrom}
                    aria-label={t`Vigente desde`}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-ink-2">
                    <Trans>Vigente hasta (opcional)</Trans>
                  </span>
                  <DateField
                    value={validTo}
                    onChange={setValidTo}
                    min={validFrom}
                    aria-label={t`Vigente hasta`}
                  />
                </div>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-ink-2">
                    <Trans>La semana de nómina empieza en</Trans>
                  </span>
                  <Select
                    value={String(weekStartDay)}
                    onValueChange={(value) => {
                      setWeekStartDay(Number(value))
                    }}
                  >
                    <SelectTrigger aria-label={t`Inicio de la semana de nómina`} className="w-full">
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
                  <Trans>Tarifas por posición</Trans>
                  {IS_DEV_UI && (
                    <code className="ml-2 text-[11px] text-ink-4">contract_rate · bill ≥ pay</code>
                  )}
                </p>
                {rateRows.map((row, index) => (
                  /* El índice ES la identidad de la fila del borrador. Cada posición
                 va en su propia tarjeta, como en el alta de requisición: con
                 varias, las tres columnas sueltas no se leían como un renglón. */
                  <div key={String(index)} className="rounded-lg border border-line p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-ink">
                        <Trans>Posición {index + 1}</Trans>
                      </p>
                      <button
                        type="button"
                        aria-label={t`Quitar posición ${String(index + 1)}`}
                        disabled={rateRows.length === 1}
                        onClick={() => {
                          setRateRows((rows) => rows.filter((_row, i) => i !== index))
                        }}
                        title={t`Quitar esta posición del contrato`}
                        className="cursor-pointer rounded-md p-1.5 text-ink-3 hover:bg-surface-2 hover:text-red disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {/* Basurero y no ✕: elimina la fila, no cierra nada. */}
                        <MaterialIcon name="delete" className="text-lg" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-ink-3">
                          <Trans>Posición</Trans>
                        </span>
                        <Select
                          {...(row.catalogPositionId ? { value: row.catalogPositionId } : {})}
                          onValueChange={(value) => {
                            updateRate(index, { catalogPositionId: value })
                          }}
                        >
                          <SelectTrigger
                            aria-label={t`Posición ${String(index + 1)}`}
                            className="w-full"
                          >
                            <SelectValue placeholder={t`Posición…`} />
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
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-ink-3">
                          <Trans>Pago por hora</Trans>
                        </span>
                        <Input
                          inputMode="decimal"
                          placeholder="20.00"
                          value={row.payRate}
                          onChange={(event) => {
                            updateRate(index, { payRate: event.target.value })
                          }}
                          aria-label={t`Pago ${String(index + 1)}`}
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-ink-3">
                          <Trans>Factura por hora</Trans>
                        </span>
                        <Input
                          inputMode="decimal"
                          placeholder="35.00"
                          value={row.billRate}
                          onChange={(event) => {
                            updateRate(index, { billRate: event.target.value })
                          }}
                          aria-label={t`Factura ${String(index + 1)}`}
                        />
                      </label>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setRateRows((rows) => [...rows, EMPTY_RATE])
                  }}
                  className="self-start cursor-pointer text-sm font-medium text-o-700 hover:underline"
                >
                  <Trans>+ Agregar posición</Trans>
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
                    <Trans>Lo que se factura no puede ser menor a lo que se paga.</Trans>
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-line px-6 py-4">
              {missing.length > 0 && !isLoading && (
                <p className="mr-auto self-center text-xs text-ink-3">
                  <Trans>Para crear: {missing.join(' · ')}.</Trans>
                </p>
              )}
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
                {isLoading ? <Trans>Creando…</Trans> : <Trans>Crear borrador</Trans>}
              </Button>
            </div>
          </section>
        </div>
      )}
    </Modal>
  )
}
