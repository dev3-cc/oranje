import { Trans, useLingui } from '@lingui/react/macro'
import { useMemo, useState, type ReactNode } from 'react'

import type { ProposalVersionSummary } from '../types/proposal.types'

import personajeContratacion from '@/assets/ilustrations/personaje-contratacion.svg'
import { NewContractDialog, type RateDraft } from '@/features/contracts'
import { Button } from '@/shared/components/Button'
import { useCan } from '@/shared/hooks/useCan'

/**
 * El contrato nace AQUÍ, dentro del ciclo del hotel, no desde una lista donde
 * haya que elegir el hotel a mano (Reglas de Negocio: el Documento de T&C se
 * crea en Amarillo, cuando el hotel ya vio la propuesta).
 *
 * Y nace con el cuadro de la propuesta que se le envió: volver a teclear las
 * tarifas era doble captura y la puerta por donde se colaban números que no
 * coincidían con lo cotizado.
 */
export function ContractStepCard({
  hotel,
  versions,
}: {
  hotel: { id: string; name: string; photoUrl: string | null }
  versions: ProposalVersionSummary[]
}): ReactNode {
  const { t } = useLingui()
  const can = useCan()
  const [isOpen, setOpen] = useState(false)

  /** Lo que el hotel tiene en la mano: la última versión enviada. */
  const lastSent = useMemo(
    () =>
      [...versions]
        .filter((version) => version.sentAt !== null)
        .sort((a, b) => b.version - a.version)[0] ?? null,
    [versions],
  )

  const initialRates = useMemo<RateDraft[] | null>(
    () =>
      lastSent && lastSent.rates.length > 0
        ? lastSent.rates.map((rate) => ({
            catalogPositionId: rate.positionId,
            payRate: rate.payRate.toFixed(2),
            billRate: rate.billRate.toFixed(2),
          }))
        : null,
    [lastSent],
  )

  if (!can('terms_and_conditions:create')) return null

  return (
    <div className="rounded-lg border border-line bg-surface p-5">
      <div className="flex items-start gap-4">
        <img src={personajeContratacion} alt="" aria-hidden className="h-20 w-auto shrink-0" />
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-ink">
            <Trans>Sigue el contrato</Trans>
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-ink-3">
            {lastSent ? (
              <Trans>
                El hotel ya tiene la propuesta v{String(lastSent.version)}. El contrato nace con
                esas mismas tarifas: las revisas, ajustas lo que se haya negociado y lo guardas en
                Borrador.
              </Trans>
            ) : (
              <Trans>
                Manda primero la propuesta: el contrato se arma con las tarifas que el hotel aceptó.
              </Trans>
            )}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <Button
          variant="primary"
          disabled={lastSent === null}
          title={lastSent === null ? t`Primero envía una propuesta al hotel` : undefined}
          onClick={() => {
            setOpen(true)
          }}
        >
          <Trans>Crear el contrato</Trans>
        </Button>
      </div>

      <NewContractDialog
        isOpen={isOpen}
        onClose={() => {
          setOpen(false)
        }}
        hotel={hotel}
        initialRates={initialRates}
      />
    </div>
  )
}
