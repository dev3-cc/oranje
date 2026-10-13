import { useLingui } from '@lingui/react/macro'
import { driver } from 'driver.js'
import { useEffect, type ReactNode } from 'react'

import personajeManager from '@/assets/ilustrations/personaje-manager.svg'
import { useIntroSeen } from '@/shared/hooks/useIntroSeen'

const TARGET_SELECTOR = '[data-tour="day-status-picker"]'

/**
 * Piloto del tour guiado (driver.js): resalta el PRIMER selector de día sin
 * marcar que haya en pantalla y explica, con el mismo personaje que ya usa
 * Timesheet, que hay que elegir Descanso/OFF antes de poder enviar la semana.
 * Se ve una sola vez por navegador — mismo criterio que `OnboardingIntro`,
 * pero apuntando al elemento real en vez de un modal aparte (Hugo, 2026-10-12:
 * "el personal del hotel aún no lo marca, díganle que lo haga").
 */
export function DayStatusTour(): ReactNode {
  const { t } = useLingui()
  const { isIntroOpen, dismissIntro } = useIntroSeen('day-status-tour')

  useEffect(() => {
    if (!isIntroOpen) return
    const target = document.querySelector(TARGET_SELECTOR)
    if (!target) return

    /* `destroy()` dispara `onDestroyed` SIEMPRE, también cuando lo cierra el
       cleanup de este efecto (cambiar de trabajador, o el doble-montaje de
       Strict Mode en desarrollo) — sin esta bandera, el tour se marcaba
       "visto" sin que nadie lo hubiera visto. Solo cuenta como visto si lo
       cerró la propia persona. */
    let dismissedByUser = false

    const onConfirm = (): void => {
      dismissedByUser = true
      tour.destroy()
    }

    const tour = driver({
      allowClose: true,
      overlayOpacity: 0.55,
      stagePadding: 6,
      stageRadius: 8,
      popoverClass: 'oranje-driver-popover',
      closeBtnLabel: t`Cerrar`,
      onDestroyed: () => {
        if (dismissedByUser) dismissIntro()
      },
      onPopoverRender: (popover) => {
        const img = document.createElement('img')
        img.src = personajeManager
        img.alt = ''
        img.className = 'oranje-driver-character'
        popover.wrapper.insertBefore(img, popover.title)
      },
    })

    /* `highlight()` (a diferencia de `drive()`) ignora `showButtons`/
       `onNextClick` del nivel de configuración de arriba — los fuerza vacíos
       salvo que se pasen DENTRO del `popover` de esta llamada misma. */
    tour.highlight({
      element: TARGET_SELECTOR,
      popover: {
        title: t`Marca los días sin ponches`,
        description: t`Un día sin marcas no se puede enviar a aprobar hasta que elijas qué fue: Descanso, OFF… Tócalo aquí para marcarlo.`,
        showButtons: ['next'],
        nextBtnText: t`Entendido`,
        onNextClick: onConfirm,
        onCloseClick: onConfirm,
      },
    })

    return () => {
      tour.destroy()
    }
    // Corre una vez al montar; `t` cambia con el idioma pero el tour no se re-dispara por eso.
  }, [isIntroOpen])

  return null
}
