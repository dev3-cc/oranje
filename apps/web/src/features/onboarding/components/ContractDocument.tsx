import { Table, TableBody, TableCell, TableHead, TableRow } from '@oranje/ui'
import type { ReactNode } from 'react'

import type { ProposalVersionSummary } from '../types/proposal.types'

import { formatDate, formatMoney } from '@/shared/lib/formatters'

function todayIso(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export function ContractDocument({
  hotelName,
  version,
}: {
  hotelName: string
  version: ProposalVersionSummary
}): ReactNode {
  const margin = version.billRate - version.payRate
  const marginPercent = version.billRate > 0 ? (margin / version.billRate) * 100 : 0

  return (
    <article className="text-ink">
      <header className="border-b border-line pb-5">
        <p className="text-xs font-bold tracking-[0.2em] text-o-700">ORANJE</p>
        <h3 className="mt-2 text-xl font-bold text-ink">Contrato de prestación de servicios</h3>
        <p className="mt-1 text-sm text-ink-3">Generado el {formatDate(todayIso())}</p>
      </header>

      <p className="mt-5 rounded-md bg-yellow/25 p-4 text-sm font-semibold text-ink">
        VISTA PREVIA SIN VALIDEZ LEGAL — el clausulado es un marcador de posición.
      </p>

      <section className="mt-6">
        <h4 className="text-sm font-bold tracking-wide text-ink uppercase">Partes</h4>
        <dl className="mt-3 flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-6">
            <dt className="text-sm text-ink-3">Prestador del servicio</dt>
            <dd className="text-sm text-ink">Oranje</dd>
          </div>
          <div className="flex items-baseline justify-between gap-6">
            <dt className="text-sm text-ink-3">Cliente</dt>
            <dd className="text-sm text-ink">{hotelName}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-6">
        <h4 className="text-sm font-bold tracking-wide text-ink uppercase">
          Propuesta de referencia
        </h4>
        <dl className="mt-3 flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-6">
            <dt className="text-sm text-ink-3">Versión</dt>
            <dd className="text-sm text-ink">v{version.version}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-6">
            <dt className="text-sm text-ink-3">Estado</dt>
            <dd className="text-sm text-ink">
              {version.status === 'DRAFT' ? 'Borrador sin enviar' : 'Enviada'}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-6">
            <dt className="text-sm text-ink-3">Fecha de envío</dt>
            <dd className="text-sm text-ink">
              {version.sentAt ? formatDate(version.sentAt) : 'Sin enviar'}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-6">
            <dt className="text-sm text-ink-3">Responsable</dt>
            <dd className="text-sm text-ink">{version.byName}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-6">
        <h4 className="text-sm font-bold tracking-wide text-ink uppercase">
          Objeto: servicios ofrecidos
        </h4>
        <p className="mt-3 text-sm leading-relaxed text-ink-2">{version.servicesNote}</p>
      </section>

      <section className="mt-6">
        <h4 className="text-sm font-bold tracking-wide text-ink uppercase">Tarifas</h4>
        <Table className="mt-3 text-sm">
          <TableBody>
            <TableRow className="border-line">
              <TableHead
                scope="row"
                className="h-auto px-0 py-2.5 text-left font-normal text-ink-3"
              >
                Pay rate por hora
              </TableHead>
              <TableCell className="px-0 py-2.5 text-right text-ink">
                {formatMoney(version.payRate)}
              </TableCell>
            </TableRow>
            <TableRow className="border-line">
              <TableHead
                scope="row"
                className="h-auto px-0 py-2.5 text-left font-normal text-ink-3"
              >
                Bill rate por hora
              </TableHead>
              <TableCell className="px-0 py-2.5 text-right text-ink">
                {formatMoney(version.billRate)}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableHead
                scope="row"
                className="h-auto px-0 py-2.5 text-left font-semibold text-ink"
              >
                Margen bruto por hora
              </TableHead>
              <TableCell className="px-0 py-2.5 text-right font-semibold text-ink">
                {formatMoney(margin)} · {marginPercent.toFixed(1)}%
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <p className="mt-2 text-xs text-ink-3">
          Tarifas globales, no por posición. Importes en pesos por hora trabajada.
        </p>
      </section>

      <section className="mt-6">
        <h4 className="text-sm font-bold tracking-wide text-ink uppercase">
          Vigencia y condiciones
        </h4>
        <p className="mt-3 text-sm leading-relaxed text-ink-3">
          Pendiente: el clausulado (vigencia, causales de terminación, penalizaciones y condiciones
          de pago) debe salir de la plantilla de Documentos T&amp;C. Este bloque no se redactó desde
          el front.
        </p>
      </section>

      <footer className="mt-10 grid grid-cols-2 gap-8">
        <div>
          <div className="h-10 border-b border-ink-3" />
          <p className="mt-2 text-xs text-ink-3">Por Oranje</p>
        </div>
        <div>
          <div className="h-10 border-b border-ink-3" />
          <p className="mt-2 text-xs text-ink-3">Por {hotelName}</p>
        </div>
      </footer>
    </article>
  )
}
