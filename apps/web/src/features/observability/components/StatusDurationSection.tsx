import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
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
  StatusLightBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type StatusLightToken,
} from '@oranje/ui'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import type {
  StateDuration,
  StateSnapshot,
  StatusLightCode,
  StatusLightSummary,
} from '../types/observability.types'

import {
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
} from '@/shared/constants/onboardingStatus'
import {
  REQUISITION_STATUS_LABEL,
  REQUISITION_STATUS_TOKEN,
  URGENCY_LABEL,
  URGENCY_TOKEN,
} from '@/shared/constants/requisitionStatus'
import { WORKER_STATUS_LABEL, WORKER_STATUS_TOKEN } from '@/shared/constants/workerStatus'
import { formatDurationHuman, formatHours } from '@/shared/lib/formatters'
import { labelMap } from '@/shared/lib/i18nLabels'

/** El sustantivo de "cuántas entidades" en el total de vida completa. */
const ENTITY_NOUN = labelMap({
  WORKER: msg`colaboradores`,
  REQUISITION: msg`requisiciones`,
  ONBOARDING: msg`prospectos`,
})

/** El sujeto de la frase del total: "un colaborador", "una requisición"… */
const ENTITY_SUBJECT = labelMap({
  WORKER: msg`un colaborador`,
  REQUISITION: msg`una requisición`,
  ONBOARDING: msg`un prospecto`,
})

/**
 * Los 3 semáforos con historial append-only YA tienen su color y su nombre en
 * español propios en `shared/constants/` — reutilizados aquí tal cual, no
 * reinventados. `POSITION_COVERAGE` no tiene mapa de color (su estado `GOLD`
 * no existe como token de diseño) y se muestra con el `name` que ya manda la
 * API, sin chip de color.
 */
const LABEL_MAP: Partial<Record<string, Record<string, string>>> = {
  WORKER: WORKER_STATUS_LABEL,
  REQUISITION: REQUISITION_STATUS_LABEL,
  ONBOARDING: ONBOARDING_STATUS_LABEL,
  URGENCY: URGENCY_LABEL,
}

const TOKEN_MAP: Partial<Record<string, Record<string, StatusLightToken>>> = {
  WORKER: WORKER_STATUS_TOKEN,
  REQUISITION: REQUISITION_STATUS_TOKEN,
  ONBOARDING: ONBOARDING_STATUS_TOKEN,
  URGENCY: URGENCY_TOKEN,
}

function StateChip({
  lightCode,
  code,
  fallbackName,
}: {
  lightCode: string
  code: string
  fallbackName: string
}) {
  const token = TOKEN_MAP[lightCode]?.[code]
  const label = LABEL_MAP[lightCode]?.[code] ?? fallbackName
  if (!token) return <span className="text-ink">{fallbackName}</span>
  return <StatusLightBadge token={token} label={label} />
}

function isDuration(states: StateDuration[] | StateSnapshot[]): states is StateDuration[] {
  return states.length === 0 || 'transitions' in states[0]!
}

/**
 * Solo estos dos: son las dos pantallas reales a las que el Observador tiene
 * lectura otorgada (Hugo, 2026-09-21 — `requisitions:read_all` y
 * `pipeline:read`/`read_all`, sin alcance porque su `hotelId` es nulo). El
 * Colaborador no tiene una pantalla equivalente de solo lectura que enlazar.
 */
const REAL_SCREEN: Partial<Record<StatusLightCode, { to: string; label: ReactNode }>> = {
  REQUISITION: { to: '/requisitions', label: <Trans>Ver requisiciones</Trans> },
  ONBOARDING: { to: '/pipeline', label: <Trans>Ver Pipeline (Ventas)</Trans> },
}

export function StatusDurationSection({ light }: { light: StatusLightSummary }): ReactNode {
  const { t } = useLingui()
  const realScreen = REAL_SCREEN[light.code]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {light.label}
          {light.hasHistory ? (
            <Badge variant="secondary">
              <Trans>Duración real</Trans>
            </Badge>
          ) : light.states ? (
            <Badge variant="outline">
              <Trans>Solo estado actual</Trans>
            </Badge>
          ) : light.span ? (
            <Badge variant="outline">
              <Trans>Aproximado</Trans>
            </Badge>
          ) : (
            <Badge variant="destructive">
              <Trans>No implementado</Trans>
            </Badge>
          )}
        </CardTitle>
        <CardDescription>{light.note}</CardDescription>
      </CardHeader>
      <CardContent>
        {light.total && (
          <div className="mb-4 rounded-md bg-surface-2 px-3 py-3">
            {light.total.avgTotalHours === null ? (
              <p className="text-sm text-ink-3">
                <Trans>Todavía no hay historial suficiente para calcular un promedio.</Trans>
              </p>
            ) : (
              <>
                <p className="text-xl font-bold text-ink">
                  {formatDurationHuman(light.total.avgTotalHours)}
                </p>
                <p className="mt-1 text-xs text-ink-3">
                  {t`En promedio, lo que lleva ${
                    (ENTITY_SUBJECT as Partial<Record<string, string>>)[light.code] ?? ''
                  } en el sistema desde que nace hasta ahora — no la suma de los promedios por estado de arriba. Calculado sobre ${light.total.entities} ${
                    (ENTITY_NOUN as Partial<Record<string, string>>)[light.code] ?? ''
                  } con historial.`}
                </p>
              </>
            )}
          </div>
        )}

        {light.states && light.states.length > 0 && isDuration(light.states) && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Trans>Estado</Trans>
                </TableHead>
                <TableHead className="text-right">
                  <Trans>Transiciones</Trans>
                </TableHead>
                <TableHead className="text-right">
                  <Trans>Duración promedio</Trans>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {light.states.map((s) => (
                <TableRow key={s.code}>
                  <TableCell>
                    <StateChip lightCode={light.code} code={s.code} fallbackName={s.name} />
                  </TableCell>
                  <TableCell className="text-right">{s.transitions}</TableCell>
                  <TableCell className="text-right">
                    {s.avgHours === null ? '—' : formatHours(s.avgHours)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {light.states && light.states.length > 0 && !isDuration(light.states) && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Trans>Estado</Trans>
                </TableHead>
                <TableHead className="text-right">
                  <Trans>Cuántos ahorita</Trans>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {light.states.map((s) => (
                <TableRow key={s.code}>
                  <TableCell>
                    <StateChip lightCode={light.code} code={s.code} fallbackName={s.name} />
                  </TableCell>
                  <TableCell className="text-right">{s.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {light.states && light.states.length === 0 && (
          <p className="text-sm text-ink-3">
            <Trans>Sin datos todavía.</Trans>
          </p>
        )}

        {light.span && (
          <dl className="grid grid-cols-3 gap-4 text-center">
            <div>
              <dt className="text-xs text-ink-3">
                <Trans>Resueltos</Trans>
              </dt>
              <dd className="text-lg font-semibold text-ink">{light.span.resolved}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3">
                <Trans>Pendientes</Trans>
              </dt>
              <dd className="text-lg font-semibold text-ink">{light.span.pending}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3">
                <Trans>Promedio hasta resolver</Trans>
              </dt>
              <dd className="text-lg font-semibold text-ink">
                {light.span.avgHours === null ? '—' : formatHours(light.span.avgHours)}
              </dd>
            </div>
          </dl>
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
}
