import { statusLight, statusLightForeground } from '@oranje/ui'
import { gsap } from 'gsap'
import { useEffect, useRef, type ReactNode } from 'react'

import { SectionCard } from '@/shared/components/SectionCard'
import {
  ONBOARDING_STATUS_DESCRIPTION,
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
  type OnboardingStatus,
} from '@/shared/constants/onboardingStatus'
import { IS_DEV_UI } from '@/shared/lib/devMode'

/**
 * El flujo del semáforo como CAMINO animado con GSAP (reemplaza al Sankey,
 * que con pocos prospectos cruzaba cintas y encimaba etiquetas): la línea se
 * dibuja de Gris a Naranja, cada nodo aparece cuando la línea lo alcanza y
 * su conteo sube contando. Los desvíos (Café, Rojo, Negro) cuelgan abajo con
 * conector punteado — reactivan siempre hacia Azul claro (RR-V-07), y eso se
 * dice en palabras en vez de dibujarse como ciclo.
 */
const MAIN_PATH: OnboardingStatus[] = ['GRAY', 'LIGHT_BLUE', 'GREEN', 'YELLOW', 'PINK', 'ORANGE']
const DETOURS: OnboardingStatus[] = ['BROWN', 'RED', 'BLACK']

function FlowNode({
  status,
  count,
  isDetour = false,
}: {
  status: OnboardingStatus
  count: number
  isDetour?: boolean
}): ReactNode {
  const token = ONBOARDING_STATUS_TOKEN[status]

  return (
    <div
      data-flow-node
      className={`flex w-24 shrink-0 flex-col items-center text-center ${isDetour ? 'opacity-90' : ''}`}
    >
      <span
        className="flex size-12 items-center justify-center rounded-full text-base font-bold shadow-sm"
        style={{ backgroundColor: statusLight[token], color: statusLightForeground[token] }}
      >
        <span data-flow-count data-count={count}>
          0
        </span>
      </span>
      <p className="mt-2 text-sm font-semibold text-ink">{ONBOARDING_STATUS_LABEL[status]}</p>
      <p className="mt-0.5 text-xs leading-tight text-ink-3">
        {ONBOARDING_STATUS_DESCRIPTION[status]}
      </p>
    </div>
  )
}

export function PipelineFlowCard({
  countByStatus,
}: {
  countByStatus: Partial<Record<OnboardingStatus, number>>
}): ReactNode {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const nodes = root.querySelectorAll('[data-flow-node]')
    const lines = root.querySelectorAll('[data-flow-line]')
    const counts = root.querySelectorAll<HTMLElement>('[data-flow-count]')
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    const timeline = gsap.timeline()
    if (reduceMotion) {
      gsap.set(nodes, { opacity: 1, scale: 1 })
      gsap.set(lines, { scaleX: 1 })
    } else {
      timeline
        .fromTo(
          lines,
          { scaleX: 0, transformOrigin: 'left center' },
          { scaleX: 1, duration: 0.9, ease: 'power2.out', stagger: 0.1 },
          0,
        )
        .fromTo(
          nodes,
          { opacity: 0, scale: 0.6 },
          { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.6)', stagger: 0.12 },
          0.1,
        )
    }
    /* El conteo SUBE contando hasta su valor real. */
    counts.forEach((element) => {
      const target = Number(element.dataset.count ?? '0')
      if (reduceMotion) {
        element.textContent = String(target)
        return
      }
      const counter = { value: 0 }
      timeline.to(
        counter,
        {
          value: target,
          duration: 0.8,
          ease: 'power1.out',
          snap: { value: 1 },
          onUpdate: () => {
            element.textContent = String(Math.round(counter.value))
          },
        },
        0.4,
      )
    })

    return () => {
      timeline.kill()
    }
  }, [countByStatus])

  return (
    <SectionCard
      title="El flujo del semáforo"
      subtitle={
        IS_DEV_UI
          ? 'catalogs.status_light_transition — el camino principal; los desvíos abajo'
          : 'El camino principal del ciclo; los desvíos abajo'
      }
    >
      <div ref={rootRef} className="overflow-x-auto pb-2">
        {/* El camino principal: Gris → … → Naranja, la línea se dibuja sola. */}
        <div className="flex min-w-max items-start">
          {MAIN_PATH.map((status, index) => (
            <div key={status} className="flex items-start">
              {index > 0 && (
                <div
                  data-flow-line
                  aria-hidden
                  className="mx-1 mt-6 h-1 w-8 rounded-full bg-line sm:w-14"
                />
              )}
              <FlowNode status={status} count={countByStatus[status] ?? 0} />
            </div>
          ))}
        </div>

        {/* Los desvíos: pausa, rechazo y cierre, con su conector punteado. */}
        <div className="mt-4 flex min-w-max items-start gap-2 border-t border-dashed border-line pt-4">
          {DETOURS.map((status) => (
            <FlowNode key={status} status={status} count={countByStatus[status] ?? 0} isDetour />
          ))}
          <p className="max-w-56 self-center pl-2 text-xs leading-relaxed text-ink-3">
            {IS_DEV_UI
              ? 'Rojo, Café y Negro reactivan siempre hacia Azul claro (RR-V-07).'
              : 'Rojo, Café y Negro pueden reactivarse: vuelven a Azul claro.'}
          </p>
        </div>
      </div>
    </SectionCard>
  )
}
