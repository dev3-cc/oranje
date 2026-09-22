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

/**
 * El prestador del servicio en todos los acuerdos: la entidad legal que
 * factura y emplea, no la marca (Hugo, 2026-09-22, trajo el machote real de
 * Strategic Deployment, LLC — reemplaza el nombre y la dirección anteriores).
 */
const PROVIDER = 'Strategic Deployment, LLC'
const PROVIDER_ADDRESS = '730 Peachtree St NE, Suite 570, Atlanta, GA 30308'

/**
 * El encabezado del Exhibit «A»: el MISMO texto para todos los hoteles (lo
 * confirmó Hugo), así que vive en la plantilla y no como dato por propuesta.
 * Transcrito del machote real (Strategic Deployment, LLC), en inglés como el
 * resto del documento.
 */
const EXHIBIT_HEADER =
  `All personnel furnished under the Agreement are employees of ${PROVIDER}. Service Provider ` +
  'will administer payroll and applicable payroll taxes and maintain workers’ compensation and ' +
  'general liability coverage as stated in the Agreement. Employee screening will be performed ' +
  'in accordance with Section 13.'

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
        <h3 className="text-lg font-bold text-ink uppercase">Service Agreement</h3>
      </header>

      <p className="mt-5 text-sm leading-relaxed text-ink-2">
        This Service Agreement (“Agreement”) is between{' '}
        <span className="font-semibold text-ink">{PROVIDER}</span>, a Georgia limited liability
        company, {PROVIDER_ADDRESS} (“Service Provider”), and{' '}
        <span className="font-semibold text-ink">{hotelName}</span>
        {hotelAddress ? `, ${hotelAddress}` : ''} (“Company”).
      </p>

      <p className="mt-3 text-sm leading-relaxed text-ink-2">
        WHEREAS, Company desires to engage Service Provider to provide staffing and related
        services, and Service Provider agrees to provide such services under the following terms.
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
            <p className="font-semibold text-ink">Service Provider:</p>
            <p>{PROVIDER},</p>
            <p>{PROVIDER_ADDRESS}.</p>
            <p>Email: ______________________________.</p>
          </div>
          <div>
            <p className="font-semibold text-ink">Company:</p>
            <p>{hotelName}</p>
            {hotelAddress && <p>{hotelAddress}</p>}
            <p>Email: ______________________________.</p>
          </div>
        </div>
      </section>

      {/* Sin firmas: las líneas van en blanco a propósito. */}
      <section className="mt-8">
        <h4 className="text-sm font-bold tracking-wide text-ink uppercase">Signatures</h4>
        <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-ink">{PROVIDER}</p>
            <p className="mt-6 text-xs text-ink-3">
              By: ______________________________ Date: ____________
            </p>
            <p className="mt-4 text-xs text-ink-3">Name/Title: ______________________________</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">{hotelName}</p>
            <p className="mt-6 text-xs text-ink-3">
              By: ______________________________ Date: ____________
            </p>
            <p className="mt-4 text-xs text-ink-3">Name/Title: ______________________________</p>
          </div>
        </div>
      </section>

      {/* El Exhibit «A» arranca en su propia hoja al imprimir. */}
      <section className="mt-10 break-before-page">
        <h4 className="text-center text-sm font-bold text-ink uppercase underline">
          Exhibit “A” - Rates and Staffing Terms
        </h4>
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
            Overtime: billed in accordance with Section 5 — {terms.overtime.bill.toFixed(2)}× bill
            rate and {terms.overtime.pay.toFixed(2)}× pay rate. Holidays:{' '}
            {terms.holiday.bill.toFixed(2)}× bill rate and {terms.holiday.pay.toFixed(2)}× pay rate.
          </p>
        )}

        {servicesNote && (
          <p className="mt-4 text-xs leading-relaxed text-ink-3">
            Scope of services: {servicesNote}
          </p>
        )}

        <p className="mt-6 text-center text-sm font-bold text-ink">
          I AGREE TO THE RATES AND TERMS IN THIS EXHIBIT “A”
        </p>

        <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-ink">Company Representative:</p>
            <p className="mt-6 text-xs text-ink-3">
              Name &amp; Signature: ______________________________ Date: __________
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-ink">Service Provider Representative:</p>
            <p className="mt-6 text-xs text-ink-3">
              Name &amp; Signature: ______________________________ Date: __________
            </p>
          </div>
        </div>
      </section>
    </article>
  )
}
