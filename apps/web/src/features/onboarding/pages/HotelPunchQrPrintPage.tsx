import { toDataURL } from 'qrcode'
import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router'

import { useGetHotelPunchQrQuery } from '../api/onboardingApi'

import { LoadError } from '@/shared/components/LoadError'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { formatDate } from '@/shared/lib/formatters'

/**
 * La hoja del QR de ponche, para imprimir o guardar como PDF desde el
 * navegador. Vive fuera del shell: en papel no hay sidebar. Lleva el nombre
 * del hotel, la versión y la fecha (para saber si la hoja pegada es la
 * vigente) y una instrucción de una línea. El código NO va en texto: si se
 * puede teclear, se puede compartir por mensaje.
 */
export function HotelPunchQrPrintPage(): ReactNode {
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
    return <p className="p-8 text-sm text-ink-3">Preparando el QR…</p>
  }

  if (isError || !data) {
    return (
      <div className="p-8">
        <LoadError
          message={apiErrorMessage(error, {
            byCode: {
              PUNCH_METHOD_NOT_QR: 'Este hotel poncha con selfie: no tiene QR que imprimir.',
              PUNCH_QR_MISSING: 'El hotel no tiene QR generado todavía: regenéralo desde su ficha.',
            },
            byStatus: { 403: 'El QR de otro hotel no te corresponde.' },
            fallback: 'No se pudo cargar el QR. Inténtalo de nuevo.',
          })}
          onRetry={() => {
            void refetch()
          }}
        />
      </div>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center gap-6 bg-white px-8 py-10 text-ink print:min-h-0 print:py-4">
      <div className="flex w-full items-center justify-between print:hidden">
        <p className="text-sm text-ink-3">
          Imprime esta hoja o guárdala como PDF y pégala en el acceso.
        </p>
        <button
          type="button"
          onClick={() => {
            window.print()
          }}
          className="cursor-pointer rounded-md bg-o-300 shadow-xs px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-o-400"
        >
          Imprimir
        </button>
      </div>

      <header className="text-center">
        <p className="text-xs font-semibold tracking-[0.3em] text-o-700 uppercase">Oranje</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{data.hotelName}</h1>
        <p className="mt-1 text-base text-ink-2">Registro de entrada y salida</p>
      </header>

      {dataUrl ? (
        <img
          src={dataUrl}
          alt={`QR de ponche de ${data.hotelName}`}
          className="w-full max-w-md rounded-xl border border-line"
        />
      ) : (
        <p className="text-sm text-ink-3">Generando el código…</p>
      )}

      <p className="max-w-md text-center text-lg leading-relaxed">
        Escanéalo desde la app Oranje al llegar y al salir. La app también toma tu ubicación.
      </p>

      <footer className="mt-auto text-center text-xs text-ink-3">
        Versión {data.version} · generado el {formatDate(data.generatedAt)}. Si el hotel regenera su
        QR, esta hoja deja de servir.
      </footer>
    </main>
  )
}
