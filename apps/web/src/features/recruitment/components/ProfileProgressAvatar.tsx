import { useLingui } from '@lingui/react/macro'
import {
  MaterialIcon,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  cn,
  statusLight,
} from '@oranje/ui'
import type { ReactNode } from 'react'

import type { Readiness } from '../lib/profileFields'

import { WORKER_STATUS_TOKEN, type WorkerStatus } from '@/shared/constants/workerStatus'
import { formatList } from '@/shared/lib/formatters'

/**
 * La cara del colaborador con DOS anillos que dicen cosas distintas:
 *
 * - el de dentro, pegado a la foto, es el [[Semáforo del Colaborador]] — el
 *   mismo lenguaje que Mi Personal y la app del Colaborador;
 * - el de fuera contesta una sola pregunta: **¿ya se puede meter a una
 *   requisición?**
 *
 * No mide el expediente completo: el vault deja validar a sabiendas con datos
 * a medias, así que un Disponible ya está listo aunque le falte algo (Reglas
 * de Negocio · Validación con expediente incompleto). Cuando todavía no lo
 * está, el arco cuenta lo de la **Fase 1** — lo que Reclutamiento necesita
 * capturar para validarlo y saber a qué posición cabe.
 *
 * Nunca lo dice SOLO con color: cierra con palomita cuando está listo y lleva
 * la cuenta («2/4») o el signo cuando falta.
 */
export function ProfileProgressAvatar({
  fullName,
  photoUrl,
  status,
  readiness,
  size = 40,
  className,
}: {
  fullName: string
  photoUrl: string | null
  status: WorkerStatus
  /** De `assignmentReadiness`: listo, pendiente de validar, o fuera de juego. */
  readiness: Readiness
  /** Lado de la foto en píxeles; el anillo se dibuja alrededor. */
  size?: number
  className?: string
}): ReactNode {
  const { t, i18n } = useLingui()
  const ring = statusLight[WORKER_STATUS_TOKEN[status]]
  /** Bajo ~48px la cuenta no se lee: la cara chica lleva el signo. */
  const isCompact = size < 48
  const badge = Math.max(14, Math.round(size * 0.42))

  const stroke = Math.max(2, Math.round(size * 0.07))
  const gap = Math.max(2, Math.round(size * 0.06))
  const box = size + (stroke + gap) * 2
  const radius = (box - stroke) / 2
  const circumference = 2 * Math.PI * radius

  const isReady = readiness.kind === 'ready'
  const isOut = readiness.kind === 'out'
  const ratio =
    readiness.kind === 'pending'
      ? readiness.total === 0
        ? 1
        : Math.min(1, Math.max(0, readiness.done / readiness.total))
      : 1

  /* El tooltip dice QUÉ falta, por su nombre: «faltan 2 datos» obliga a ir a
     buscar cuáles (Hugo, 2026-09-23). */
  const missingNames =
    readiness.kind === 'pending' ? formatList(readiness.missing.map((m) => i18n._(m))) : ''
  const label = isReady
    ? t`Listo para asignar`
    : readiness.kind === 'pending'
      ? t`Para poder asignarlo falta capturar en la entrevista: ${missingNames}`
      : t`No disponible por su estado`

  const initials = fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase()

  const avatar = (
    <span
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: box, height: box }}
      /* Se queda como respaldo: si el tooltip no alcanza a montar, el
         navegador sigue diciendo lo mismo. */
      title={label}
      tabIndex={0}
    >
      {/* Fuera de juego (Stand-by, accidentado, vetado…): solo el semáforo. */}
      {!isOut && (
        <svg
          width={box}
          height={box}
          viewBox={`0 0 ${box} ${box}`}
          aria-hidden
          className="absolute inset-0 -rotate-90"
        >
          <circle
            cx={box / 2}
            cy={box / 2}
            r={radius}
            fill="none"
            stroke="var(--line)"
            strokeWidth={stroke}
          />
          <circle
            cx={box / 2}
            cy={box / 2}
            r={radius}
            fill="none"
            stroke={isReady ? statusLight['st-verde'] : 'var(--o-500)'}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - ratio)}
            className="transition-[stroke-dashoffset] duration-500"
          />
        </svg>
      )}

      {photoUrl ? (
        <img
          src={photoUrl}
          alt=""
          aria-hidden
          style={{ width: size, height: size, borderColor: ring }}
          className="rounded-full border-2 object-cover"
        />
      ) : (
        <span
          aria-hidden
          style={{ width: size, height: size, borderColor: ring }}
          className="flex items-center justify-center rounded-full border-2 bg-o-50 font-semibold text-o-700"
        >
          <span style={{ fontSize: Math.round(size * 0.36) }}>{initials}</span>
        </span>
      )}

      {/* La marca de la esquina: el color nunca va solo. */}
      {!isOut && (
        <span
          aria-hidden
          style={{ borderColor: 'var(--surface)' }}
          className={cn(
            'absolute right-0 bottom-0 flex items-center justify-center rounded-full border-2 font-bold',
            isReady ? 'bg-st-verde text-surface' : 'bg-o-500 text-ink',
          )}
        >
          {isReady ? (
            <MaterialIcon name="check" style={{ fontSize: Math.round(size * 0.34) }} />
          ) : isCompact ? (
            <span
              className="flex items-center justify-center leading-none"
              style={{ fontSize: Math.round(size * 0.4), width: badge, height: badge }}
            >
              ?
            </span>
          ) : (
            <span
              className="px-1 leading-none"
              style={{ fontSize: Math.round(size * 0.26), paddingBlock: Math.round(size * 0.09) }}
            >
              {readiness.kind === 'pending' ? `${readiness.done}/${readiness.total}` : '?'}
            </span>
          )}
        </span>
      )}

      <span className="sr-only">{label}</span>
    </span>
  )

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{avatar}</TooltipTrigger>
        {/* Arriba, no al lado: en la lista del Pool el costado cae justo sobre
            el nombre de la persona. */}
        <TooltipContent side="top" className="max-w-56 text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
