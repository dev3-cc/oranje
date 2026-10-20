import type { ReactNode } from 'react'

import { formatMoney } from '../lib/formatters'
import {
  CLIENT_ACCEPTANCE_INTRO,
  CORE_POSITIONS,
  COMMERCIAL_TERMS,
  FOOTER_SLOGAN,
  INTRO_PARAGRAPH_1,
  INTRO_PARAGRAPH_2,
  NEXT_STEPS,
  OBJECTIVE_NOTE,
  PARTNERSHIP_INTRO,
  preparedDateUs,
  PRICING_NOTE,
  PROCESS_STEPS,
  TAGLINE,
  WHAT_YOU_CAN_EXPECT,
  WORKFORCE_SYSTEM_BODY,
  WORKFORCE_SYSTEM_FLOW,
  WORKFORCE_SYSTEM_TITLE,
  type ProposalDocumentInput,
} from '../lib/proposalDocument'

import logoOrange from '@/assets/logo/Logo_ORANJE_Orange.png'

/**
 * La propuesta comercial que ve el hotel, en vivo: lo que se escribe a la
 * izquierda del editor se refleja aquí sin pedir nada al servidor — el mismo
 * contenido que `buildProposalPdf` y `downloadProposalDocx` generan como
 * archivo (una sola fuente de verdad en `shared/lib/proposalDocument.ts`).
 *
 * A diferencia de `ContractDocument` (el Service Agreement firmado), este
 * documento es ANTES de firmar nada: el cuadro muestra solo el bill rate — el
 * pay rate es el margen interno de Oranje.
 */
export function ProposalDocument({
  hotelName,
  rates,
  senderName,
  propertyName,
  preparedDate,
  brandManagementCompany,
  cityState,
  contactName,
  senderPhone,
  senderEmail,
}: ProposalDocumentInput): ReactNode {
  return (
    <article className="text-ink">
      <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
        <img src={logoOrange} alt="ORANJE PEOPLE" className="h-5 w-auto" />
        <span className="text-xs font-bold tracking-wide text-ink-3 uppercase">
          Hospitality Staffing
        </span>
      </div>

      <header>
        <h3 className="text-sm font-bold tracking-wide text-ink uppercase">
          Staffing Partnership Proposal
        </h3>
        {/* [PROPERTY NAME]: el texto más grande de todo el machote, por mucho.
            `break-words` porque un nombre/marca largo no debe salirse de la
            tarjeta (Hugo, 2026-10-19). */}
        <p className="mt-1 text-4xl font-bold break-words text-ink">{propertyName || hotelName}</p>
        {brandManagementCompany && (
          <p className="mt-1 text-xl font-bold break-words text-ink-2">{brandManagementCompany}</p>
        )}
        {cityState && <p className="text-sm break-words text-ink-3">{cityState}</p>}
        <p className="mt-2 text-sm text-ink-3 italic">{TAGLINE}</p>
        <p className="mt-1 text-sm text-ink-3 italic">
          Prepared {preparedDate || preparedDateUs()}
        </p>
      </header>

      {contactName && (
        <p className="mt-4 text-sm font-semibold break-words text-ink">Dear {contactName},</p>
      )}

      <p className="mt-3 text-sm leading-relaxed text-ink-2">{INTRO_PARAGRAPH_1}</p>
      <p className="mt-3 text-sm leading-relaxed text-ink-2">{INTRO_PARAGRAPH_2}</p>

      <Callout>
        <p className="font-bold">{OBJECTIVE_NOTE}</p>
      </Callout>

      <Section title="What You Can Expect">
        <ul className="flex flex-col gap-1.5">
          {WHAT_YOU_CAN_EXPECT.map((line) => (
            <li key={line} className="flex gap-2 text-sm leading-relaxed text-ink-2">
              <span aria-hidden>•</span>
              {line}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="A More Accountable Staffing Model">
        <ol className="flex flex-col gap-4">
          {PROCESS_STEPS.map((step, index) => (
            <li key={step.title} className="text-sm leading-relaxed text-ink-2">
              <span className="font-bold text-ink">
                {index + 1}. {step.title}
              </span>
              <p className="mt-1">{step.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Core Positions We Can Support">
        <p className="text-sm leading-relaxed text-ink-2">{CORE_POSITIONS}</p>
      </Section>

      <Callout>
        <p className="font-bold text-o-700">{WORKFORCE_SYSTEM_TITLE}</p>
        <p className="mt-1 font-bold">{WORKFORCE_SYSTEM_FLOW}</p>
        <p className="mt-1 font-normal">{WORKFORCE_SYSTEM_BODY}</p>
      </Callout>

      <Section title="Proposed Rate Schedule">
        <p className="text-xs text-ink-3">
          Client-specific bill rates are customized based on market, role, staffing volume,
          schedule, and scope of service.
        </p>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-3 uppercase">
              <th className="py-2 font-semibold">Position</th>
              <th className="py-2 text-right font-semibold">Regular Hourly Bill Rate</th>
            </tr>
          </thead>
          <tbody>
            {rates.length === 0 ? (
              <tr>
                <td colSpan={2} className="py-3 text-sm text-ink-3">
                  Add at least one position to quote it here.
                </td>
              </tr>
            ) : (
              rates.map((rate) => (
                <tr key={rate.key} className="border-b border-line">
                  <td className="py-2 text-ink">{rate.positionName}</td>
                  <td className="py-2 text-right text-ink">{formatMoney(rate.billRate)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Section>

      <Section title="Commercial Terms">
        <ul className="flex flex-col gap-2">
          {COMMERCIAL_TERMS.map((line) => (
            <li key={line} className="text-sm leading-relaxed text-ink-2">
              {line}
            </li>
          ))}
        </ul>
      </Section>

      <Callout>
        <p className="font-bold">{PRICING_NOTE}</p>
      </Callout>

      <Section title="Partnership & Acceptance">
        <p className="text-sm leading-relaxed text-ink-2">{PARTNERSHIP_INTRO}</p>
        <p className="mt-4 text-sm font-bold text-ink">Next Steps</p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {NEXT_STEPS.map((line) => (
            <li key={line} className="flex gap-2 text-sm leading-relaxed text-ink-2">
              <span aria-hidden>•</span>
              {line}
            </li>
          ))}
        </ul>
      </Section>

      <section className="mt-8">
        <h4 className="border-b border-line pb-2 text-sm font-bold tracking-wide text-ink uppercase">
          Client Acceptance
        </h4>
        <p className="mt-4 text-sm leading-relaxed text-ink-2">{CLIENT_ACCEPTANCE_INTRO}</p>
        <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-ink">Client Authorized Representative</p>
            <p className="mt-6 text-xs text-ink-3">
              Printed Name / Title: ______________________________
            </p>
            <p className="mt-4 text-xs text-ink-3">Signature: ______________________________</p>
            <p className="mt-4 text-xs text-ink-3">Date: ______________________________</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-ink">ORANJE PEOPLE</p>
            <p className="mt-6 text-xs text-ink-3">
              Printed Name / Title: ______________________________
            </p>
            <p className="mt-4 text-xs text-ink-3">Signature: ______________________________</p>
            <p className="mt-4 text-xs text-ink-3">Date: ______________________________</p>
          </div>
        </div>
      </section>

      <footer className="mt-8 flex items-start justify-between border-t border-line pt-4 text-xs text-ink-3">
        <span className="italic">{FOOTER_SLOGAN}</span>
        <div className="text-right not-italic">
          <p className="font-semibold text-ink">{senderName}</p>
          <p>ORANJE PEOPLE Business Development</p>
          {senderPhone && <p>{senderPhone}</p>}
          {senderEmail && <p>{senderEmail}</p>}
        </div>
      </footer>
    </article>
  )
}

/** La caja gris con borde naranja del machote ("Our objective", el
    workforce system, "Pricing note"): fondo + barra lateral, nunca solo texto. */
function Callout({ children }: { children: ReactNode }): ReactNode {
  return (
    <div className="mt-6 rounded-md border-l-4 border-o-500 bg-surface-2 px-4 py-3 text-sm leading-relaxed text-ink-2">
      {children}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <section className="mt-8">
      <h4 className="border-b border-line pb-2 text-sm font-bold tracking-wide text-ink uppercase">
        {title}
      </h4>
      <div className="mt-4">{children}</div>
    </section>
  )
}
