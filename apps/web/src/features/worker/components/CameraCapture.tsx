import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import { MaterialIcon } from '@oranje/ui'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { FACE_GUIDE_HINT, useFaceGuide } from './useFaceGuide'

import encuadreBuscandoLottie from '@/assets/selfie/oranje-encuadre-buscando.lottie'
import encuadreListoLottie from '@/assets/selfie/oranje-encuadre-listo.lottie'
import { Button } from '@/shared/components/Button'

/**
 * La cámara dentro de la app: pide permiso al navegador, muestra la cámara
 * frontal y captura un JPEG al tocar. Nada de selector de archivos: la foto
 * del ponche se toma en el momento (RR del ponche). Si el navegador no da
 * cámara o la persona niega el permiso, se dice en palabras y se ofrece la
 * salida de elegir una foto.
 */
export function CameraCapture({
  onCapture,
  onFallback,
  onCancel,
}: {
  onCapture: (file: File) => void
  onFallback: () => void
  onCancel: () => void
}): ReactNode {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isReady, setReady] = useState(false)
  const guide = useFaceGuide(videoRef, isReady)
  /* Sin detección (no cargó) el disparador queda libre; con ella, solo cuando la cara está bien. */
  const canShoot = isReady && (guide === 'ok' || guide === 'unavailable')

  useEffect(() => {
    let cancelled = false
    async function start(): Promise<void> {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Este navegador no puede abrir la cámara.')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => {
            track.stop()
          })
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          setReady(true)
        }
      } catch (cause) {
        const name = cause instanceof DOMException ? cause.name : ''
        setError(
          name === 'NotAllowedError'
            ? 'Sin permiso de cámara no se puede tomar la foto. Permítelo para este sitio y vuelve a intentar.'
            : 'No se pudo abrir la cámara. Cierra otras apps que la usen e inténtalo de nuevo.',
        )
      }
    }
    void start()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((track) => {
        track.stop()
      })
    }
  }, [])

  function capture(): void {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) return
    context.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        onCapture(new File([blob], `ponche-${String(Date.now())}.jpg`, { type: 'image/jpeg' }))
      },
      'image/jpeg',
      0.85,
    )
  }

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="Tomar foto"
      className="fixed inset-0 z-50 flex flex-col bg-ink"
    >
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          className="size-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />
        {/* La guía: un círculo centrado (igual en móvil y escritorio) con el aro Lottie en su borde. */}
        {isReady && (
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 flex items-center justify-center">
              {/* La guía es un CÍRCULO (el asset del aro lo es): su sombra gigante oscurece el
                  resto y el aro Lottie —punteado buscando, verde listo— cae justo en el borde. */}
              <div
                className="relative rounded-full"
                style={{
                  width: 'min(72%, 46vh)',
                  aspectRatio: '1 / 1',
                  boxShadow: '0 0 0 200vmax rgba(26, 17, 8, 0.55)',
                }}
              >
                <DotLottieReact
                  key={guide === 'ok' ? 'listo' : 'buscando'}
                  src={guide === 'ok' ? encuadreListoLottie : encuadreBuscandoLottie}
                  loop
                  autoplay
                  className="absolute -inset-[7%] size-auto"
                />
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-10 text-center">
              <p
                role="status"
                className={`inline-block rounded-full px-4 py-1.5 text-sm font-semibold text-white ${guide === 'ok' ? 'bg-green' : 'bg-ink/60'}`}
              >
                {FACE_GUIDE_HINT[guide]}
              </p>
            </div>
          </div>
        )}
        {!isReady && error === null && (
          <p className="absolute text-sm text-white/80">Abriendo la cámara…</p>
        )}
        {error !== null && (
          <div className="absolute inset-x-6 flex flex-col items-center gap-3 rounded-xl bg-surface p-5 text-center">
            <MaterialIcon name="no_photography" className="text-4xl text-ink-3" aria-hidden />
            <p className="text-sm text-ink-2">{error}</p>
            <Button variant="primary" onClick={onFallback}>
              Elegir una foto
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-4 px-6 py-5">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 cursor-pointer touch-manipulation px-3 text-sm font-semibold text-white/85"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={capture}
          disabled={!canShoot}
          aria-label="Tomar foto"
          className="flex size-18 cursor-pointer touch-manipulation items-center justify-center rounded-full border-4 border-white bg-o-500 shadow-lg disabled:opacity-40"
        >
          <MaterialIcon name="photo_camera" className="text-3xl text-ink" aria-hidden />
        </button>
        <span className="w-20" aria-hidden />
      </div>
    </div>
  )
}
