import type { I18n } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { toDataURL } from 'qrcode'
import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router'

import { useGetHotelPunchQrQuery } from '../api/onboardingApi'

import { LoadError } from '@/shared/components/LoadError'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { formatDate } from '@/shared/lib/formatters'

/** El `i18n` viene del componente (`useLingui`): así el mensaje habla el idioma activo (D-36). */
function punchQrErrorMessage(error: unknown, i18n: I18n): string {
  return apiErrorMessage(error, {
    byCode: {
      PUNCH_METHOD_NOT_QR: i18n._(msg`Este hotel poncha con selfie: no tiene QR que imprimir.`),
      PUNCH_QR_MISSING: i18n._(
        msg`El hotel no tiene QR generado todavía: regenéralo desde su ficha.`,
      ),
    },
    byStatus: { 403: i18n._(msg`El QR de otro hotel no te corresponde.`) },
    fallback: i18n._(msg`No se pudo cargar el QR. Inténtalo de nuevo.`),
  })
}

/**
 * La hoja del QR de ponche, para imprimir o guardar como PDF desde el
 * navegador. Vive fuera del shell: en papel no hay sidebar. Lleva el nombre
 * del hotel, la versión y la fecha (para saber si la hoja pegada es la
 * vigente) y una instrucción de una línea. El código NO va en texto: si se
 * puede teclear, se puede compartir por mensaje.
 */
export function HotelPunchQrPrintPage(): ReactNode {
  const { t, i18n } = useLingui()
  const { hotelId = '' } = useParams()
  const { data, isLoading, isError, error, refetch } = useGetHotelPunchQrQuery(hotelId)
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!data) return
    toDataURL(data.payload, {
      margin: 2,
      width: 560,
      errorCorrectionLevel: 'M',
      color: { dark: '#1A1108', light: '#FFFFFF' },
    })
      .then(setDataUrl)
      .catch(() => {
        setDataUrl(null)
      })
  }, [data])

  if (isLoading) {
    return (
      <p className="p-8 text-sm text-ink-3">
        <Trans>Preparando el QR…</Trans>
      </p>
    )
  }

  if (isError || !data) {
    return (
      <div className="p-8">
        <LoadError
          message={punchQrErrorMessage(error, i18n)}
          onRetry={() => {
            void refetch()
          }}
        />
      </div>
    )
  }

  const generatedOn = formatDate(data.generatedAt)

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center gap-6 bg-white px-8 py-10 text-ink print:min-h-0 print:py-4">
      <div className="flex w-full items-center justify-between print:hidden">
        <p className="text-sm text-ink-3">
          <Trans>Imprime esta hoja o guárdala como PDF y pégala en el acceso.</Trans>
        </p>
        <button
          type="button"
          onClick={() => {
            window.print()
          }}
          className="cursor-pointer rounded-md bg-o-300 shadow-xs px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-o-400"
        >
          <Trans>Imprimir</Trans>
        </button>
      </div>

      <header className="text-center">
        <p className="text-xs font-semibold tracking-[0.3em] text-o-700 uppercase">Oranje</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{data.hotelName}</h1>
        <p className="mt-1 text-base text-ink-2">
          <Trans>Registro de entrada y salida</Trans>
        </p>
      </header>

      {dataUrl ? (
        <img
          src={dataUrl}
          alt={t`QR de ponche de ${data.hotelName}`}
          className="w-full max-w-md rounded-xl border border-line"
        />
      ) : (
        <p className="text-sm text-ink-3">
          <Trans>Generando el código…</Trans>
        </p>
      )}

      <p className="max-w-md text-center text-lg leading-relaxed">
        <Trans>
          Escanéalo desde la app Oranje al llegar y al salir. La app también toma tu ubicación.
        </Trans>
      </p>

      <footer className="mt-auto text-center text-xs text-ink-3">
        <Trans>
          Versión {data.version} · generado el {generatedOn}. Si el hotel regenera su QR, esta hoja
          deja de servir.
        </Trans>
      </footer>
    </main>
  )
}
