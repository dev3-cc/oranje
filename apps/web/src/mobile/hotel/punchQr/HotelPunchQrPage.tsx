import type { I18n } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { MaterialIcon, toast } from '@oranje/ui'
import { toDataURL } from 'qrcode'
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import { baseApi } from '@/app/baseApi'
import { useGetSessionQuery } from '@/app/sessionApi'
import { LoadError } from '@/shared/components/LoadError'
import { useCan } from '@/shared/hooks/useCan'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { formatDateTime } from '@/shared/lib/formatters'
import { buildPunchQrLink } from '@/shared/lib/punchQrLink'
import type { ApiEnvelope, HotelApi, PunchQrApi } from '@/shared/types/apiContract.types'

/**
 * El dominio de la liga del QR, fijo. En el web se toma de la página; en la
 * app la página es `https://mi.oranjepeople.com` en Android pero
 * `capacitor://mi.oranjepeople.com` en iOS (ver `apps/mobile/CLAUDE.md`), y un
 * QR con `capacitor://` no lo abre la cámara de nadie.
 */
const PUNCH_QR_ORIGIN = 'https://mi.oranjepeople.com'

const punchQrAppApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /** El método de ponche del hotel: el QR solo existe si el hotel poncha con QR. */
    appHotelPunchMethod: build.query<HotelApi['punchMethod'], string>({
      query: (hotelId) => `/hotels/${hotelId}`,
      transformResponse: (raw: ApiEnvelope<HotelApi>) => raw.data.punchMethod,
      providesTags: (_res, _err, hotelId) => [{ type: 'Hotel' as const, id: hotelId }],
    }),
    appHotelPunchQr: build.query<PunchQrApi, string>({
      query: (hotelId) => `/hotels/${hotelId}/punch-qr`,
      transformResponse: (raw: ApiEnvelope<PunchQrApi>) => raw.data,
      providesTags: (_res, _err, hotelId) => [
        { type: 'Hotel' as const, id: `${hotelId}-punch-qr` },
      ],
    }),
    /** Regenerar invalida el QR anterior al instante: hay que cambiar la hoja del acceso. */
    appRegenerateHotelPunchQr: build.mutation<PunchQrApi, string>({
      query: (hotelId) => ({ url: `/hotels/${hotelId}/punch-qr/regenerate`, method: 'POST' }),
      invalidatesTags: (_res, _err, hotelId) => [
        { type: 'Hotel' as const, id: hotelId },
        { type: 'Hotel' as const, id: `${hotelId}-punch-qr` },
      ],
    }),
  }),
})

const {
  useAppHotelPunchMethodQuery,
  useAppHotelPunchQrQuery,
  useAppRegenerateHotelPunchQrMutation,
} = punchQrAppApi

function regenerateErrorMessage(error: unknown, i18n: I18n): string {
  return apiErrorMessage(error, {
    fallback: i18n._(msg`No se pudo regenerar el QR. Inténtalo de nuevo.`),
  })
}

/**
 * El QR de ponche del hotel en la app (`hotel:punch_qr`): grande, para
 * enseñarlo en la puerta o tomarle captura y mandarlo a imprimir, y con
 * «Regenerar» confirmado — el anterior deja de servir al instante.
 *
 * No hay «Descargar» como en el web: aquel abre una hoja para guardar como PDF
 * y dentro de la app el WebView no descarga archivos.
 */
export function HotelPunchQrPage(): ReactNode {
  const { t, i18n } = useLingui()
  const can = useCan()
  const { data: session } = useGetSessionQuery()
  const hotelId = session?.hotel?.id ?? ''
  const { data: punchMethod, isLoading: isLoadingMethod } = useAppHotelPunchMethodQuery(hotelId, {
    skip: hotelId === '',
  })
  const usesQr = punchMethod === 'QR'
  const {
    data: qr,
    isLoading: isLoadingQr,
    error,
    refetch,
  } = useAppHotelPunchQrQuery(hotelId, { skip: hotelId === '' || !usesQr })
  const isLoading = isLoadingMethod || isLoadingQr
  const [regenerate, { isLoading: isRegenerating }] = useAppRegenerateHotelPunchQrMutation()
  const [image, setImage] = useState<string | null>(null)
  const [isArmed, setArmed] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!qr) return
    let cancelled = false
    void toDataURL(buildPunchQrLink(qr.payload, PUNCH_QR_ORIGIN), {
      width: 640,
      margin: 1,
      errorCorrectionLevel: 'M',
    }).then((url) => {
      if (!cancelled) setImage(url)
    })
    return () => {
      cancelled = true
    }
  }, [qr])

  async function onRegenerate(): Promise<void> {
    if (!isArmed) {
      setArmed(true)
      return
    }
    setActionError(null)
    try {
      const next = await regenerate(hotelId).unwrap()
      const version = String(next.version)
      toast.success(t`QR regenerado: versión ${version}. Cambia la hoja del acceso.`)
      setArmed(false)
    } catch (cause) {
      setActionError(regenerateErrorMessage(cause, i18n))
      setArmed(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <Link
        to="/hotel"
        className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-o-700"
      >
        <MaterialIcon name="arrow_back" className="text-lg" aria-hidden />
        <Trans>Inicio</Trans>
      </Link>
      <div>
        <h1 className="text-xl font-bold text-ink">
          <Trans>QR de ponche</Trans>
        </h1>
        <p className="text-sm text-ink-3">{session?.hotel?.name ?? ''}</p>
      </div>

      {isLoading ? (
        <div className="aspect-square animate-pulse rounded-2xl bg-surface-2" />
      ) : punchMethod !== undefined && !usesQr ? (
        <p className="rounded-xl bg-surface-2 p-4 text-sm text-ink-2">
          <Trans>
            Tu hotel poncha con selfie: la app toma la foto en el momento de ponchar y no hace falta
            QR. Para cambiarlo, pídeselo a Oranje.
          </Trans>
        </p>
      ) : error ? (
        <LoadError
          message={apiErrorMessage(error, { fallback: t`No se pudo cargar el QR del hotel.` })}
          onRetry={() => {
            void refetch()
          }}
        />
      ) : qr ? (
        <>
          <section className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface p-5">
            {image ? (
              <img
                src={image}
                alt={t`QR de ponche de ${qr.hotelName}`}
                className="aspect-square w-full max-w-72"
              />
            ) : (
              <div className="aspect-square w-full max-w-72 animate-pulse rounded-xl bg-surface-2" />
            )}
            <p className="text-center text-xs text-ink-3">
              {t`Versión ${String(qr.version)} · generado el ${formatDateTime(qr.generatedAt)}`}
            </p>
          </section>
          <p className="rounded-xl bg-surface-2 p-3 text-sm text-ink-2">
            <Trans>
              El colaborador lo escanea al entrar y al salir, junto con su ubicación. Para
              imprimirlo, tómale captura o descárgalo desde el web.
            </Trans>
          </p>
          {actionError && (
            <p role="alert" className="rounded-xl bg-red/10 p-3 text-sm text-red">
              {actionError}
            </p>
          )}
          {can('hotel:punch_qr') && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={isRegenerating}
                onClick={() => {
                  void onRegenerate()
                }}
                className={
                  isArmed
                    ? 'min-h-12 rounded-xl bg-red px-4 text-sm font-semibold text-surface disabled:opacity-50'
                    : 'min-h-12 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink disabled:opacity-50'
                }
              >
                {isRegenerating
                  ? t`Regenerando…`
                  : isArmed
                    ? t`Confirmar: el anterior deja de servir`
                    : t`Regenerar QR`}
              </button>
              {isArmed && !isRegenerating && (
                <button
                  type="button"
                  onClick={() => {
                    setArmed(false)
                  }}
                  className="min-h-12 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink-2"
                >
                  <Trans>Cancelar</Trans>
                </button>
              )}
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
