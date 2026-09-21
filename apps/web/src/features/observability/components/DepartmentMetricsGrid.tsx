import { Trans } from '@lingui/react/macro'
import {
  Badge,
  buttonVariants,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  cn,
  MaterialIcon,
} from '@oranje/ui'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import type { DepartmentCode, DepartmentMetric } from '../types/observability.types'

/**
 * Mismas dos pantallas reales que en `StatusDurationSection` — Hotel y Ventas
 * son los departamentos detrás de Requisiciones y Pipeline (Hugo, 2026-09-21).
 */
const REAL_SCREEN: Partial<Record<DepartmentCode, { to: string; label: ReactNode }>> = {
  HOTEL: { to: '/requisitions', label: <Trans>Ver requisiciones</Trans> },
  SALES: { to: '/pipeline', label: <Trans>Ver Pipeline</Trans> },
}

export function DepartmentMetricsGrid({ metrics }: { metrics: DepartmentMetric[] }): ReactNode {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {metrics.map((dept) => {
        const realScreen = REAL_SCREEN[dept.code]
        return (
          <Card key={dept.code}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                {dept.name}
                {!dept.implemented && (
                  <Badge variant="destructive">
                    <Trans>No implementado</Trans>
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>{dept.note}</CardDescription>
            </CardHeader>
            <CardContent>
              {dept.counts.length === 0 ? (
                <p className="text-sm text-ink-3">—</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {dept.counts.map((c) => (
                    <li key={c.label} className="flex items-center justify-between gap-3">
                      <span className="text-ink-2">{c.label}</span>
                      <span className="font-semibold text-ink">{c.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
            {realScreen && (
              <CardFooter>
                <Link
                  to={realScreen.to}
                  className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                >
                  {realScreen.label}
                  <MaterialIcon name="arrow_forward" className="text-base" />
                </Link>
              </CardFooter>
            )}
          </Card>
        )
      })}
    </div>
  )
}
