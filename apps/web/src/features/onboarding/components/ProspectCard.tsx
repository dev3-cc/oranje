import { Trans, useLingui } from '@lingui/react/macro'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import type { ProspectSummary } from '../types/prospect.types'
import { resolveActivityLabel } from '../utils/resolveActivityLabel'

import { HotelPhotoBackdrop } from '@/shared/components/HotelPhotoBackdrop'
import { StarBorder } from '@/shared/components/StarBorder'
import { CONTRACT_ELIGIBLE_STATUSES } from '@/shared/constants/onboardingStatus'
import { formatDaysInStatus } from '@/shared/lib/formatters'

/**
 * Tarjeta del tablero, con la foto de Places como portada cuando existe. La
 * tarjeta completa es el enlace al detalle.
 *
 * Los hoteles dados de alta antes de la columna `photo_url` no tienen foto:
 * su portada es un bloque neutro con el icono de hotel, a la misma altura,
 * para que las columnas del kanban no bailen entre tarjetas.
 *
 * La franja de propuesta (pegada al borde superior, hermana del `Link` —no
 * anidada: un `button`/segundo `a` dentro de un `a` es inválido y se peleaba
 * el click con la navegación) cambia según dónde va el prospecto en Verde:
 * sin propuesta es un botón que abre el modal de confirmación
 * (`onCreateProposal`); con borrador o ya enviada es un link directo al
 * workspace (`ProposalEditorPage` ya sabe mostrar uno u otra sin que haga
 * falta distinguir aquí). Mismo criterio que `ProposalsService.create` en el
 * back para cuándo aplica: solo Verde.
 *
 * La franja de contrato (mismo lugar, Amarillo/Rosa/Café) es un link simple a
 * la ficha: no hay "borrador de contrato" que distinguir como en la
 * propuesta, solo avisar que ya se puede armar (Hugo, 2026-10-20).
 */
const BAR_CLASS =
  'flex w-full cursor-pointer items-center justify-center gap-1 rounded-t-2xl bg-o-500 py-2 text-sm font-semibold text-ink shadow-sm transition-colors hover:brightness-95 focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500'

export function ProspectCard({
  prospect,
  onCreateProposal,
}: {
  prospect: ProspectSummary
  onCreateProposal?: (prospect: ProspectSummary) => void
}): ReactNode {
  const { i18n } = useLingui()
  const hasProposal = prospect.latestProposalVersion !== null
  const canCreateProposal =
    onCreateProposal !== undefined && prospect.status === 'GREEN' && !hasProposal
  const canOpenProposal = prospect.status === 'GREEN' && hasProposal
  const showProposalBar = canCreateProposal || canOpenProposal
  /* Mismo criterio que `ProspectDetailPage` para la tarjeta "Sigue el
     contrato" — el Naranja-sin-contrato no se puede saber desde esta tarjeta
     (no trae `hasActiveContract`), así que esa variante no se cubre aquí. */
  const showContractBar = CONTRACT_ELIGIBLE_STATUSES.has(prospect.status)

  return (
    <StarBorder>
      <div className="relative">
        {canCreateProposal && (
          <button
            type="button"
            onClick={() => {
              onCreateProposal?.(prospect)
            }}
            className={BAR_CLASS}
          >
            <Trans>Crear propuesta →</Trans>
          </button>
        )}

        {canOpenProposal && (
          <Link to={`/pipeline/${prospect.id}/proposal`} className={BAR_CLASS}>
            {prospect.latestProposalIsDraft ? (
              <Trans>Continuar borrador →</Trans>
            ) : (
              <Trans>Ver propuesta enviada →</Trans>
            )}
          </Link>
        )}

        {showContractBar && (
          <Link to={`/pipeline/${prospect.id}`} className={BAR_CLASS}>
            <Trans>Sigue el contrato →</Trans>
          </Link>
        )}

        <Link
          to={`/pipeline/${prospect.id}`}
          className={`relative block h-48 overflow-hidden shadow-md transition-shadow hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500 ${
            showProposalBar || showContractBar ? 'rounded-b-2xl' : 'rounded-2xl'
          }`}
        >
          <HotelPhotoBackdrop photoUrl={prospect.photoUrl} />
          {/* El velo oscuro de abajo hacia arriba es lo que hace legible el vidrio con texto blanco. */}
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/35 to-ink/10"
          />
          <span className="absolute top-2 right-2 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white backdrop-blur-sm">
            {formatDaysInStatus(prospect.daysInStatus)}
          </span>

          {/* El panel de vidrio oscuro (el mismo del hero de Inicio y de Perfil). */}
          <div className="absolute inset-x-2 bottom-2 rounded-xl bg-white/15 p-3 text-white backdrop-blur-sm">
            <p className="truncate text-base font-semibold">{prospect.hotelName}</p>
            <p className="mt-0.5 truncate text-sm text-white/80">
              {prospect.zone} · {resolveActivityLabel(prospect, i18n)}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span
                className="size-5 shrink-0 rounded-full border border-white/40 bg-white/20"
                aria-hidden
              />
              <span className="text-sm font-medium text-white/85">{prospect.owner.shortName}</span>
            </div>
          </div>
        </Link>
      </div>
    </StarBorder>
  )
}
