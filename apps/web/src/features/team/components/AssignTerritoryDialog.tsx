import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { toast } from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'

import { useGetTeamZonesQuery, useSetTerritoryMutation } from '../api/teamApi'
import type { TeamMemberCard } from '../types/team.types'

import ilustracionBdc from '@/assets/ilustrations/bdc.svg'
import personajeEncuesta from '@/assets/ilustrations/personaje-encuesta.svg'
import personajeSinResultados from '@/assets/ilustrations/personaje-sin-resultados.svg'
import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { OnboardingIntro } from '@/shared/components/OnboardingIntro'
import { useIntroSeen } from '@/shared/hooks/useIntroSeen'
import { apiErrorMessage } from '@/shared/lib/apiError'

/**
 * La asignación de territorio del BD (`PUT /users/:id/zones`), confirmada en
 * la Matriz el 2026-08-20: la hacen el BDC —manager directo— y el
 * Administrador. La lista completa reemplaza a la anterior; quitar todas las
 * zonas deja al BD sin territorio, que es un estado válido y visible.
 *
 * Las diapositivas del intro; el texto se traduce al pintar con `i18n._()` (D-36).
 */
const INTRO_SLIDES: readonly {
  image: string
  title: MessageDescriptor
  text: MessageDescriptor
}[] = [
  {
    image: ilustracionBdc,
    title: msg`El territorio lo reparte el BDC`,
    text: msg`Las zonas del BD las asigna su coordinador (o el Administrador): son donde abre y trabaja sus prospectos.`,
  },
  {
    image: personajeEncuesta,
    title: msg`La lista reemplaza, no suma`,
    text: msg`Lo que dejes marcado ES el territorio completo del BD — desmarcar una zona se la quita en el mismo guardado.`,
  },
  {
    image: personajeSinResultados,
    title: msg`Sin zonas también es válido`,
    text: msg`Puedes dejar al BD sin territorio: queda visible así en Mi Equipo hasta el siguiente reparto.`,
  },
]

export function AssignTerritoryDialog({
  member,
  onClose,
}: {
  member: TeamMemberCard | null
  onClose: () => void
}): ReactNode {
  const { t, i18n } = useLingui()
  const isOpen = member !== null
  const { data: zones = [] } = useGetTeamZonesQuery(undefined, { skip: !isOpen })
  const [setTerritory, { isLoading, isError, error }] = useSetTerritoryMutation()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const { isIntroOpen: showIntro, dismissIntro } = useIntroSeen('assign-territory')

  useEffect(() => {
    if (!member) return
    /* `?? []`: una caché del overview anterior a este campo no debe tumbar la página. */
    setSelected(new Set((member.zones ?? []).map((zone) => zone.id)))
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
      toast.success(t`Territorio asignado a ${member.fullName}`)
      onClose()
    } catch {
      return
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t`Asignar territorio`}
      description={
        member ? t`Las zonas donde ${member.fullName} abre y trabaja sus prospectos.` : ''
      }
    >
      {showIntro ? (
        <OnboardingIntro
          slides={INTRO_SLIDES.map((slide) => ({
            image: slide.image,
            title: i18n._(slide.title),
            text: i18n._(slide.text),
          }))}
          startLabel={t`Repartir el territorio`}
          onDone={() => {
            dismissIntro()
          }}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {isError && (
            <p role="alert" className="text-sm text-red">
              {apiErrorMessage(error, {
                byStatus: {
                  403: t`Solo el BDC o el Administrador pueden asignar territorio.`,
                },
                fallback: t`No se pudo guardar el territorio. Inténtalo de nuevo.`,
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
              <Trans>Sin zonas elegidas el BD queda sin territorio asignado.</Trans>
            </p>
          )}

          <div className="flex justify-end gap-3 border-t border-line pt-4">
            <Button variant="secondary" onClick={onClose}>
              <Trans>Cancelar</Trans>
            </Button>
            <Button
              variant="primary"
              disabled={isLoading}
              onClick={() => {
                void submit()
              }}
            >
              {isLoading ? t`Guardando…` : t`Guardar territorio`}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
