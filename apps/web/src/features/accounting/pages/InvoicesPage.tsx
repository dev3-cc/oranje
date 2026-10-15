import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@oranje/ui'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Link } from 'react-router'

import { useGetClientHotelOptionsQuery, useGetInvoicesQuery } from '../api/settlementApi'
import { money } from '../lib/settlementFormat'
import {
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_TOKEN,
  INVOICE_STATUSES,
  type InvoiceStatus,
} from '../types/settlement.constants'

import personajeFactura from '@/assets/ilustrations/personaje-manager.svg'
import personajePagado from '@/assets/ilustrations/personaje-pago-procesado.svg'
import { FilterReset } from '@/shared/components/FilterReset'
import { FilterSelect } from '@/shared/components/FilterSelect'
import { LoadError } from '@/shared/components/LoadError'
import { Modal } from '@/shared/components/Modal'
import { OnboardingIntro } from '@/shared/components/OnboardingIntro'
import { ReloadButton } from '@/shared/components/ReloadButton'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import { TableSkeleton } from '@/shared/components/TableSkeleton'
import { useIntroSeen } from '@/shared/hooks/useIntroSeen'
import { formatWeekRange } from '@/shared/lib/formatters'

const ANY = 'ALL'

/** El texto se traduce al pintar con `i18n._()` (D-36), como el resto de los intros. */
const INTRO_SLIDES: readonly {
  image: string
  title: MessageDescriptor
  text: MessageDescriptor
}[] = [
  {
    image: personajeFactura,
    title: msg`A bill rate, no a lo que pagamos`,
    text: msg`Lo que el hotel nos paga por semana, al precio que le cobramos — nunca el pago interno al colaborador.`,
  },
  {
    image: personajeFactura,
    title: msg`Pendiente → Aprobada → Emitida`,
    text: msg`El Manager de Contabilidad la aprueba y la envía; la Contadora y el Manager pueden ver el borrador desde que nace.`,
  },
  {
    image: personajePagado,
    title: msg`Pagada la registra Contabilidad`,
    text: msg`Cuando el hotel liquida, Contabilidad marca la factura como pagada — el sistema no cobra solo.`,
  },
] as const

/**
 * Factura al Hotel: lo que el hotel le paga a Oranje por una semana, a bill
 * rate. El borrador lo ven la Contadora y el Manager (decisión de Hugo,
 * 2026-10-05): es lo que está pendiente de aprobación. Quién lo aprueba sigue
 * siendo el Manager, en el detalle.
 */
export function InvoicesPage(): ReactNode {
  const { t, i18n } = useLingui()
  const [hotelId, setHotelId] = useState<string>(ANY)
  const [status, setStatus] = useState<string>(ANY)
  const { isIntroOpen, dismissIntro, reopenIntro } = useIntroSeen('facturas')

  const { data, isLoading, isFetching, isError, refetch } = useGetInvoicesQuery({
    ...(hotelId !== ANY ? { hotelId } : {}),
    ...(status !== ANY ? { status } : {}),
  })
  const { data: hotels } = useGetClientHotelOptionsQuery()

  const rows = data ?? []
  const activeFilters = (hotelId !== ANY ? 1 : 0) + (status !== ANY ? 1 : 0)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            <Trans>Factura al Hotel</Trans>
          </h1>
          <p className="mt-1.5 text-sm text-ink-3">
            <Trans>
              Lo que cada hotel nos paga por semana, al precio que cobramos (bill rate).
            </Trans>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ReloadButton
            onReload={() => {
              void refetch()
            }}
            isReloading={isFetching}
          />
          <button
            type="button"
            onClick={reopenIntro}
            className="cursor-pointer rounded-md px-2 py-1 text-xs font-semibold whitespace-nowrap text-o-700 hover:bg-o-50"
          >
            <Trans>¿Cómo funciona?</Trans>
          </button>
        </div>
      </header>

      <Modal
        isOpen={isIntroOpen}
        onClose={dismissIntro}
        title={t`Cómo funciona Factura al Hotel`}
        chromeless
      >
        <OnboardingIntro
          slides={INTRO_SLIDES.map((slide) => ({
            image: slide.image,
            title: i18n._(slide.title),
            text: i18n._(slide.text),
          }))}
          startLabel={t`Entendido`}
          onDone={dismissIntro}
        />
      </Modal>

      <div className="flex flex-wrap items-center gap-2.5">
        <FilterSelect
          label={t`Hotel`}
          anyLabel={t`Todos`}
          value={hotelId}
          anyValue={ANY}
          options={(hotels ?? []).map((hotel) => ({ value: hotel.id, label: hotel.name }))}
          onChange={setHotelId}
          icon="apartment"
        />
        <FilterSelect
          label={t`Estado`}
          anyLabel={t`Todos`}
          value={status}
          anyValue={ANY}
          options={INVOICE_STATUSES.map((code) => ({
            value: code,
            label: INVOICE_STATUS_LABEL[code],
          }))}
          onChange={setStatus}
          icon="flag"
        />
        <FilterReset
          activeCount={activeFilters}
          onReset={() => {
            setHotelId(ANY)
            setStatus(ANY)
          }}
        />
      </div>

      {isError && (
        <LoadError
          message={t`No se pudieron cargar las facturas. Reintenta en unos segundos.`}
          onRetry={() => {
            void refetch()
          }}
        />
      )}

      {isLoading && !data ? (
        <TableSkeleton rows={6} columns={6} />
      ) : (
        <div className="rounded-lg border border-line bg-surface">
          <Table className="min-w-[48rem] text-left">
            <TableHeader>
              <TableRow className="border-line">
                {[t`Folio`, t`Hotel`, t`Periodo`, t`Total`, t`Crédito`, t`Estado`].map((header) => (
                  <TableHead
                    key={header}
                    scope="col"
                    className="px-4 py-3 text-xs font-semibold tracking-wide text-ink-3 uppercase"
                  >
                    {header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow className="border-line">
                  <TableCell colSpan={6} className="px-4 py-8 text-center text-sm text-ink-3">
                    {activeFilters > 0
                      ? t`No hay facturas con esos filtros.`
                      : t`Todavía no hay facturas. Se generan por hotel y semana con las horas autorizadas.`}
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row) => {
                const code = row.status as InvoiceStatus
                return (
                  <TableRow key={row.id} className="border-line">
                    <TableCell className="px-4 py-3 text-sm font-semibold text-ink">
                      <Link
                        to={`/accounting/invoices/${row.id}`}
                        className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-o-500"
                      >
                        {row.folio}
                      </Link>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-ink-2">{row.hotel.name}</TableCell>
                    <TableCell className="px-4 py-3 text-sm text-ink-3">
                      {formatWeekRange(row.periodStart, row.periodEnd)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm font-semibold text-ink">
                      {money(row.totalAmount)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-ink-2">
                      {money(row.creditAmount)}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <StatusLightSoftBadge
                        token={INVOICE_STATUS_TOKEN[code] ?? 'st-gris'}
                        label={INVOICE_STATUS_LABEL[code] ?? row.status}
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
