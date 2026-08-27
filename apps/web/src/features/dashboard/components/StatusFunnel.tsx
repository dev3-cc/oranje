import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  statusLight,
  type ChartConfig,
} from '@oranje/ui'
import type { ReactNode } from 'react'
import { Label, Pie, PieChart } from 'recharts'

import type { FunnelBucket } from '../types/dashboard.types'

import personajeDashboard from '@/assets/ilustrations/personaje-dashboard.svg'
import { SectionCard } from '@/shared/components/SectionCard'
import {
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
} from '@/shared/constants/onboardingStatus'
import { IS_DEV_UI } from '@/shared/lib/devMode'

const chartConfig = {
  count: { label: 'Prospectos' },
} satisfies ChartConfig

/**
 * La distribución del pipeline como la DONA de shadcn (su bloque «Donut with
 * Text»): el total vive al centro, cada gajo es un estado con su color real
 * del Semáforo Onboarding, y la leyenda pone los nombres. Con conteos chicos
 * las barras se veían rotas; la dona siempre se ve entera.
 */
export function StatusFunnel({ buckets }: { buckets: FunnelBucket[] }): ReactNode {
  const data = buckets
    .filter((bucket) => bucket.count > 0)
    .map((bucket) => ({
      status: bucket.status,
      label: ONBOARDING_STATUS_LABEL[bucket.status],
      count: bucket.count,
      fill: statusLight[ONBOARDING_STATUS_TOKEN[bucket.status]],
    }))
  const total = data.reduce((sum, row) => sum + row.count, 0)

  return (
    <SectionCard
      title="Pipeline por estado"
      subtitle={
        IS_DEV_UI ? 'prospect.onboarding_state_id — solo ciclos abiertos' : 'Solo ciclos abiertos'
      }
    >
      <div className="relative">
        <img
          src={personajeDashboard}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -top-20 right-0 hidden h-24 w-auto sm:block"
        />

        {total === 0 ? (
          <p className="py-2 text-sm text-ink-3">Sin prospectos abiertos en el periodo.</p>
        ) : (
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-8">
            <ChartContainer config={chartConfig} className="aspect-square h-56 shrink-0">
              <PieChart>
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                <Pie
                  data={data}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={62}
                  outerRadius={90}
                  paddingAngle={3}
                  cornerRadius={6}
                  strokeWidth={0}
                >
                  <Label
                    content={({ viewBox }) => {
                      if (!viewBox || !('cx' in viewBox) || !('cy' in viewBox)) return null
                      return (
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          <tspan
                            x={viewBox.cx}
                            y={viewBox.cy}
                            className="fill-ink text-3xl font-bold"
                          >
                            {total}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy ?? 0) + 22}
                            className="fill-ink-3 text-xs"
                          >
                            abiertos
                          </tspan>
                        </text>
                      )
                    }}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>

            <ul className="flex flex-wrap justify-center gap-x-4 gap-y-2 sm:flex-col sm:justify-start">
              {data.map((row) => (
                <li key={row.status} className="flex items-center gap-2 text-sm text-ink-2">
                  <span
                    aria-hidden
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: row.fill }}
                  />
                  {row.label}
                  <span className="font-semibold text-ink">{row.count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </SectionCard>
  )
}
