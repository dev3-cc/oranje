import { Trans, useLingui } from '@lingui/react/macro'
import { MaterialIcon } from '@oranje/ui'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import type { ContractRow } from '../types/contract.types'

import { useGetProposalCandidatesQuery } from '@/features/onboarding'
import { HotelThumbnail } from '@/shared/components/HotelThumbnail'
import { SearchField } from '@/shared/components/SearchField'
import { SectionCard } from '@/shared/components/SectionCard'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import {
  CONTRACT_ELIGIBLE_STATUSES,
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
} from '@/shared/constants/onboardingStatus'

/** A partir de cuántos hoteles el buscador gana su lugar — con uno o dos, solo estorba. */
const SEARCH_THRESHOLD = 4

/**
 * Hoteles que ya pasaron Amarillo (Amarillo/Rosa/Café) y todavía no tienen
 * contrato, ni en Borrador — se cruza contra lo que ya lista Contratos por
 * nombre de hotel, mismo criterio que ya usa `ContractDetailPage` para
 * encontrar el contrato vigente de un hotel.
 *
 * Solo lo hace VISIBLE: el contrato se sigue creando únicamente desde la
 * ficha del Prospecto (Reglas de Negocio — nace en Amarillo, con las tarifas
 * ya cotizadas). Elegir un hotel lleva directo a ese botón — con el intro si
 * nunca lo ha visto — en vez de dejar a medio camino en la ficha (Hugo,
 * 2026-10-20).
 */
/** Naranja normalmente ya tiene contrato — pero si se quedó sin uno
    (Villa Magna, 2026-10-23: se restauró el hotel sin que nunca hubiera
    tenido contrato), sigue siendo candidato. Mismo criterio que ya usa
    `ProspectDetailPage` para mostrar la tarjeta «Sigue el contrato»; aquí
    faltaba y el hotel no aparecía en ningún lado. */
const ORANGE = 'ORANGE'

export function MissingContractsNotice({ rows }: { rows: ContractRow[] }): ReactNode {
  const { t } = useLingui()
  const { data: candidates = [] } = useGetProposalCandidatesQuery()
  const [isOpen, setIsOpen] = useState(true)
  const [search, setSearch] = useState('')

  const hotelsWithContract = new Set(rows.map((row) => row.hotelName))
  const missing = candidates.filter(
    (candidate) =>
      (CONTRACT_ELIGIBLE_STATUSES.has(candidate.prospectStatus) ||
        candidate.prospectStatus === ORANGE) &&
      !hotelsWithContract.has(candidate.hotelName),
  )

  if (missing.length === 0) return null

  const visible = missing.filter((candidate) =>
    candidate.hotelName.toLowerCase().includes(search.trim().toLowerCase()),
  )

  return (
    <SectionCard
      title={t`Hoteles listos para su contrato`}
      subtitle={t`Ya pasaron Amarillo y todavía no tienen contrato, ni en Borrador`}
      action={
        <button
          type="button"
          onClick={() => {
            setIsOpen((open) => !open)
          }}
          aria-expanded={isOpen}
          aria-label={
            isOpen
              ? t`Contraer hoteles listos para su contrato`
              : t`Expandir hoteles listos para su contrato`
          }
          className="flex shrink-0 cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold text-ink-3 hover:bg-o-50 hover:text-o-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
        >
          {missing.length}
          <MaterialIcon
            name={isOpen ? 'expand_less' : 'expand_more'}
            className="text-xl"
            aria-hidden
          />
        </button>
      }
    >
      {isOpen && (
        <div className="flex flex-col gap-3">
          {missing.length >= SEARCH_THRESHOLD && (
            <SearchField
              value={search}
              onChange={setSearch}
              label={t`Buscar hotel`}
              placeholder={t`Nombre del hotel…`}
              className="w-full max-w-xs"
            />
          )}

          {visible.length === 0 ? (
            <p className="px-1 py-2 text-sm text-ink-3">
              <Trans>Ningún hotel coincide con la búsqueda.</Trans>
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {visible.map((candidate) => (
                <li key={candidate.prospectId}>
                  <Link
                    to={`/pipeline/${candidate.prospectId}?createContract=1`}
                    className="flex min-w-0 items-center gap-3 rounded-lg border border-line bg-surface p-3 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
                  >
                    <HotelThumbnail photoUrl={candidate.hotelPhotoUrl} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {candidate.hotelName}
                      </span>
                      <span className="block truncate text-xs text-ink-3">{candidate.zone}</span>
                    </span>
                    <StatusLightSoftBadge
                      token={ONBOARDING_STATUS_TOKEN[candidate.prospectStatus]}
                      label={ONBOARDING_STATUS_LABEL[candidate.prospectStatus]}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </SectionCard>
  )
}
