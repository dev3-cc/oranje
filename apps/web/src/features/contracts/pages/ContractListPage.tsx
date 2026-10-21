import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { cn, MaterialIcon } from '@oranje/ui'
import { useMemo, useState, type ReactNode } from 'react'

import { useGetContractsQuery } from '../api/contractsApi'
import { ContractFilters } from '../components/ContractFilters'
import { MissingContractsNotice } from '../components/MissingContractsNotice'
import { ANY_VALUE, type ContractListFilters } from '../types/contract.types'

import { ContractDetailPage } from './ContractDetailPage'

import fotoEquipo from '@/assets/ilustrations/contratos-equipo.webp'
import personajeContratacion from '@/assets/ilustrations/personaje-contratacion.svg'
import personajeCronograma from '@/assets/ilustrations/personaje-cronograma.svg'
import personajePago from '@/assets/ilustrations/personaje-pago-procesado.svg'
import { Button } from '@/shared/components/Button'
import { CardGridSkeleton } from '@/shared/components/CardGridSkeleton'
import { DetailSkeleton } from '@/shared/components/DetailSkeleton'
import { FoldText } from '@/shared/components/FoldText'
import { HotelThumbnail } from '@/shared/components/HotelThumbnail'
import { LoadError } from '@/shared/components/LoadError'
import { MagicCard } from '@/shared/components/MagicCard'
import { Modal } from '@/shared/components/Modal'
import { OnboardingIntro } from '@/shared/components/OnboardingIntro'
import { SearchField } from '@/shared/components/SearchField'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import { CONTRACT_STATUS_LABEL, CONTRACT_STATUS_TOKEN } from '@/shared/constants/contractStatus'
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

/**
 * Lista-detalle, como Propuestas (Hugo, 2026-10-20): la lista se contrae para
 * darle ancho a los inputs y la vista previa del documento. Vivía como una
 * galería de tarjetas sin detalle embebido — esa vista se retiró, no coexiste
 * con esta.
 */
export function ContractListPage(): ReactNode {
  const { t, i18n } = useLingui()
  const [filters, setFilters] = useState<ContractListFilters>(EMPTY_FILTERS)
  const [areFiltersOpen, setFiltersOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isListCollapsed, setIsListCollapsed] = useState(false)

  /** La búsqueda espera a que se deje de teclear; los selects aplican al instante. */
  const search = useDebounce(filters.search)
  const appliedFilters = useMemo(() => ({ ...filters, search }), [filters, search])
  const { data: list, isLoading, isError, refetch } = useGetContractsQuery(appliedFilters)
  /** El intro se ve UNA vez; «¿Cómo funciona?» del header lo reabre. */
  const { isIntroOpen, dismissIntro, reopenIntro } = useIntroSeen('contracts')
  /* Un buscador y tres filtros permanentes ocupaban una banda entera para
     listas de tres tarjetas, así que los tres de categoría se desplegaban con
     el botón «Filtrar». El buscador por hotel volvió a quedar siempre visible
     (Hugo, 2026-10-21): escondido detrás de un clic, nadie lo encontraba. Con
     un filtro de categoría puesto la barra se queda abierta para poder
     quitarlo. */
  const hasCategoryFilter =
    filters.status !== ANY_VALUE || filters.zoneName !== ANY_VALUE || filters.expiresInDays !== null
  const hasAnyFilter = filters.search !== '' || hasCategoryFilter
  const showFilters = areFiltersOpen || hasCategoryFilter

  const items = list?.items ?? []
  /** Siempre hay un contrato abierto: el elegido o el primero de la lista. */
  const selected = items.find((row) => row.id === selectedId) ?? items[0] ?? null

  return (
    <div className="flex flex-col gap-6">
      {/* Misma cabecera-tarjeta que Conversión y Propuestas: título a la
          izquierda, la foto del equipo sentada en el borde inferior. */}
      <header className="relative flex items-end justify-between gap-4 rounded-2xl border border-line bg-gradient-to-r from-o-50 via-surface to-surface px-6 pt-5 pb-5 [clip-path:inset(-3rem_0_0_0_round_1rem)] sm:mt-8 sm:min-h-44 sm:pr-80">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            <FoldText text={t`Contratos`} />
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-ink-3">
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
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <SearchField
              value={filters.search}
              onChange={(value) => {
                setFilters((prev) => ({ ...prev, search: value }))
              }}
              label={t`Buscar contrato`}
              placeholder={t`Hotel o número de contrato, p. ej. Puerto Real…`}
              className="w-full max-w-md"
            />
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
        </div>
        <img
          src={fotoEquipo}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-2 -bottom-1 hidden h-[calc(100%+2.5rem)] w-auto object-contain object-bottom drop-shadow-[0_10px_18px_rgba(60,30,0,0.26)] md:block"
        />
      </header>

      <MissingContractsNotice rows={items} />

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

      {isLoading && !list && (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <CardGridSkeleton cards={5} className="grid-cols-1" />
          <DetailSkeleton />
        </div>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line px-4 py-12 text-center">
          <img src={personajeContratacion} alt="" aria-hidden className="h-32 w-auto" />
          <p className="max-w-md text-sm leading-relaxed text-ink-3">
            {hasAnyFilter ? (
              <Trans>Ningún contrato con estos filtros. Prueba a quitar uno.</Trans>
            ) : (
              <Trans>
                Todavía no hay contratos. El contrato de un hotel nace en su propia ficha del
                Pipeline, cuando ya vio la propuesta.
              </Trans>
            )}
          </p>
        </div>
      )}

      {items.length > 0 && (
        <>
          {/* Arriba de las dos columnas, no adentro de la lista — mismo
              criterio que Propuestas. Solo en escritorio. */}
          <button
            type="button"
            onClick={() => {
              setIsListCollapsed((collapsed) => !collapsed)
            }}
            aria-expanded={!isListCollapsed}
            className="hidden w-fit cursor-pointer items-center gap-1.5 self-start rounded-md border border-line bg-surface px-3 py-2 text-sm font-medium whitespace-nowrap text-ink-3 transition-colors hover:bg-surface-2 hover:text-o-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500 lg:flex"
          >
            <MaterialIcon
              name={isListCollapsed ? 'chevron_right' : 'chevron_left'}
              className="text-lg"
              aria-hidden
            />
            {isListCollapsed ? t`Ver lista de contratos` : t`Cerrar lista de contratos`}
          </button>

          <div
            className={cn(
              'grid grid-cols-1 items-start gap-5 transition-[grid-template-columns] duration-200',
              /* Una sola columna al contraer: dos columnas con la primera en
                 0 deja el panel de la derecha auto-colocado en la columna
                 equivocada y todo se ve en blanco (mismo bug que Propuestas,
                 2026-10-19). */
              isListCollapsed ? 'lg:grid-cols-1' : 'lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]',
            )}
          >
            <ul
              className={cn(
                '-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0',
                isListCollapsed && 'lg:hidden',
              )}
            >
              {items.map((row) => {
                const isSelected = row.id === selected?.id
                return (
                  <li key={row.id} className="w-72 shrink-0 snap-start lg:w-auto">
                    <MagicCard className="rounded-xl">
                      <button
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => {
                          setSelectedId(row.id)
                        }}
                        className={`w-full cursor-pointer touch-manipulation rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500 ${isSelected ? 'border-o-500 bg-o-50' : 'border-line bg-surface hover:bg-surface-2'}`}
                      >
                        <div className="flex items-center gap-3">
                          <HotelThumbnail photoUrl={row.hotelPhotoUrl} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-ink">
                              {row.hotelName}
                            </span>
                            <span className="block truncate text-xs text-ink-3">
                              {row.zoneName}
                            </span>
                          </span>
                          <StatusLightSoftBadge
                            token={CONTRACT_STATUS_TOKEN[row.status]}
                            label={CONTRACT_STATUS_LABEL[row.status]}
                          />
                        </div>
                        <p className="mt-2 text-xs text-ink-3">{row.number}</p>
                      </button>
                    </MagicCard>
                  </li>
                )
              })}
            </ul>

            {selected && (
              <div className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-var(--hd)-3rem)] lg:overflow-y-auto">
                <ContractDetailPage contractId={selected.id} embedded />
              </div>
            )}
          </div>
        </>
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
