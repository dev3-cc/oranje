import { ChartContainer, ChartTooltip, ChartTooltipContent, statusLight } from '@oranje/ui'
import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Area, AreaChart } from 'recharts'

import { useGetMyActivityQuery, useGetTeamProgressQuery } from '../api/dashboardApi'

import { useGetSessionQuery } from '@/app/sessionApi'
import { FoldText } from '@/shared/components/FoldText'
import { formatPercent } from '@/shared/lib/formatters'

function initialsOf(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase()
}

/**
 * Mini-gráfica de área sin ejes (el sparkline de la referencia): la serie da
 * la tendencia, el número grande da el dato. Recharts vía el chart de shadcn
 * — cero librerías nuevas (D-17).
 */
function SparkCard({
  title,
  value,
  series,
  labels,
  color,
  tintClass,
  delay,
  foot,
}: {
  title: string
  value: string
  series: number[]
  labels: string[]
  color: string
  tintClass: string
  delay: number
  foot?: string
}): ReactNode {
  const data = series.map((count, index) => ({ week: labels[index] ?? '', count }))
  const gradientId = `spark-${title.replaceAll(/\s+/g, '-')}`

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className={`flex items-center gap-4 rounded-xl p-4 ${tintClass}`}
    >
      <ChartContainer config={{ count: { label: title } }} className="h-16 w-28 shrink-0">
        <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <ChartTooltip content={<ChartTooltipContent labelKey="week" />} />
          <Area
            dataKey="count"
            type="monotone"
            stroke={color}
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            isAnimationActive
          />
        </AreaChart>
      </ChartContainer>
      <div className="min-w-0">
        <p className="text-3xl font-bold text-ink">{value}</p>
        <p className="text-sm text-ink-2">{title}</p>
        {foot !== undefined && <p className="mt-0.5 text-xs text-ink-3">{foot}</p>}
      </div>
    </motion.article>
  )
}

/** Tarjeta de dato sin serie: tinte, número grande y su pie — la hermana quieta del SparkCard. */
function StatTile({
  value,
  label,
  foot,
  tintClass,
  delay,
}: {
  value: string
  label: string
  foot: string
  tintClass: string
  delay: number
}): ReactNode {
  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className={`rounded-xl p-4 ${tintClass}`}
    >
      <p className="text-3xl font-bold text-ink">{value}</p>
      <p className="mt-0.5 text-sm text-ink-2">{label}</p>
      <p className="mt-0.5 text-xs text-ink-3">{foot}</p>
    </motion.article>
  )
}

/** Lo que la tarjeta hereda del overview: los números que antes eran MetricCards sueltas. */
export interface ActivityStats {
  openProspects: number
  staleProspects: number
  conversionRate: number
  averageConversionDays: number
  activeClients: number
}

/**
 * «Tu actividad»: quién eres (con tu foto) y cómo se mueve tu ciclo — las
 * series salen de tus propios prospectos (D-28); el histórico fino llegará
 * con `GET /me/activity`. Absorbe también las métricas del overview: en
 * móvil una rejilla de tarjetas planas no cabía sin volverse una torre.
 */
export function MyActivityCard({ stats }: { stats: ActivityStats }): ReactNode {
  const { data: session } = useGetSessionQuery()
  const { data: activity } = useGetMyActivityQuery()

  if (!session || !activity) return null

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <h2 className="text-lg font-bold text-ink">
        <FoldText text="Tu actividad" />
      </h2>
      <p className="mt-0.5 text-sm text-ink-3">Últimas 8 semanas</p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SparkCard
          title="Prospectos abiertos"
          value={String(stats.openProspects)}
          series={activity.openedPerWeek}
          labels={activity.weekLabels}
          color={statusLight['st-azul-claro']}
          tintClass="bg-st-azul-claro/10"
          delay={0.05}
          foot={`${String(stats.staleProspects)} sin actividad 7+ días`}
        />
        <SparkCard
          title="Conversiones"
          value={String(activity.totalConverted)}
          series={activity.convertedPerWeek}
          labels={activity.weekLabels}
          color={statusLight['st-naranja']}
          tintClass="bg-st-naranja/10"
          delay={0.12}
          foot="Rosa → Naranja, por semana"
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          value={formatPercent(stats.conversionRate)}
          label="Tasa de conversión"
          foot="Naranja / ciclos cerrados"
          tintClass="bg-o-500/10"
          delay={0.18}
        />
        <StatTile
          value={`${String(stats.averageConversionDays)} d`}
          label="Tiempo promedio"
          foot="Gris → Naranja"
          tintClass="bg-surface-2"
          delay={0.24}
        />
        <StatTile
          value={String(stats.activeClients)}
          label="Clientes activos"
          foot="Habilitados para requisiciones"
          tintClass="bg-st-verde/10"
          delay={0.3}
        />
      </div>
    </section>
  )
}

/**
 * «Tu equipo» como el Simple CTA With Images de Aceternity: encabezado, copy,
 * las fichas de tu gente inclinadas en abanico y el botón a Mi Equipo. Solo
 * existe si alguien te reporta — sin gente, sin tarjeta.
 */
const TILE_TILT = [-6, 4, -3, 5, -4, 3]

export function TeamProgressCard(): ReactNode {
  const { data: members = [] } = useGetTeamProgressQuery()

  if (members.length === 0) return null

  const totalOpen = members.reduce((sum, member) => sum + member.openProspects, 0)
  const totalConversions = members.reduce((sum, member) => sum + member.conversions, 0)
  const finished = members.reduce(
    (sum, member) =>
      sum +
      (member.conversionRate > 0 ? Math.round(member.conversions / member.conversionRate) : 0),
    0,
  )
  const teamRate = finished === 0 ? 0 : totalConversions / finished
  const topPerformer = [...members].sort((a, b) => b.conversions - a.conversions)[0]

  return (
    <section className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
      <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
        <div className="max-w-md">
          <h2 className="text-2xl font-bold text-ink sm:text-3xl">
            <FoldText text="Tu equipo avanza contigo" />
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-3">
            {members.length} {members.length === 1 ? 'BD te reporta' : 'BDs te reportan'} ·{' '}
            {totalOpen} prospectos abiertos y {totalConversions}{' '}
            {totalConversions === 1 ? 'conversión' : 'conversiones'} entre todos.
          </p>
          <Link
            to="/mi-equipo"
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-o-500 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
          >
            Ver Mi Equipo <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="flex flex-col items-start">
          {/* El chip oscuro del bloque: quien más convierte del equipo. */}
          {topPerformer && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="mb-3 flex items-center gap-2 rounded-lg bg-ink px-3 py-1.5 shadow-md"
            >
              <span className="text-sm font-bold text-white">{topPerformer.fullName}</span>
              <span className="rounded-md bg-white/15 px-2 py-0.5 text-xs font-medium text-white/85">
                {topPerformer.conversions}{' '}
                {topPerformer.conversions === 1 ? 'conversión' : 'conversiones'}
              </span>
            </motion.div>
          )}

          <div className="flex items-center gap-4">
            {/* El abanico de fichas inclinadas, con iniciales: el contrato de
                /team aún no trae la foto de cada BD. */}
            <div className="flex items-center pl-3">
              {members.slice(0, 6).map((member, index) => (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: 12, rotate: 0 }}
                  animate={{ opacity: 1, y: 0, rotate: TILE_TILT[index % TILE_TILT.length] ?? 0 }}
                  transition={{ duration: 0.4, delay: index * 0.08 }}
                  title={`${member.fullName} · ${String(member.openProspects)} abiertos · ${formatPercent(member.conversionRate)}`}
                  className="-ml-3 flex size-16 items-center justify-center rounded-2xl border-4 border-surface bg-o-500/15 text-lg font-bold text-o-700 shadow-md"
                >
                  {initialsOf(member.fullName)}
                </motion.div>
              ))}
              {members.length > 6 && (
                <div className="-ml-3 flex size-16 items-center justify-center rounded-2xl border-4 border-surface bg-surface-2 text-sm font-bold text-ink-2 shadow-md">
                  +{members.length - 6}
                </div>
              )}
            </div>
          </div>

          <p className="mt-2 pl-3 text-sm text-ink-3">
            {totalConversions} {totalConversions === 1 ? 'hotel convertido' : 'hoteles convertidos'}{' '}
            por tu equipo · tasa {formatPercent(teamRate)}
          </p>
        </div>
      </div>
    </section>
  )
}
