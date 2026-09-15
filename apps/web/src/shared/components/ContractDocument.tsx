import { Table, TableBody, TableCell, TableHead, TableRow } from '@oranje/ui'
import type { ReactNode } from 'react'

import { CONTRACT_CLAUSES } from '@/shared/lib/contractClauses'
import { formatMoney } from '@/shared/lib/formatters'

/** Un renglón del Exhibit «A», venga de la propuesta o del contrato firmado. */
export interface DocumentRate {
  key: string
  positionName: string
  payRate: number
  billRate: number
}

/** Los recargos pactados; solo el contrato los tiene. */
export interface DocumentTerms {
  overtime: { pay: number; bill: number }
  holiday: { pay: number; bill: number }
}

/** El prestador del servicio en todos los acuerdos. */
const PROVIDER = 'Oranje'

/**
 * El encabezado del Exhibit «A»: el MISMO texto para todos los hoteles (lo
 * confirmó Hugo), así que vive en la plantilla y no como dato por propuesta.
 * Transcrito del acuerdo vigente, en inglés como el resto del documento.
 */
const EXHIBIT_HEADER =
  'All Employees governed under the Service Agreement are employees of Oranje and cannot be ' +
  'hired by your property directly or indirectly or moved to another vendor. All employees are ' +
  'screened including but not limited to drug screens, criminal background checks, I-9 ' +
  'verification. Oranje is responsible and will prepare, report & remit all payroll data and ' +
  'payroll taxes. This includes worker’s compensation and general liability insurance, federal ' +
  '& state income tax, social security, medicare, federal & state unemployment taxes and ACA ' +
  'Compliant. Oranje will also provide orientation to all employees of our safety program, also ' +
  'the standards of each client/customer.'

/** `2026-09-15` → `09/15/2026`, la forma del acuerdo original. */
function usDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${month ?? ''}/${day ?? ''}/${year ?? ''}`
}

function todayIso(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${String(now.getFullYear())}-${month}-${day}`
}

/** Un año menos un día desde el inicio: el Term del acuerdo. */
function oneYearLater(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  const end = new Date((year ?? 0) + 1, (month ?? 1) - 1, (day ?? 1) - 1)
  const m = String(end.getMonth() + 1).padStart(2, '0')
  const d = String(end.getDate()).padStart(2, '0')
  return `${String(end.getFullYear())}-${m}-${d}`
}

/**
 * El acuerdo de servicio completo, armado con los datos de la propuesta: el
 * mismo documento que Oranje firma hoy con sus hoteles, con su clausulado
 * íntegro y su Exhibit «A».
 *
 * **Sale sin firmas a propósito** (decisión de Hugo): las líneas quedan en
 * blanco para firmar sobre el papel o en un firmador aparte. La app no firma
 * nada ni guarda firmas.
 *
 * Va en inglés porque es el documento que firma un hotel en Georgia y la ley
 * aplicable es la de ese estado; los rótulos de la app alrededor siguen en
 * español.
 */
export function ContractDocument({
  hotelName,
  hotelAddress = null,
  rates,
  servicesNote = null,
  startDate = todayIso(),
  endDate = null,
  terms = null,
}: {
  hotelName: string
  hotelAddress?: string | null
  /** El cuadro del Exhibit «A». */
  rates: DocumentRate[]
  servicesNote?: string | null
  /** Inicio del Term; por defecto, el día en que se genera el documento. */
  startDate?: string
  /** Fin del Term; sin él se calcula el año que manda la cláusula 1. */
  endDate?: string | null
  terms?: DocumentTerms | null
}): ReactNode {
  const fill = (text: string): string =>
    text
      .replace('{startDate}', usDate(startDate))
      .replace('{endDate}', usDate(endDate ?? oneYearLater(startDate)))
      .replace('{provider}', PROVIDER)

  return (
    <article className="text-ink">
      <header className="text-center">
        <h3 className="text-lg font-bold text-ink">Service Agreement</h3>
      </header>

      <p className="mt-5 text-sm leading-relaxed text-ink-2">
        This Service Agreement is made and entered into by and between{' '}
        <span className="font-semibold text-ink">{PROVIDER}</span> (“Service Provider”) and{' '}
        <span className="font-semibold text-ink">{hotelName}</span>
        {hotelAddress ? ` located at ${hotelAddress}` : ''} (“Company”).
      </p>

      <p className="mt-3 text-sm leading-relaxed text-ink-2">
        WHEREAS, <span className="font-semibold text-ink">{hotelName}</span> (Company) wishes to
        engage {PROVIDER} (“Service Provider”) to provide certain services to Company described
        herein and “Service Provider” makes agreement to provide Company services for the
        reimbursement and otherwise in harmony with the terms and conditions of this Agreement.
      </p>

      <p className="mt-3 text-sm leading-relaxed text-ink-2">
        NOW THEREFORE, in consideration of the prior, and for other good and valuable consideration,
        the receipt and adequacy of which are hereby recognized, acknowledged and approved, Company
        and “Service Provider”, aiming to be officially bound, agree to the terms set forth below.
      </p>

      <ol className="mt-6 flex list-decimal flex-col gap-5 pl-5">
        {CONTRACT_CLAUSES.map((clause) => (
          <li key={clause.title} className="text-sm leading-relaxed text-ink-2">
            <span className="font-bold text-ink">{clause.title}.</span>
            {clause.paragraphs.map((paragraph, index) => (
              <p key={index} className={index === 0 ? 'mt-1' : 'mt-2'}>
                {fill(paragraph)}
              </p>
            ))}
          </li>
        ))}
      </ol>

      <section className="mt-8">
        <h4 className="text-sm font-bold tracking-wide text-ink uppercase">Notices</h4>
        <div className="mt-3 grid grid-cols-1 gap-4 text-sm text-ink-2 sm:grid-cols-2">
          <div>
            <p className="font-semibold text-ink">Notice to Service Provider:</p>
            <p>{PROVIDER}</p>
          </div>
          <div>
            <p className="font-semibold text-ink">Notice to Company:</p>
            <p>{hotelName}</p>
            {hotelAddress && <p>{hotelAddress}</p>}
          </div>
        </div>
      </section>

      {/* Sin firmas: las líneas van en blanco a propósito. */}
      <section className="mt-8">
        <p className="text-sm text-ink-2">
          EXECUTED: by the Parties under seal, by their duty authorized representatives, as of the
          Effective Date.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-ink">{PROVIDER}</p>
            <div className="mt-10 border-b border-ink-3" />
            <p className="mt-2 text-xs text-ink-3">By (print name and signature)</p>
            <div className="mt-6 border-b border-ink-3" />
            <p className="mt-2 text-xs text-ink-3">Title</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">{hotelName}</p>
            <div className="mt-10 border-b border-ink-3" />
            <p className="mt-2 text-xs text-ink-3">By (print name and signature)</p>
            <div className="mt-6 border-b border-ink-3" />
            <p className="mt-2 text-xs text-ink-3">Title</p>
          </div>
        </div>
      </section>

      {/* El Exhibit «A» arranca en su propia hoja al imprimir. */}
      <section className="mt-10 break-before-page">
        <h4 className="text-center text-sm font-bold text-ink underline">Exhibit “A”</h4>
        <p className="mt-4 text-xs leading-relaxed text-ink-3">{EXHIBIT_HEADER}</p>

        <div className="mt-6 text-center">
          <p className="text-sm font-bold text-ink">{hotelName}</p>
          {hotelAddress && <p className="text-xs text-ink-3">{hotelAddress}</p>}
        </div>

        <h5 className="mt-6 text-center text-sm font-bold tracking-wide text-ink uppercase">
          Rates by department
        </h5>

        <Table className="mt-3 text-sm">
          <TableBody>
            <TableRow className="border-line">
              <TableHead scope="col" className="h-auto px-0 py-2.5 text-left text-xs text-ink-3">
                Position
              </TableHead>
              <TableHead scope="col" className="h-auto px-0 py-2.5 text-right text-xs text-ink-3">
                Hourly Pay Rate
              </TableHead>
              <TableHead scope="col" className="h-auto px-0 py-2.5 text-right text-xs text-ink-3">
                Hourly Bill Rate
              </TableHead>
            </TableRow>
            {rates.map((rate) => (
              <TableRow key={rate.key} className="border-line">
                <TableCell className="px-0 py-2.5 text-ink">{rate.positionName}</TableCell>
                <TableCell className="px-0 py-2.5 text-right text-ink">
                  {formatMoney(rate.payRate)}
                </TableCell>
                <TableCell className="px-0 py-2.5 text-right text-ink">
                  {formatMoney(rate.billRate)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {terms && (
          <p className="mt-3 text-xs leading-relaxed text-ink-3">
            Overtime: {terms.overtime.bill.toFixed(2)}× bill rate and{' '}
            {terms.overtime.pay.toFixed(2)}× pay rate. Holidays: {terms.holiday.bill.toFixed(2)}×
            bill rate and {terms.holiday.pay.toFixed(2)}× pay rate.
          </p>
        )}

        {servicesNote && (
          <p className="mt-4 text-xs leading-relaxed text-ink-3">
            Scope of services: {servicesNote}
          </p>
        )}

        <p className="mt-6 text-center text-sm font-bold text-ink">
          I AGREE TO THE RATES IN THIS EXHIBIT “A”
        </p>

        <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div>
            <div className="border-b border-ink-3" />
            <p className="mt-2 text-xs text-ink-3">Signature · {hotelName}</p>
          </div>
          <div>
            <div className="border-b border-ink-3" />
            <p className="mt-2 text-xs text-ink-3">Signature · {PROVIDER}</p>
          </div>
        </div>
      </section>
    </article>
  )
}
