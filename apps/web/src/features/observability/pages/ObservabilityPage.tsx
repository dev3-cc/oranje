import { Trans } from '@lingui/react/macro'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@oranje/ui'
import type { ReactNode } from 'react'

import { useGetDepartmentMetricsQuery, useGetStatusDurationsQuery } from '../api/observabilityApi'
import { DepartmentMetricsGrid } from '../components/DepartmentMetricsGrid'
import { PunchesTable } from '../components/PunchesTable'
import { StatusDurationSection } from '../components/StatusDurationSection'

import fotoEquipo from '@/assets/ilustrations/observador-equipo.webp'
import { CardGridSkeleton } from '@/shared/components/CardGridSkeleton'

/**
 * Observador (`ROL-OBS-01`): transversal, de solo lectura. Ve los 9 semáforos
 * con el nivel de detalle que honestamente tienen (Roles del Sistema.md,
 * 2026-09-21 — "sin SLA ni umbral inventado"), el ponche de cualquier hotel y
 * las métricas de los 7 departamentos.
 */
export function ObservabilityPage(): ReactNode {
  const { data: lights, isLoading: isLoadingLights } = useGetStatusDurationsQuery()
  const { data: departments, isLoading: isLoadingDepartments } = useGetDepartmentMetricsQuery()

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
              Cuánto tarda cada semáforo, cada ponche de cualquier hotel, y las métricas de los 7
              departamentos — todo de solo lectura.
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

      <Tabs defaultValue="status">
        <TabsList>
          <TabsTrigger value="status">
            <Trans>Semáforos</Trans>
          </TabsTrigger>
          <TabsTrigger value="punches">
            <Trans>Ponches</Trans>
          </TabsTrigger>
          <TabsTrigger value="departments">
            <Trans>Departamentos</Trans>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="space-y-4">
          {isLoadingLights ? (
            <CardGridSkeleton cards={9} className="grid-cols-1 md:grid-cols-2 xl:grid-cols-3" />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(lights ?? []).map((light) => (
                <StatusDurationSection key={light.code} light={light} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="punches">
          <PunchesTable />
        </TabsContent>

        <TabsContent value="departments">
          {isLoadingDepartments ? (
            <CardGridSkeleton cards={7} className="grid-cols-1 md:grid-cols-2 xl:grid-cols-3" />
          ) : (
            <DepartmentMetricsGrid metrics={departments ?? []} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
