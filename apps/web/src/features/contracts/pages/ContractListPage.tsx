import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { MaterialIcon } from '@oranje/ui'
import { useMemo, useState, type ReactNode } from 'react'

import { useGetContractsQuery } from '../api/contractsApi'
import { ContractCardGrid } from '../components/ContractCardGrid'
import { ContractFilters } from '../components/ContractFilters'
import { ANY_VALUE, type ContractListFilters } from '../types/contract.types'

import personajeContratacion from '@/assets/ilustrations/personaje-contratacion.svg'
import personajeCronograma from '@/assets/ilustrations/personaje-cronograma.svg'
import personajePago from '@/assets/ilustrations/personaje-pago-procesado.svg'
import { Button } from '@/shared/components/Button'
import { CardGridSkeleton } from '@/shared/components/CardGridSkeleton'
import { FoldText } from '@/shared/components/FoldText'
import { LoadError } from '@/shared/components/LoadError'
import { Modal } from '@/shared/components/Modal'
import { OnboardingIntro } from '@/shared/components/OnboardingIntro'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { useIntroSeen } from '@/shared/hooks/useIntroSeen'
import { IS_DEV_UI } from '@/shared/lib/devMode'

const EMPTY_FILTERS: ContractListFilters = {
  search: '',
  status: ANY_VALUE,
  zoneName: ANY_VALUE,
  expiresInDays: null,
}

/**
 * Qué es esta pantalla, en tres pasos. Se ve una sola vez.
 *
 * El texto no explica la tabla: explica el DINERO, que es lo que la gente viene
 * a resolver aquí. Quien entra por primera vez no sabe qué distingue un
 * contrato de una propuesta, y ese es el hueco que estas tres tarjetas cierran.
 * El texto se traduce al pintar con `i18n._()` (D-36).
 */
const INTRO_SLIDES: readonly {
  image: string
  title: MessageDescriptor
  text: MessageDescriptor
}[] = [
  {
    image: personajeContratacion,
    title: msg`El hotel ya dijo que sí`,
    text: msg`Aquí vive el acuerdo con cada hotel cliente: lo que se le cobra por hora y lo que se le paga a su gente. Antes de esto, el hotel todavía se estaba convenciendo — eso pasa en Propuestas.`,
  },
  {
    image: personajePago,
    title: msg`De aquí salen la nómina y la factura`,
    text: msg`Cada semana, el pago al colaborador y el cobro al hotel se calculan con estas tarifas y estos recargos. Si el contrato no está activo, ese hotel no puede facturar.`,
  },
  {
    image: personajeCronograma,
    title: msg`Uno vigente por hotel`,
    text: msg`El contrato nace en Borrador, se afina y se activa. Solo puede haber uno vigente a la vez: para renovar, se crea el siguiente y se marca el viejo como vencido. Nunca se borra ninguno.`,
  },
]

export function ContractListPage(): ReactNode {
  const { t, i18n } = useLingui()
  const [filters, setFilters] = useState<ContractListFilters>(EMPTY_FILTERS)
  const [areFiltersOpen, setFiltersOpen] = useState(false)

  /** La búsqueda espera a que se deje de teclear; los selects aplican al instante. */
  const search = useDebounce(filters.search)
  const appliedFilters = useMemo(() => ({ ...filters, search }), [filters, search])
  const { data: list, isLoading, isError, refetch } = useGetContractsQuery(appliedFilters)
  /** El intro se ve UNA vez; «¿Cómo funciona?» del header lo reabre. */
  const { isIntroOpen, dismissIntro, reopenIntro } = useIntroSeen('contracts')
  /* Un buscador y tres filtros permanentes ocupaban una banda entera para
     listas de tres tarjetas. Ahora se despliegan con el botón «Filtrar», como
     en cualquier galería; con un filtro puesto la barra se queda abierta para
     poder quitarlo. */
  const hasFilter =
    filters.search !== '' ||
    filters.status !== ANY_VALUE ||
    filters.zoneName !== ANY_VALUE ||
    filters.expiresInDays !== null
  const showFilters = areFiltersOpen || hasFilter

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            <FoldText text={t`Contratos`} />
          </h1>
          <p className="mt-1.5 text-sm text-ink-3">
            {IS_DEV_UI ? (
              'commercial.contract · un contrato por hotel a la vez en ACTIVE'
            ) : (
              <Trans>
                Lo que cada hotel nos paga y lo que le pagamos a su gente. Un contrato vigente por
                hotel.
              </Trans>
            )}{' '}
            <button
              type="button"
              onClick={reopenIntro}
              className="cursor-pointer font-semibold text-o-700 hover:underline"
            >
              <Trans>¿Cómo funciona?</Trans>
            </button>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => {
              setFiltersOpen((open) => !open)
            }}
            aria-expanded={showFilters}
          >
            <span className="flex items-center gap-1.5">
              <MaterialIcon name="filter_list" aria-hidden className="text-base" />
              <Trans>Filtrar</Trans>
            </span>
          </Button>
        </div>
      </header>

      {showFilters && (
        <ContractFilters
          filters={filters}
          zoneNames={list?.zoneNames ?? []}
          onChange={setFilters}
          onReset={() => {
            setFilters(EMPTY_FILTERS)
          }}
        />
      )}

      {isError && (
        <LoadError
          message={t`No se pudieron cargar los contratos. Reintenta en unos segundos.`}
          onRetry={() => {
            void refetch()
          }}
        />
      )}

      {isLoading && !list ? (
        <CardGridSkeleton cards={6} />
      ) : (
        list &&
        (list.items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line px-4 py-12 text-center">
            <img src={personajeContratacion} alt="" aria-hidden className="h-32 w-auto" />
            <p className="max-w-md text-sm leading-relaxed text-ink-3">
              {hasFilter ? (
                <Trans>Ningún contrato con estos filtros. Prueba a quitar uno.</Trans>
              ) : (
                <Trans>
                  Todavía no hay contratos. El contrato de un hotel nace en su propia ficha del
                  Pipeline, cuando ya vio la propuesta.
                </Trans>
              )}
            </p>
          </div>
        ) : (
          <ContractCardGrid rows={list.items} />
        ))
      )}

      <Modal
        isOpen={isIntroOpen}
        onClose={dismissIntro}
        title={t`Cómo funciona Contratos`}
        chromeless
        className="max-w-2xl"
      >
        <OnboardingIntro
          slides={INTRO_SLIDES.map((slide) => ({
            image: slide.image,
            title: i18n._(slide.title),
            text: i18n._(slide.text),
          }))}
          startLabel={t`Ver los contratos`}
          onDone={dismissIntro}
        />
      </Modal>
    </div>
  )
}
