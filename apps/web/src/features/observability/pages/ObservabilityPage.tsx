import { Trans, useLingui } from '@lingui/react/macro'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@oranje/ui'
import { type ReactNode, useMemo, useState } from 'react'

import { PeriodSelector } from '../components/TabParts'
import { PERIOD_LABEL, type PeriodKey, periodOf } from '../lib/period'
import { HotelTab } from '../tabs/HotelTab'
import { AccountingTab, InspectionTab } from '../tabs/InspectionTab'
import { RecruitmentTab } from '../tabs/RecruitmentTab'
import { SalesTab } from '../tabs/SalesTab'
import { WorkerTab } from '../tabs/WorkerTab'

import fotoEquipo from '@/assets/ilustrations/observador-equipo.webp'

/**
 * Observador (`ROL-OBS-01`): transversal, de solo lectura. Una pestaña por
 * departamento con sus KPIs, compuestos en el front con las listas que el
 * Observador ya lee (Guía del Observador, 2026-10-07). Las metas son las del
 * tablero maquetado y se marcan como de ejemplo; viven en `lib/kpi.ts`.
 */
export function ObservabilityPage(): ReactNode {
  const { i18n } = useLingui()
  const [periodKey, setPeriodKey] = useState<PeriodKey>('week')
  const period = useMemo(() => periodOf(periodKey), [periodKey])
  const periodLabel = i18n._(PERIOD_LABEL[periodKey])

  return (
    <div className="space-y-6">
      {/* Cabecera-tarjeta como las demás secciones. Esta foto va COMPLETA (el
          equipo en círculo con las naranjas, visto desde abajo: recortada
          quedaría un anillo hueco), a la derecha, a todo el alto y disuelta
          hacia la tarjeta por la izquierda — la misma de Usuarios del sistema. */}
      <header className="relative flex items-end justify-between gap-4 overflow-hidden rounded-2xl border border-line bg-gradient-to-r from-o-50 via-surface to-surface px-6 pt-5 pb-5 sm:min-h-52 sm:pr-96">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            <Trans>Observador</Trans>
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-ink-3">
            <Trans>
              Los indicadores de cada departamento, calculados con lo que el sistema ya registra —
              todo de solo lectura.
            </Trans>
          </p>
        </div>
        <img
          src={fotoEquipo}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-auto object-cover object-right md:block"
        />
      </header>

      <Tabs defaultValue="sales" className="gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="-mx-1 overflow-x-auto px-1">
            <TabsList>
              <TabsTrigger value="sales">
                <Trans>Ventas</Trans>
              </TabsTrigger>
              <TabsTrigger value="hotel">
                <Trans>Hotel</Trans>
              </TabsTrigger>
              <TabsTrigger value="recruitment">
                <Trans>Reclutamiento</Trans>
              </TabsTrigger>
              <TabsTrigger value="worker">
                <Trans>Colaborador</Trans>
              </TabsTrigger>
              <TabsTrigger value="inspection">
                <Trans>Inspección</Trans>
              </TabsTrigger>
              <TabsTrigger value="accounting">
                <Trans>Contabilidad</Trans>
              </TabsTrigger>
            </TabsList>
          </div>
          <PeriodSelector value={periodKey} onChange={setPeriodKey} />
        </div>
        <p className="text-xs text-ink-3">
          <Trans>
            Las metas son de ejemplo, tomadas del tablero maquetado: todavía nadie las aprobó.
          </Trans>
        </p>

        <TabsContent value="sales">
          <SalesTab period={period} periodLabel={periodLabel} />
        </TabsContent>
        <TabsContent value="hotel">
          <HotelTab period={period} periodLabel={periodLabel} />
        </TabsContent>
        <TabsContent value="recruitment">
          <RecruitmentTab period={period} periodLabel={periodLabel} />
        </TabsContent>
        <TabsContent value="worker">
          <WorkerTab period={period} periodLabel={periodLabel} />
        </TabsContent>
        <TabsContent value="inspection">
          <InspectionTab periodLabel={periodLabel} />
        </TabsContent>
        <TabsContent value="accounting">
          <AccountingTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
