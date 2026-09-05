import type { ReactNode } from 'react'
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from 'recharts'

import type { PersonnelPerformance } from '../types/personnel.types'

import { IS_DEV_UI } from '@/shared/lib/devMode'

/** Eje → etiqueta humana. El orden dibuja el polígono. */
const AXES: Array<{ key: keyof PersonnelPerformance; label: string }> = [
  { key: 'attendance', label: 'Asistencia' },
  { key: 'punctuality', label: 'Puntualidad' },
  { key: 'completeness', label: 'Jornadas completas' },
  { key: 'geofence', label: 'En la geocerca' },
  { key: 'cleanDays', label: 'Días sin anomalía' },
]

/**
 * La semana en cinco medidas, derivadas SOLO de hechos (turnos del Schedule
 * vs. marcas del ponche). Un eje sin días comparables no se dibuja; con menos
 * de tres ejes medibles el radar no aparece — un polígono de dos puntas
 * mentiría más de lo que informa.
 */
export function WorkerPerformanceRadar({
  performance,
}: {
  performance: PersonnelPerformance | null
}): ReactNode {
  const axes =
    performance === null
      ? []
      : AXES.flatMap(({ key, label }) => {
          const value = performance[key]
          return value === null ? [] : [{ label, value }]
        })

  if (axes.length < 3) {
    return (
      <div className="flex h-full flex-col justify-center rounded-lg border border-dashed border-line p-5 text-center">
        <p className="text-sm font-semibold text-ink-2">Su semana aún no da para medir</p>
        <p className="mt-1 text-xs text-ink-3">
          El desempeño se calcula con turnos y marcas reales: cuando acumule días trabajados, aquí
          aparece su radar.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <p className="text-sm font-semibold text-ink">La semana en cinco medidas</p>
      <p className="text-xs text-ink-3">
        100 = todos sus días salieron bien en esa medida
        {IS_DEV_UI && <code className="text-ink-4"> · derivado de schedule + punch_mark</code>}
      </p>
      <div className="mt-1 h-52">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={axes} outerRadius="72%">
            <PolarGrid stroke="rgba(26, 17, 8, 0.12)" />
            <PolarAngleAxis
              dataKey="label"
              tick={{ fill: 'rgba(26, 17, 8, 0.55)', fontSize: 11 }}
            />
            <Radar
              dataKey="value"
              stroke="#FF8000"
              fill="#FF8000"
              fillOpacity={0.35}
              isAnimationActive={false}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
