import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  statusLight,
  type ChartConfig,
} from '@oranje/ui'
import type { ReactNode } from 'react'
import { Bar, BarChart, Cell, LabelList, XAxis, YAxis } from 'recharts'

import type { FunnelBucket } from '../types/dashboard.types'

import { SectionCard } from '@/shared/components/SectionCard'
import {
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
} from '@/shared/constants/onboardingStatus'
import { IS_DEV_UI } from '@/shared/lib/devMode'

const ROW_HEIGHT = 52

const chartConfig = {
  count: { label: 'Prospectos' },
} satisfies ChartConfig

export function StatusFunnel({ buckets }: { buckets: FunnelBucket[] }): ReactNode {
  const data = buckets.map((bucket) => ({
    status: bucket.status,
    label: ONBOARDING_STATUS_LABEL[bucket.status],
    count: bucket.count,
    fill: statusLight[ONBOARDING_STATUS_TOKEN[bucket.status]],
  }))

  return (
    <SectionCard
      title="Embudo por estado"
      subtitle={
        IS_DEV_UI ? 'prospect.onboarding_state_id — solo ciclos abiertos' : 'Solo ciclos abiertos'
      }
    >
      {data.length === 0 ? (
        <p className="py-2 text-sm text-ink-3">Sin prospectos abiertos en el periodo.</p>
      ) : (
        <ChartContainer
          config={chartConfig}
          className="aspect-auto w-full"
          style={{ height: data.length * ROW_HEIGHT }}
        >
          <BarChart
            accessibilityLayer
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 28, bottom: 4, left: 0 }}
          >
            <XAxis type="number" dataKey="count" hide />
            <YAxis
              type="category"
              dataKey="label"
              tickLine={false}
              axisLine={false}
              width={88}
              tick={{ fill: 'var(--ink-2)', fontSize: 14 }}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideIndicator />} />
            <Bar
              dataKey="count"
              radius={14}
              barSize={28}
              background={{ fill: 'var(--surface-3)', opacity: 0.6, radius: 14 }}
            >
              {data.map((row) => (
                <Cell key={row.status} fill={row.fill} />
              ))}
              <LabelList
                dataKey="count"
                position="right"
                offset={12}
                className="fill-ink-2"
                fontSize={14}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      )}
    </SectionCard>
  )
}
