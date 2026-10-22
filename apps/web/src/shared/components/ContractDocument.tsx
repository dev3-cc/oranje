import { Table, TableBody, TableCell, TableHead, TableRow } from '@oranje/ui'
import type { ReactNode } from 'react'

import logoOrange from '@/assets/logo/Logo_ORANJE_Orange.png'
import { CONTRACT_CLAUSES } from '@/shared/lib/contractClauses'
import { formatMoney } from '@/shared/lib/formatters'

/** Un renglón del Exhibit «A», venga de la propuesta o del contrato firmado.
    Sin `payRate`: el machote real (igual que la Propuesta) solo le enseña al
    hotel el bill rate — el pay rate es margen interno de Oranje. */
export interface DocumentRate {
  key: string
  positionName: string
  billRate: number
}

/**
 * El prestador del servicio en todos los acuerdos: la entidad legal que
 * factura y emplea, no la marca (Hugo, 2026-10-14, trajo el machote real de
 * ORANGE SOLUTIONS & OPERATIONS, LLC — reemplaza a Strategic Deployment, LLC
 * del 2026-09-22; la dirección no cambió).
 */
export const PROVIDER = 'ORANGE SOLUTIONS & OPERATIONS, LLC'
export const PROVIDER_ADDRESS = '730 Peachtree St NE, Suite 570, Atlanta, GA 30308'

/**
 * El encabezado del Exhibit «A»: el MISMO texto para todos los hoteles (lo
 * confirmó Hugo), así que vive en la plantilla y no como dato por propuesta.
 * Transcrito del machote real (ORANGE SOLUTIONS & OPERATIONS, LLC), en inglés
 * como el resto del documento.
 */
export function exhibitHeader(provider: string = PROVIDER): string {
  return (
    `All personnel furnished under the Agreement are employees of ${provider}. Service Provider ` +
    'will administer payroll and applicable payroll taxes and maintain workers’ compensation and ' +
    'general liability coverage as stated in the Agreement. Employee screening will be performed ' +
    'in accordance with Section 13.'
  )
}

/** Transcrito del machote real: sin números de multiplicador — ni el de pago
    (interno) ni el de cobro — solo la referencia a la cláusula 5. */
export const OVERTIME_NOTE =
  'Overtime: Billed in accordance with Section 5. The applicable service markup will be applied ' +
  'to the employee’s actual overtime wage cost, together with applicable payroll burden and ' +
  'legally required costs, unless otherwise agreed in writing.'

/**
 * Separa el `(a)` inicial de un párrafo de cláusula, para pintarlo en
 * negrita como el machote real — el resto del párrafo sigue en texto normal.
 * Sin el prefijo (no debería pasar, los 17 párrafos del machote lo traen
 * todos), regresa el texto completo tal cual.
 */
export function splitClauseMarker(paragraph: string): { marker: string | null; rest: string } {
  const match = /^(\([a-z]\))\s(.*)$/s.exec(paragraph)
  return match
    ? { marker: match[1] ?? null, rest: match[2] ?? '' }
    : { marker: null, rest: paragraph }
}

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
  propertyName = null,
  propertyAddress = null,
  companyEmail = null,
  serviceProviderName = null,
  serviceProviderEmail = null,
  rates,
  servicesNote = null,
  startDate = todayIso(),
  endDate = null,
}: {
  hotelName: string
  /** [PROPERTY NAME] del machote; cae en `hotelName` si no hay override. */
  propertyName?: string | null
  propertyAddress?: string | null
  companyEmail?: string | null
  /** Hoy fijos en código (`PROVIDER`/`PROVIDER_ADDRESS`): nulo = usa esos valores. */
  serviceProviderName?: string | null
  serviceProviderEmail?: string | null
  /** El cuadro del Exhibit «A». */
  rates: DocumentRate[]
  servicesNote?: string | null
  /** Inicio del Term; por defecto, el día en que se genera el documento. */
  startDate?: string
  /** Fin del Term; sin él se calcula el año que manda la cláusula 1. */
  endDate?: string | null
}): ReactNode {
  const provider = serviceProviderName || PROVIDER
  const displayName = propertyName || hotelName

  const fill = (text: string): string =>
    text
      .replace('{startDate}', usDate(startDate))
      .replace('{endDate}', usDate(endDate ?? oneYearLater(startDate)))
      .replace('{provider}', provider)

  return (
    <article className="text-ink">
      {/* Mismo encabezado que la Propuesta (Hugo, 2026-10-21): el machote
          real no lo trae, es una adición deliberada, no una corrección. */}
      <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
        <img src={logoOrange} alt="ORANJE PEOPLE" className="h-5 w-auto" />
        <span className="text-xs font-bold tracking-wide text-ink-3 uppercase">
          Hospitality Staffing
        </span>
      </div>

      <header className="text-center">
        <h3 className="text-lg font-bold text-ink uppercase">Service Agreement</h3>
      </header>

      <p className="mt-5 text-sm leading-relaxed text-ink-2">
        This Service Agreement (“Agreement”) is between{' '}
        <span className="font-semibold text-ink">{provider}</span>, a Georgia limited liability
        company, {PROVIDER_ADDRESS} (“Service Provider”), and{' '}
        <span className="font-semibold text-ink">{displayName}</span>
        {propertyAddress ? `, ${propertyAddress}` : ''} (“Company”).
      </p>

      <p className="mt-3 text-sm leading-relaxed text-ink-2">
        WHEREAS, Company desires to engage Service Provider to provide staffing and related
        services, and Service Provider agrees to provide such services under the following terms.
      </p>

      <ol className="mt-6 flex list-decimal flex-col gap-5 pl-5 marker:font-bold marker:text-ink">
        {CONTRACT_CLAUSES.map((clause) => (
          <li key={clause.title} className="text-sm leading-relaxed text-ink-2">
            <span className="font-bold text-ink">{clause.title}</span>
            {clause.paragraphs.map((paragraph, index) => {
              const { marker, rest } = splitClauseMarker(fill(paragraph))
              return (
                <p key={index} className={index === 0 ? 'mt-1' : 'mt-2'}>
                  {marker && <span className="font-bold text-ink">{marker}</span>}
                  {marker ? ` ${rest}` : rest}
                </p>
              )
            })}
          </li>
        ))}
      </ol>

      <section className="mt-8">
        <h4 className="text-sm font-bold tracking-wide text-ink uppercase">Notices</h4>
        <div className="mt-3 grid grid-cols-1 gap-4 text-sm text-ink-2 sm:grid-cols-2">
          <div>
            <p className="font-semibold text-ink">Service Provider:</p>
            <p>{provider},</p>
            <p>{PROVIDER_ADDRESS}.</p>
            <p>Email: {serviceProviderEmail || <span>______________________________</span>}.</p>
          </div>
          <div>
            <p className="font-semibold text-ink">Company:</p>
            <p>{displayName}</p>
            {propertyAddress && <p>{propertyAddress}</p>}
            <p>Email: {companyEmail || <span>______________________________</span>}.</p>
          </div>
        </div>
      </section>

      {/* Sin firmas: las líneas van en blanco a propósito. */}
      <section className="mt-8">
        <h4 className="text-sm font-bold tracking-wide text-ink uppercase">Signatures</h4>
        <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-ink">{provider}</p>
            <p className="mt-6 text-xs text-ink-3">
              By: ______________________________ Date: ____________
            </p>
            <p className="mt-4 text-xs text-ink-3">Name/Title: ______________________________</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">{displayName}</p>
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
          Exhibit “A” - Rates
        </h4>
        <p className="mt-4 text-xs leading-relaxed text-ink-3">{exhibitHeader(provider)}</p>

        <div className="mt-6 text-center">
          <p className="text-sm font-bold text-ink">{displayName}</p>
          {propertyAddress && <p className="text-xs text-ink-3">{propertyAddress}</p>}
        </div>

        <Table className="mt-6 text-sm">
          <TableBody>
            {/* Franja negra con texto blanco, igual que el machote real. */}
            <TableRow className="border-none bg-[#1A1108] hover:bg-[#1A1108]">
              <TableHead
                scope="col"
                className="h-auto px-3 py-2.5 text-left text-xs font-bold text-white"
              >
                Position
              </TableHead>
              <TableHead
                scope="col"
                className="h-auto px-3 py-2.5 text-right text-xs font-bold text-white"
              >
                Regular Hourly Bill Rate
              </TableHead>
            </TableRow>
            {rates.map((rate) => (
              <TableRow key={rate.key} className="border-line">
                <TableCell className="px-3 py-2.5 text-ink">{rate.positionName}</TableCell>
                <TableCell className="px-3 py-2.5 text-right text-ink">
                  {formatMoney(rate.billRate)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <p className="mt-3 text-xs leading-relaxed text-ink-3">{OVERTIME_NOTE}</p>

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
