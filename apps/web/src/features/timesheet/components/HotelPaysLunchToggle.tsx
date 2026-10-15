import { Trans, useLingui } from '@lingui/react/macro'
import { Spinner, Switch } from '@oranje/ui'
import type { ReactNode } from 'react'

import { useDelayedFlag } from '@/shared/hooks/useDelayedFlag'

/**
 * Junto al filtro de Hotel: si el hotel paga el lonche, las horas quedan
 * completas (nunca se resta nada). Si no, se resta media hora SOLO cuando el
 * turno llega a 6.5 h — menos que eso, no alcanza a necesitar el descanso y
 * no se resta nada (Hugo, 2026-10-14). Antes era fijo en 30 min para
 * cualquier duración; ahora es una decisión por hotel, guardada.
 *
 * Controlado, no dueño de sus propias consultas: `TimesheetPage` necesita
 * saber "se está guardando" para avisarle a la TABLA que ponga su propio
 * skeleton acotado (Hugo, 2026-10-15: "no que se ponga en toda la tabla el
 * skeleton") — con el estado adentro de este componente, nadie más podía
 * leerlo sin repetir la consulta.
 */
export function HotelPaysLunchToggle({
  checked,
  isSaving,
  onToggle,
}: {
  checked: boolean
  isSaving: boolean
  onToggle: (next: boolean) => void
}): ReactNode {
  const { t } = useLingui()
  /* El interruptor quedaba deshabilitado sin ningún aviso — se sentía
     "pegado" (Hugo, 2026-10-15: "no se deja apagar... deberia aparecer un
     loader"). El guardado SÍ tarda: también invalida el Timesheet entero
     (recalcula el pago de todos). Mismo patrón que `SearchField` — el
     Spinner solo si pasa de 300 ms, para no parpadear en lo instantáneo. */
  const showSpinner = useDelayedFlag(isSaving, 300)

  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-2">
      {/* Un interruptor, no una casilla: es un ajuste del hotel que queda
          prendido o apagado, no una opción de formulario (Hugo, 2026-10-15,
          "la palomita no se ve bien" — el check de 14px se desbordaba de la
          casilla de 16px). */}
      <Switch
        checked={checked}
        disabled={isSaving}
        onCheckedChange={(next) => {
          onToggle(next)
        }}
      />
      <Trans>El hotel paga el lonche (horas completas)</Trans>
      {showSpinner && <Spinner aria-label={t`Guardando`} className="text-o-500" />}
    </label>
  )
}
