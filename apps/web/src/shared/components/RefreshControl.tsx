import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { MaterialIcon } from '@oranje/ui'
import { type ReactNode, useEffect, useState } from 'react'

/** Cada medio minuto basta: la leyenda se mide en minutos, no en segundos. */
const TICK_MS = 30_000

/**
 * Pone al día una pantalla pesada, y dice de cuándo es lo que estás viendo.
 *
 * Las pantallas livianas se refrescan solas al volver a la app (censo del
 * 2026-10-01). Las pesadas no: una recarga de la cinta del Timesheet cuesta
 * ~7 peticiones porque el front arma la pantalla él mismo (D-28), y cambiar
 * los datos a media revisión es peor que verlos un poco viejos — el
 * Supervisor va día por día y en la cinta ya arrastró a una posición.
 *
 * Así que aquí decide la persona (decisión de Hugo, 2026-10-01). Lo que hace
 * que un botón sea suficiente y no un sondeo a mano es que la **campana ya
 * avisa sola**: ella dice que algo pasó, esto pone la pantalla al día.
 *
 * Y por eso la leyenda no es decoración: sin «hace cuánto», la persona no
 * sabe si vale la pena presionarlo y vuelve a adivinar.
 */
export function RefreshControl({
  onRefresh,
  isFetching,
  fulfilledTimeStamp,
  label,
}: {
  onRefresh: () => void
  /** Mientras es verdadero el botón se apaga y lo dice (regla de UX). */
  isFetching: boolean
  /** Cuándo llegó el dato que se está viendo. Lo da RTK Query. */
  fulfilledTimeStamp: number | undefined
  /** Qué se actualiza, para el lector de pantalla: «el Timesheet». */
  label: string
}): ReactNode {
  const { t } = useLingui()
  const [, redibuja] = useState(0)

  /* La leyenda envejece sola: sin esto diría «hace un momento» para siempre. */
  useEffect(() => {
    if (fulfilledTimeStamp === undefined) return
    const id = setInterval(() => redibuja((n) => n + 1), TICK_MS)
    return () => clearInterval(id)
  }, [fulfilledTimeStamp])

  const minutos =
    fulfilledTimeStamp === undefined ? null : Math.floor((Date.now() - fulfilledTimeStamp) / 60_000)

  return (
    <div className="flex items-center gap-2">
      {/* `polite` y no `assertive`: es un dato de contexto, no una alarma. */}
      <span className="text-xs text-ink-3" aria-live="polite">
        {isFetching ? (
          <Trans>Actualizando…</Trans>
        ) : minutos === null ? null : minutos < 1 ? (
          <Trans>Actualizado hace un momento</Trans>
        ) : (
          <Plural
            value={minutos}
            one="Actualizado hace # minuto"
            other="Actualizado hace # minutos"
          />
        )}
      </span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={isFetching}
        /* El nombre accesible nombra QUÉ se actualiza; el texto visible no
           puede, porque en la barra compite con los filtros. */
        aria-label={t`Actualizar ${label}`}
        className="inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-full border border-ink-4/40 px-3 text-sm font-medium text-ink-2 transition-colors hover:bg-o-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <MaterialIcon
          name="refresh"
          /* `motion-safe`: quien pidió menos movimiento no ve girar nada. */
          className={isFetching ? 'text-base motion-safe:animate-spin' : 'text-base'}
          aria-hidden
        />
        <Trans>Actualizar</Trans>
      </button>
    </div>
  )
}
