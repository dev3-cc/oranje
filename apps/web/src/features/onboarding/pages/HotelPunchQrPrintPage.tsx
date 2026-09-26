import type { I18n } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { toast } from '@oranje/ui'
import { toDataURL } from 'qrcode'
import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router'

import { useGetHotelPunchQrQuery } from '../api/onboardingApi'

import logoOranje from '@/assets/logo/Logo_ORANJE_Orange.png'
import { LoadError } from '@/shared/components/LoadError'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { formatDate } from '@/shared/lib/formatters'
import { buildPunchQrLink } from '@/shared/lib/punchQrLink'

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

/** Precarga una imagen para poder meterla a un PDF (`jsPDF.addImage` la exige ya cargada). */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      resolve(img)
    }
    img.onerror = () => {
      reject(new Error(`No se pudo cargar ${src}`))
    }
    img.src = src
  })
}

/** Nombre de archivo seguro a partir del nombre del hotel. */
function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/**
 * El PDF de verdad — un clic y se descarga, sin pasar por el diálogo de
 * imprimir del navegador (Hugo, 2026-09-26: "descargar" debe descargar).
 * jsPDF compone el mismo contenido de la vista previa: logo, hotel, QR,
 * instrucción y pie con versión/fecha.
 */
async function downloadPunchQrPdf(input: {
  hotelName: string
  qrDataUrl: string
  version: number
  generatedOn: string
  instruction: string
}): Promise<void> {
  const [{ jsPDF }, logo] = await Promise.all([import('jspdf'), loadImage(logoOranje)])

  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const centerX = pageWidth / 2
  const ink = '#1A1108'
  const ink3 = '#8A7A6A'

  const logoWidth = 120
  const logoHeight = logoWidth * (logo.naturalHeight / logo.naturalWidth)
  let y = 64
  doc.addImage(logo, 'PNG', centerX - logoWidth / 2, y, logoWidth, logoHeight)
  y += logoHeight + 28

  doc.setTextColor(ink)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  const hotelLines = doc.splitTextToSize(input.hotelName, pageWidth - 112) as string[]
  for (const line of hotelLines) {
    doc.text(line, centerX, y, { align: 'center' })
    y += 26
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(13)
  doc.setTextColor(ink3)
  doc.text('Registro de entrada y salida', centerX, y + 4, { align: 'center' })
  y += 40

  const qrSize = 260
  doc.addImage(input.qrDataUrl, 'PNG', centerX - qrSize / 2, y, qrSize, qrSize)
  y += qrSize + 32

  doc.setFontSize(14)
  doc.setTextColor(ink)
  const instructionLines = doc.splitTextToSize(input.instruction, pageWidth - 140) as string[]
  for (const line of instructionLines) {
    doc.text(line, centerX, y, { align: 'center' })
    y += 20
  }

  doc.setFontSize(9)
  doc.setTextColor(ink3)
  doc.text(
    `Versión ${String(input.version)} · generado el ${input.generatedOn}`,
    centerX,
    doc.internal.pageSize.getHeight() - 48,
    { align: 'center' },
  )

  doc.save(`qr-ponche-${slugify(input.hotelName)}.pdf`)
}

/**
 * La hoja del QR de ponche, para descargar como PDF con un clic. Vive fuera
 * del shell: en papel no hay sidebar. Lleva el nombre del hotel, la versión y
 * la fecha (para saber si la hoja pegada es la vigente) y una instrucción de
 * una línea. El código NO va en texto: si se puede teclear, se puede
 * compartir por mensaje.
 */
export function HotelPunchQrPrintPage(): ReactNode {
  const { t, i18n } = useLingui()
  const { hotelId = '' } = useParams()
  const { data, isLoading, isError, error, refetch } = useGetHotelPunchQrQuery(hotelId)
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  useEffect(() => {
    if (!data) return
    /* La liga a Ponchar con el código adentro: la cámara del teléfono abre la app ahí. */
    toDataURL(buildPunchQrLink(data.payload), {
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

  async function onDownload(): Promise<void> {
    if (!data || !dataUrl || isDownloading) return
    setIsDownloading(true)
    try {
      await downloadPunchQrPdf({
        hotelName: data.hotelName,
        qrDataUrl: dataUrl,
        version: data.version,
        generatedOn: formatDate(data.generatedAt),
        instruction: t`Escanéalo con la cámara de tu celular al llegar y al salir: te lleva directo a ponchar. También toma tu ubicación.`,
      })
    } catch {
      toast.error(t`No se pudo generar el PDF. Inténtalo de nuevo.`)
    } finally {
      setIsDownloading(false)
    }
  }

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
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center gap-6 bg-white px-8 py-10 text-ink">
      <div className="flex w-full items-center justify-between">
        <p className="text-sm text-ink-3">
          <Trans>Descárgala como PDF y pégala en el acceso.</Trans>
        </p>
        <button
          type="button"
          disabled={!dataUrl || isDownloading}
          onClick={() => {
            void onDownload()
          }}
          className="cursor-pointer rounded-md bg-o-300 shadow-xs px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-o-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isDownloading ? <Trans>Generando…</Trans> : <Trans>Descargar</Trans>}
        </button>
      </div>

      <header className="text-center">
        <img src={logoOranje} alt="Oranje" className="mx-auto h-6 w-auto" />
        <h1 className="mt-3 text-3xl font-bold tracking-tight">{data.hotelName}</h1>
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
          Escanéalo con la cámara de tu celular al llegar y al salir: te lleva directo a ponchar.
          También toma tu ubicación.
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
