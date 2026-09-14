import { Draggable, Droppable } from '@hello-pangea/dnd'
import { statusLight } from '@oranje/ui'
import type { ReactNode } from 'react'

import type { ProspectSummary } from '../types/prospect.types'

import { ProspectCard } from './ProspectCard'

import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import {
  ONBOARDING_STATUS_DESCRIPTION,
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
  type OnboardingStatus,
} from '@/shared/constants/onboardingStatus'

/**
 * Columna del tablero: droppable del drag-and-drop. El título vive en una
 * barra neutra y fija arriba —como un tablero tipo Jira—, separada del
 * tinte de color; el color de SU estado sigue ahí, pero acotado a la zona de
 * tarjetas (apenas insinuado arriba, disuelto hacia abajo) para no competir
 * con el título ni con el contenido. El punto de color del chip ya es señal
 * suficiente de *un color = un significado* en la barra.
 *
 * `self-start` a propósito: la altura la da su contenido, como en el diseño.
 * Durante un arrastre, las columnas a las que el semáforo NO permite ir se
 * deshabilitan y se apagan: el tablero enseña las aristas reales del seed.
 */
export function PipelineColumn({
  status,
  prospects,
  isDropDisabled,
}: {
  status: OnboardingStatus
  prospects: ProspectSummary[]
  /** `true` mientras se arrastra desde un estado sin arista hacia aquí. */
  isDropDisabled: boolean
}): ReactNode {
  const color = statusLight[ONBOARDING_STATUS_TOKEN[status]]

  return (
    <section
      className={`flex w-72 shrink-0 flex-col self-start overflow-hidden rounded-xl border border-line bg-surface transition-opacity ${
        isDropDisabled ? 'opacity-40' : ''
      }`}
    >
      <header className="flex flex-col gap-1 border-b border-line bg-surface px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <StatusLightSoftBadge
            token={ONBOARDING_STATUS_TOKEN[status]}
            label={ONBOARDING_STATUS_LABEL[status]}
          />
          <span className="text-sm font-semibold text-ink-3">{prospects.length}</span>
        </div>
        <p className="text-sm text-ink-3">{ONBOARDING_STATUS_DESCRIPTION[status]}</p>
      </header>

      <div
        className="flex flex-col gap-3 p-2"
        style={{ background: `linear-gradient(180deg, ${color}2e 0%, ${color}05 320px)` }}
      >
        <Droppable droppableId={status} isDropDisabled={isDropDisabled}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`flex min-h-16 flex-col gap-4 rounded-lg pb-2 transition-colors ${
                snapshot.isDraggingOver ? 'bg-surface/60 ring-2 ring-o-500/40' : ''
              }`}
            >
              {prospects.length === 0 && !snapshot.isDraggingOver && (
                <p className="rounded-2xl border border-dashed border-line px-3 py-6 text-center text-sm text-ink-4">
                  Sin prospectos en este estado
                </p>
              )}
              {prospects.map((prospect, index) => (
                <Draggable key={prospect.id} draggableId={prospect.id} index={index}>
                  {(dragProvided, dragSnapshot) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      {...dragProvided.dragHandleProps}
                      className={dragSnapshot.isDragging ? 'rotate-2 opacity-90' : ''}
                    >
                      <ProspectCard prospect={prospect} />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </div>
    </section>
  )
}
