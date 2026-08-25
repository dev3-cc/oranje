import { statusLight } from '@oranje/ui'
import type { ReactNode } from 'react'
import { ResponsiveContainer, Sankey } from 'recharts'

import {
  ONBOARDING_STATUS_DESCRIPTION,
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
  type OnboardingStatus,
} from '@/shared/constants/onboardingStatus'
import { IS_DEV_UI } from '@/shared/lib/devMode'

const FLOW_STATES: readonly OnboardingStatus[] = [
  'GRAY',
  'LIGHT_BLUE',
  'GREEN',
  'YELLOW',
  'PINK',
  'ORANGE',
  'RED',
  'BROWN',
  'BLACK',
]

const FLOW_EDGES: ReadonlyArray<[OnboardingStatus, OnboardingStatus]> = [
  ['GRAY', 'LIGHT_BLUE'],
  ['LIGHT_BLUE', 'GREEN'],
  ['GREEN', 'YELLOW'],
  ['GREEN', 'RED'],
  ['GREEN', 'BROWN'],
  ['YELLOW', 'PINK'],
  ['PINK', 'ORANGE'],
  ['PINK', 'BROWN'],
  ['ORANGE', 'BLACK'],
]

const BASE_FLOW = 0.6

function stateColor(status: OnboardingStatus): string {
  return statusLight[ONBOARDING_STATUS_TOKEN[status]]
}

interface FlowNodeProps {
  x: number
  y: number
  width: number
  height: number
  index: number
}

function FlowNode(props: unknown): ReactNode {
  const { x, y, width, height, index } = props as FlowNodeProps
  const status = FLOW_STATES[index]
  if (!status) return null
  const count = STATE_COUNTS.get(status) ?? 0
  const labelsLeft = x > 400

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={Math.max(height, 4)}
        rx={3}
        fill={stateColor(status)}
      />
      <text
        x={labelsLeft ? x - 8 : x + width + 8}
        y={y + Math.max(height, 4) / 2 - 4}
        textAnchor={labelsLeft ? 'end' : 'start'}
        className="fill-ink text-[11px] font-semibold"
      >
        {ONBOARDING_STATUS_LABEL[status]} · {count}
      </text>
      <text
        x={labelsLeft ? x - 8 : x + width + 8}
        y={y + Math.max(height, 4) / 2 + 9}
        textAnchor={labelsLeft ? 'end' : 'start'}
        className="fill-ink-3 text-[10px]"
      >
        {ONBOARDING_STATUS_DESCRIPTION[status]}
      </text>
    </g>
  )
}

interface FlowLinkProps {
  sourceX: number
  sourceY: number
  sourceControlX: number
  targetX: number
  targetY: number
  targetControlX: number
  linkWidth: number
  index: number
}

function FlowLink(props: unknown): ReactNode {
  const { sourceX, sourceY, sourceControlX, targetX, targetY, targetControlX, linkWidth, index } =
    props as FlowLinkProps
  const edge = FLOW_EDGES[index]
  if (!edge) return null
  const gradientId = `pipeline-flow-${edge[0]}-${edge[1]}`

  return (
    <g>
      <defs>
        <linearGradient id={gradientId} x1={sourceX} x2={targetX} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={stateColor(edge[0])} stopOpacity={0.45} />
          <stop offset="100%" stopColor={stateColor(edge[1])} stopOpacity={0.45} />
        </linearGradient>
      </defs>
      <path
        d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={Math.max(linkWidth, 2)}
      />
    </g>
  )
}

const STATE_COUNTS = new Map<OnboardingStatus, number>()

export function PipelineFlowCard({
  countByStatus,
}: {
  countByStatus: Partial<Record<OnboardingStatus, number>>
}): ReactNode {
  STATE_COUNTS.clear()
  for (const status of FLOW_STATES) STATE_COUNTS.set(status, countByStatus[status] ?? 0)

  const data = {
    nodes: FLOW_STATES.map((status) => ({ name: ONBOARDING_STATUS_LABEL[status] })),
    links: FLOW_EDGES.map(([from, to]) => {
      const into = countByStatus[to] ?? 0
      const share = to === 'BROWN' ? into / 2 : into
      return {
        source: FLOW_STATES.indexOf(from),
        target: FLOW_STATES.indexOf(to),
        value: share + BASE_FLOW,
      }
    }),
  }

  return (
    <section className="rounded-lg border border-line bg-surface p-5">
      <h2 className="text-base font-semibold text-ink">El flujo del semáforo</h2>
      <p className="mt-0.5 text-sm text-ink-3">
        Cada cinta es una transición válida; el grosor, cuántos prospectos hay hoy en el estado
        destino.
      </p>

      <div className="mt-3 h-80">
        <ResponsiveContainer width="100%" height="100%">
          <Sankey
            data={data}
            node={<FlowNode />}
            link={<FlowLink />}
            nodePadding={26}
            nodeWidth={8}
            margin={{ top: 8, right: 120, bottom: 8, left: 8 }}
          />
        </ResponsiveContainer>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-ink-3">
        Las reentradas no se dibujan: Rojo, Café y Negro reactivan siempre hacia Azul claro
        {IS_DEV_UI ? ' (RR-V-07)' : ''}, y un Sankey no admite ciclos.
      </p>
    </section>
  )
}
