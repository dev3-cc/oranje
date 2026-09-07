import { MaterialIcon, toast } from '@oranje/ui'
import { useState, type ReactNode } from 'react'

import { useGetHotelQuery, useRegenerateHotelPunchQrMutation } from '../api/onboardingApi'

import { Button } from '@/shared/components/Button'
import { SectionCard } from '@/shared/components/SectionCard'
import { useCan } from '@/shared/hooks/useCan'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { formatDateTime } from '@/shared/lib/formatters'

/**
 * Cómo se poncha en este hotel, y el QR cuando aplica (Reglas de Negocio,
 * «Método de ponche por hotel»). El método se cambia editando el hotel; aquí
 * viven las dos acciones del QR: imprimirlo y regenerarlo. Regenerar es
 * destructivo para la hoja pegada en el acceso, así que pide un segundo toque.
 */
export function HotelPunchQrCard({
  hotelId,
  punchMethod,
  punchQr,
}: {
  hotelId: string
  punchMethod: 'SELFIE' | 'QR'
  punchQr: { version: number; generatedAt: string } | null | undefined
}): ReactNode {
  const can = useCan()
  const canManage = can('hotel:punch_qr')
  const [regenerate, { isLoading }] = useRegenerateHotelPunchQrMutation()
  const [isArmed, setArmed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onRegenerate(): Promise<void> {
    if (!isArmed) {
      setArmed(true)
      return
    }
    setError(null)
    try {
      const next = await regenerate(hotelId).unwrap()
      toast.success(`QR regenerado: versión ${String(next.version)}. Imprime la hoja nueva.`)
      setArmed(false)
    } catch (cause) {
      setError(
        apiErrorMessage(cause, {
          byCode: {
            PUNCH_METHOD_NOT_QR: 'Este hotel poncha con selfie: cambia el método antes.',
          },
          byStatus: { 403: 'Solo el BD, el BDC o el hotel pueden regenerar su QR.' },
          fallback: 'No se pudo regenerar el QR. Inténtalo de nuevo.',
        }),
      )
      setArmed(false)
    }
  }

  return (
    <SectionCard title="Ponche">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-o-50 text-o-700">
          <MaterialIcon
            name={punchMethod === 'QR' ? 'qr_code_2' : 'photo_camera'}
            className="text-xl"
            aria-hidden
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">
            {punchMethod === 'QR' ? 'QR del hotel' : 'Selfie'}
          </p>
          <p className="text-sm text-ink-3">
            {punchMethod === 'QR'
              ? 'El hotel imprime el código en el acceso; la app lo escanea junto con la ubicación.'
              : 'La app toma la foto en el momento de ponchar. Para cambiarlo, edita el hotel.'}
          </p>

          {punchMethod === 'QR' && (
            <div className="mt-3 flex flex-col gap-2">
              <p className="text-xs text-ink-3">
                {punchQr
                  ? `Versión ${String(punchQr.version)} · generado el ${formatDateTime(punchQr.generatedAt)}`
                  : 'Aún no hay QR generado.'}
              </p>
              {canManage ? (
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`/hoteles/${hotelId}/qr-ponche`}
                    target="_blank"
                    rel="noreferrer"
                    title="Abre la hoja lista para imprimir o guardar como PDF"
                    className="inline-flex items-center gap-1.5 rounded-md bg-o-200 px-3 py-1.5 text-sm font-semibold text-o-900 transition-colors hover:bg-o-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
                  >
                    <MaterialIcon name="print" className="text-base" aria-hidden />
                    Imprimir QR
                  </a>
                  <Button
                    variant="secondary"
                    disabled={isLoading}
                    title="El QR anterior deja de servir al instante: hay que cambiar la hoja del acceso"
                    onClick={() => {
                      void onRegenerate()
                    }}
                  >
                    {isLoading
                      ? 'Regenerando…'
                      : isArmed
                        ? 'Confirmar: el anterior deja de servir'
                        : 'Regenerar QR'}
                  </Button>
                  {isArmed && !isLoading && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setArmed(false)
                      }}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-ink-3">
                  El QR lo imprime y regenera el BD, el BDC o el personal del hotel.
                </p>
              )}
              {error && (
                <p role="alert" className="text-sm text-red">
                  {error}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  )
}

/** La misma tarjeta para quien solo conoce el id de su hotel (dashboard del hotel). */
export function HotelPunchQrPanel({ hotelId }: { hotelId: string }): ReactNode {
  const { data: hotel } = useGetHotelQuery(hotelId)
  if (!hotel) return null
  return (
    <HotelPunchQrCard hotelId={hotel.id} punchMethod={hotel.punchMethod} punchQr={hotel.punchQr} />
  )
}
