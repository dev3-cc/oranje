import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  MaterialIcon,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  toast,
} from '@oranje/ui'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import {
  useGeneratePaymentRunMutation,
  useGetConsolidationsQuery,
  useGetAccountingTimesheetsQuery,
  useGetHotelCardForAccountingQuery,
} from '../api/settlementApi'
import {
  downloadInvoiceCsv,
  downloadInvoicePdf,
  type InvoiceLineItem,
} from '../lib/invoiceDocument'
import { money } from '../lib/settlementFormat'

import personajeCronograma from '@/assets/ilustrations/personaje-cronograma.svg'
// `weekStart` siempre es lunes (regla de negocio, `assertMonday` en el
// servidor) — el domingo se deriva, nunca se adivina del primer Consolidado
// que exista (Hugo, 2026-10-15: con el hotel sin cerrar antes, el título
// decía "12 – 12 oct" en vez de "12 – 18 oct").
// eslint-disable-next-line no-restricted-imports
import { addDaysIso } from '@/features/timesheet/lib/weekNavigation'
import { Button } from '@/shared/components/Button'
import { HotelPhotoBackdrop } from '@/shared/components/HotelPhotoBackdrop'
import { Modal } from '@/shared/components/Modal'
import { useCan } from '@/shared/hooks/useCan'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { formatMoney, formatWeekRange } from '@/shared/lib/formatters'

interface BlockedTimesheet {
  name: string
  status: 'OPEN' | 'PENDING_APPROVAL'
}

type Step = 1 | 2 | 3

const STEP_LABEL: Record<Step, MessageDescriptor> = {
  1: msg`Confirmar`,
  2: msg`Resultado`,
  3: msg`Descargar`,
}

/**
 * El botón que de verdad es de Contabilidad: cierra la semana de ESTE hotel
 * (Hugo, 2026-10-14 — "ellos no aprueban, ellos deben tener otros botones").
 * Corre el corte del miércoles; es idempotente, repetirlo no duplica nada.
 *
 * Por pasos, como el alta de prospecto en Pipeline — con la foto del hotel
 * al lado (Hugo, 2026-10-14): un solo hotel a la vez es justo lo que deja
 * que esa foto tenga sentido en los tres pasos, no solo en uno.
 */
export function GeneratePaymentRunButton({
  weekStart,
  hotelId,
  hotelName,
  blocked,
}: {
  weekStart: string
  /** `null` con "Todos los hoteles" elegido: el botón queda deshabilitado
      con el porqué, no escondido. */
  hotelId: string | null
  hotelName: string | null
  /** Quién de ESTA semana le falta aprobar — ya resuelto por quien llama,
      antes de que el modal exista siquiera (Hugo, 2026-10-15: "para qué
      abrir el modal si no se puede"). Vacío = nada bloquea. */
  blocked: BlockedTimesheet[]
}): ReactNode {
  const { t, i18n } = useLingui()
  const can = useCan()
  const [step, setStep] = useState<Step | 0>(0)
  const [run, { isLoading: isRunning }] = useGeneratePaymentRunMutation()
  const isOpen = step !== 0
  const isBlocked = blocked.length > 0

  const { data: hotelCard } = useGetHotelCardForAccountingQuery(hotelId ?? '', {
    skip: !hotelId || !isOpen,
  })
  const { data: consolidations } = useGetConsolidationsQuery({ weekStart }, { skip: !isOpen })
  /* Solo para el paso 3 (la factura): el paso 1 ya no necesita esta consulta
     — lo que antes avisaba AQUÍ (quién falta por aprobar) ahora lo sabe
     quien llama, desde antes de que el botón siquiera se pueda tocar. */
  const { data: timesheets, isFetching: isLoadingInvoice } = useGetAccountingTimesheetsQuery(
    { weekStart, ...(hotelId ? { hotelId } : {}) },
    { skip: step !== 3 || !hotelId },
  )

  if (!can('payroll:generate')) return null

  const rows = (consolidations ?? []).filter((row) => row.hotel.name === hotelName)
  const totalGross = rows.reduce((sum, row) => sum + Number(row.grossAmount), 0)
  const totalDeductions = rows.reduce((sum, row) => sum + Number(row.deductionAmount), 0)
  const totalNet = rows.reduce((sum, row) => sum + Number(row.netAmount), 0)
  const weekEnd = addDaysIso(weekStart, 6)
  /* "Repetirlo no duplica nada" solo tiene sentido si YA se cerró antes —
     con nada todavía cerrado, esa frase sonaba a que ya se había corrido
     (Hugo, 2026-10-15: contradice "todavía no se ha cerrado nada"). */
  const alreadyRan = rows.length > 0

  function close(): void {
    setStep(0)
  }

  async function confirm(): Promise<void> {
    if (!hotelId) return
    try {
      const result = await run({ weekStart, slot: 'WEDNESDAY_CUT', hotelId }).unwrap()
      const ran = result.hotels.find((hotel) => hotel.status === 'RAN')
      if (!ran) {
        // Con `blocked` ya resuelto antes de abrir, lo único que puede
        // faltar aquí es que ya estuviera en un Consolidado o que el hotel
        // no llegue aún a su corte (Hugo, 2026-10-15: texto más corto).
        toast.success(t`Nada que cerrar: ya estaba pagado o aún no llega su corte.`, {
          icon: <img src={personajeCronograma} alt="" className="size-8" />,
        })
        close()
        return
      }
      setStep(2)
    } catch (error) {
      toast.error(apiErrorMessage(error, { fallback: t`No se pudo cerrar la semana. Reintenta.` }))
    }
  }

  function invoiceItems(): InvoiceLineItem[] {
    return (timesheets ?? []).map((sheet) => {
      const preview = sheet.payPreview
      return {
        workerName: sheet.worker.fullName,
        regularHours: (preview?.regularMinutes ?? 0) / 60,
        overtimeHours: (preview?.overtimeMinutes ?? 0) / 60,
        payRate:
          preview?.payRate !== null && preview?.payRate !== undefined
            ? Number(preview.payRate)
            : null,
        billRate:
          preview?.billRate !== null && preview?.billRate !== undefined
            ? Number(preview.billRate)
            : null,
        paySubtotal:
          preview?.subtotal !== null && preview?.subtotal !== undefined
            ? Number(preview.subtotal)
            : null,
        billSubtotal:
          preview?.billSubtotal !== null && preview?.billSubtotal !== undefined
            ? Number(preview.billSubtotal)
            : null,
      }
    })
  }

  function handleDownload(format: 'pdf' | 'csv'): void {
    if (!hotelName) return
    const items = invoiceItems()
    const input = {
      hotelName,
      hotelAddress: null,
      weekStart,
      weekEnd,
      items,
    }
    if (format === 'pdf') {
      void downloadInvoicePdf(input)
    } else {
      downloadInvoiceCsv(input)
    }
  }

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="secondary"
                disabled={!hotelId || isRunning || isBlocked}
                onClick={() => {
                  setStep(1)
                }}
              >
                <Trans>Cerrar semana</Trans>
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className={isBlocked ? 'max-w-64' : undefined}>
            {!hotelId ? (
              <Trans>Elige un hotel para cerrar su semana</Trans>
            ) : isBlocked ? (
              // Quién y por qué, no solo "faltan aprobaciones" — así se sabe
              // a quién ir a buscar sin adivinar (Hugo, 2026-10-15: "si es
              // por una aprobación faltante, mostrar de quiénes").
              <div className="flex flex-col gap-1">
                <p className="font-semibold">
                  <Trans>Falta aprobar antes de cerrar:</Trans>
                </p>
                <ul className="list-disc pl-4">
                  {blocked.map((item) => (
                    <li key={item.name}>
                      {item.name} ·{' '}
                      {item.status === 'OPEN' ? (
                        <Trans>sin enviar a revisión</Trans>
                      ) : (
                        <Trans>esperando al Manager</Trans>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <Trans>Paga las horas aprobadas de este hotel esta semana</Trans>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Modal
        isOpen={isOpen}
        onClose={close}
        title={t`Cerrar semana`}
        chromeless
        className="max-w-3xl"
      >
        <div className="grid max-h-[calc(100vh-3rem)] grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="relative hidden overflow-hidden md:block">
            <HotelPhotoBackdrop photoUrl={hotelCard?.photoUrl} />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/30 to-ink/5"
            />
            <div className="relative flex h-full flex-col justify-end gap-2 p-5 text-surface">
              <p className="text-xl leading-tight font-bold">{hotelName}</p>
              <p className="text-sm text-surface/85">
                <Trans>Semana {formatWeekRange(weekStart, weekEnd)}</Trans>
              </p>
            </div>
          </aside>

          <section className="flex max-h-[calc(100vh-3rem)] min-w-0 flex-col">
            <header className="border-b border-line px-6 py-5">
              <h2 className="text-xl font-bold text-ink">
                <Trans>Cerrar semana</Trans>
              </h2>
              {/* Sin los 3 círculos numerados — ESTE botón ya ejecuta la
                  acción real en el primer tramo, no solo "confirma y avanza"
                  como los wizards de alta; un indicador de pasos ahí prometía
                  navegación que no existe (Hugo, 2026-10-15: "entonces
                  mostremos 1"). Solo el nombre de dónde está. */}
              <p className="mt-1 text-sm text-ink-3">{i18n._(STEP_LABEL[step === 0 ? 1 : step])}</p>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {step === 1 && (
                <div className="flex flex-col gap-4">
                  {/* Dos situaciones, dos textos — "repetirlo no duplica
                      nada" solo tiene sentido si YA hay algo que repetir; con
                      nada cerrado todavía sonaba a que ya se había corrido
                      (Hugo, 2026-10-15: contradecía "todavía no se ha
                      cerrado nada", justo abajo). */}
                  {alreadyRan ? (
                    <>
                      <p className="text-sm font-semibold text-ink">
                        <Trans>Esta semana ya está cerrada.</Trans>
                      </p>
                      <div className="rounded-lg bg-surface-2 p-3 text-sm text-ink-2">
                        <Trans>
                          Ya se cerraron {rows.length} hojas esta semana, por{' '}
                          {formatMoney(totalNet)} neto.
                        </Trans>
                      </div>
                      <p className="text-sm text-ink-2">
                        <Trans>
                          Volver a correrla solo agrega lo que {hotelName} aprobó después de la
                          última vez — no duplica nada de lo que ya está cerrado.
                        </Trans>
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-ink-2">
                      <Trans>Paga las horas ya aprobadas de {hotelName} esta semana.</Trans>
                    </p>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-ink-3">
                    <Trans>Así quedó en Borrador, antes de validar y autorizar.</Trans>
                  </p>
                  <div className="max-h-72 overflow-y-auto rounded-lg border border-line">
                    <Table className="min-w-full text-left">
                      <TableHeader>
                        <TableRow className="border-line">
                          {[t`Colaborador`, t`Bruto`, t`Deducciones`, t`Neto`].map((header) => (
                            <TableHead
                              key={header}
                              scope="col"
                              className="px-3 py-2 text-xs font-semibold tracking-wide text-ink-3 uppercase"
                            >
                              {header}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.length === 0 && (
                          <TableRow className="border-line">
                            <TableCell
                              colSpan={4}
                              className="px-3 py-6 text-center text-sm text-ink-3"
                            >
                              <Trans>No se cerró nada esta vez.</Trans>
                            </TableCell>
                          </TableRow>
                        )}
                        {rows.map((row) => (
                          <TableRow key={row.id} className="border-line">
                            <TableCell className="px-3 py-2 text-sm font-semibold text-ink">
                              <Link
                                to={`/accounting/consolidations/${row.id}`}
                                className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-o-500"
                              >
                                {row.worker.fullName}
                              </Link>
                            </TableCell>
                            <TableCell className="px-3 py-2 text-sm text-ink-3">
                              {money(row.grossAmount)}
                            </TableCell>
                            <TableCell className="px-3 py-2 text-sm text-ink-3">
                              {money(row.deductionAmount)}
                            </TableCell>
                            <TableCell className="px-3 py-2 text-sm font-semibold text-ink">
                              {money(row.netAmount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {rows.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">
                      <span className="text-ink-3">
                        <Trans>{rows.length} colaboradores</Trans>
                      </span>
                      <span className="flex flex-wrap gap-3">
                        <span className="text-ink-3">
                          <Trans>Bruto {formatMoney(totalGross)}</Trans>
                        </span>
                        <span className="text-ink-3">
                          <Trans>Deducciones {formatMoney(totalDeductions)}</Trans>
                        </span>
                        <span className="font-semibold text-ink">
                          <Trans>Neto {formatMoney(totalNet)}</Trans>
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="flex flex-col gap-4">
                  <p className="text-sm text-ink-2">
                    <Trans>
                      Pago y facturación de {hotelName} esta semana, listos para bajar — el mismo
                      cuadro de "Lo que el hotel nos paga" en un archivo.
                    </Trans>
                  </p>
                  {isLoadingInvoice ? (
                    <p className="text-sm text-ink-3">
                      <Trans>Cargando…</Trans>
                    </p>
                  ) : (
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => {
                          handleDownload('pdf')
                        }}
                        className="flex flex-1 cursor-pointer flex-col items-center gap-2 rounded-lg border border-line bg-surface p-5 text-center transition-colors hover:bg-surface-2"
                      >
                        <MaterialIcon name="picture_as_pdf" className="text-3xl text-o-700" />
                        <span className="text-sm font-semibold text-ink">
                          <Trans>Descargar PDF</Trans>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleDownload('csv')
                        }}
                        className="flex flex-1 cursor-pointer flex-col items-center gap-2 rounded-lg border border-line bg-surface p-5 text-center transition-colors hover:bg-surface-2"
                      >
                        <MaterialIcon name="table_view" className="text-3xl text-o-700" />
                        <span className="text-sm font-semibold text-ink">
                          <Trans>Descargar Excel</Trans>
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <footer className="flex items-center justify-between gap-2 border-t border-line px-6 py-4">
              <Button variant="secondary" onClick={close}>
                {step === 3 ? <Trans>Cerrar</Trans> : <Trans>Cancelar</Trans>}
              </Button>
              {step === 1 && (
                <Button variant="primary" disabled={isRunning} onClick={() => void confirm()}>
                  {isRunning ? (
                    <Trans>Cerrando…</Trans>
                  ) : alreadyRan ? (
                    <Trans>Sí, volver a correr</Trans>
                  ) : (
                    <Trans>Sí, cerrar</Trans>
                  )}
                </Button>
              )}
              {step === 2 && (
                <Button
                  variant="primary"
                  onClick={() => {
                    setStep(3)
                  }}
                >
                  <Trans>Siguiente</Trans>
                </Button>
              )}
            </footer>
          </section>
        </div>
      </Modal>
    </>
  )
}
