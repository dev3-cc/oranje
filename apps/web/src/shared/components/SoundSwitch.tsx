import { useLingui } from '@lingui/react/macro'
import { cn, MaterialIcon } from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'

import { isSoundOn, playSound, setSoundOn, SOUND_CHANGED } from '@/shared/lib/sound'

/**
 * Apaga o enciende los sonidos de la app. Vive junto al idioma, en la tarjeta
 * de la cuenta: es una preferencia de quien está sentado aquí, no del sistema.
 *
 * Al encenderlo suena una vez — así se oye qué se está aceptando, y de paso el
 * navegador aprovecha el clic para permitir el audio.
 */
export function SoundSwitch({ className }: { className?: string }): ReactNode {
  const { t } = useLingui()
  const [on, setOn] = useState(isSoundOn)

  /* Si se cambia desde otro lugar (el menú del Colaborador, por ejemplo), este
     interruptor se entera sin recargar. */
  useEffect(() => {
    function sync(): void {
      setOn(isSoundOn())
    }
    window.addEventListener(SOUND_CHANGED, sync)
    return () => {
      window.removeEventListener(SOUND_CHANGED, sync)
    }
  }, [])

  const label = on ? t`Sonido encendido` : t`Sonido apagado`

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={label}
      onClick={() => {
        const next = !on
        setOn(next)
        setSoundOn(next)
        if (next) playSound('navigate')
      }}
      className={cn(
        'flex cursor-pointer items-center gap-1.5 rounded-lg bg-surface-2 px-2 py-1 text-xs font-medium text-ink-3 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500',
        on && 'text-ink',
        className,
      )}
    >
      <MaterialIcon name={on ? 'volume_up' : 'volume_off'} className="text-base" aria-hidden />
      {on ? t`Sonido` : t`Silencio`}
    </button>
  )
}
