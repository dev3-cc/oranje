import { useEffect, useState, type ReactNode } from 'react'

import { useGetTeamZonesQuery, useSetTerritoryMutation } from '../api/teamApi'
import type { TeamMemberCard } from '../types/team.types'

import ilustracionBdc from '@/assets/ilustrations/bdc.svg'
import personajeEncuesta from '@/assets/ilustrations/personaje-encuesta.svg'
import personajeSinResultados from '@/assets/ilustrations/personaje-sin-resultados.svg'
import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { OnboardingIntro } from '@/shared/components/OnboardingIntro'
import { apiErrorMessage } from '@/shared/lib/apiError'

/**
 * La asignación de territorio del BD (`PUT /users/:id/zones`), confirmada en
 * la Matriz el 2026-08-20: la hacen el BDC —manager directo— y el
 * Administrador. La lista completa reemplaza a la anterior; quitar todas las
 * zonas deja al BD sin territorio, que es un estado válido y visible.
 */
const INTRO_SLIDES = [
  {
    image: ilustracionBdc,
    title: 'El territorio lo reparte el BDC',
    text: 'Las zonas del BD las asigna su coordinador (o el Administrador): son donde abre y trabaja sus prospectos.',
  },
  {
    image: personajeEncuesta,
    title: 'La lista reemplaza, no suma',
    text: 'Lo que dejes marcado ES el territorio completo del BD — desmarcar una zona se la quita en el mismo guardado.',
  },
  {
    image: personajeSinResultados,
    title: 'Sin zonas también es válido',
    text: 'Puedes dejar al BD sin territorio: queda visible así en Mi Equipo hasta el siguiente reparto.',
  },
] as const

export function AssignTerritoryDialog({
  member,
  onClose,
}: {
  member: TeamMemberCard | null
  onClose: () => void
}): ReactNode {
  const isOpen = member !== null
  const { data: zones = [] } = useGetTeamZonesQuery(undefined, { skip: !isOpen })
  const [setTerritory, { isLoading, isError, error }] = useSetTerritoryMutation()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showIntro, setShowIntro] = useState(false)

  useEffect(() => {
    if (!member) return
    /* `?? []`: una caché del overview anterior a este campo no debe tumbar la página. */
    setSelected(new Set((member.zones ?? []).map((zone) => zone.id)))
    setShowIntro(true)
  }, [member])

  function toggle(zoneId: string): void {
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(zoneId)) next.delete(zoneId)
      else next.add(zoneId)
      return next
    })
  }

  async function submit(): Promise<void> {
    if (!member || isLoading) return
    try {
      await setTerritory({ userId: member.id, zoneIds: [...selected] }).unwrap()
      onClose()
    } catch {
      return
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Asignar territorio"
      description={
        member ? `Las zonas donde ${member.fullName} abre y trabaja sus prospectos.` : ''
      }
    >
      {showIntro ? (
        <OnboardingIntro
          slides={INTRO_SLIDES}
          startLabel="Repartir el territorio"
          onDone={() => {
            setShowIntro(false)
          }}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {isError && (
            <p role="alert" className="text-sm text-red">
              {apiErrorMessage(error, {
                byStatus: {
                  403: 'Asignar territorio es del BDC o del Administrador (Matriz de Ventas).',
                },
                fallback: 'No se pudo guardar el territorio. Inténtalo de nuevo.',
              })}
            </p>
          )}

          <ul className="flex flex-col gap-1.5">
            {zones.map((zone) => (
              <li key={zone.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-md border border-line p-3 transition-colors hover:bg-surface-2 has-checked:border-o-500 has-checked:bg-o-50">
                  <input
                    type="checkbox"
                    checked={selected.has(zone.id)}
                    onChange={() => {
                      toggle(zone.id)
                    }}
                    className="size-4 accent-o-500"
                  />
                  <span className="text-sm font-medium text-ink">{zone.name}</span>
                </label>
              </li>
            ))}
          </ul>

          {selected.size === 0 && (
            <p className="text-xs text-ink-3">
              Sin zonas elegidas el BD queda sin territorio asignado.
            </p>
          )}

          <div className="flex justify-end gap-3 border-t border-line pt-4">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              disabled={isLoading}
              onClick={() => {
                void submit()
              }}
            >
              {isLoading ? 'Guardando…' : 'Guardar territorio'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
