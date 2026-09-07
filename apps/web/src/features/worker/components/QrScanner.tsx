import { MaterialIcon } from '@oranje/ui'
import jsQR from 'jsqr'
import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * El lector del QR impreso del hotel: cámara trasera, un cuadro de guía y
 * lectura continua hasta que un código aparece. Usa `BarcodeDetector` cuando
 * el navegador lo trae y jsQR sobre un canvas cuando no (Safari). No admite
 * teclear el código: si se puede teclear, se puede compartir por mensaje.
 */
export function QrScanner({
  onScan,
  onCancel,
}: {
  onScan: (code: string) => void
  onCancel: () => void
}): ReactNode {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const doneRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [isReady, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function start(): Promise<void> {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Este navegador no puede abrir la cámara.')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 960 } },
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
            ? 'Sin permiso de cámara no se puede leer el QR. Permítelo para este sitio y vuelve a intentar.'
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

  useEffect(() => {
    if (!isReady) return
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { willReadFrequently: true })
    const detector = createDetector()
    let frame = 0

    const finish = (code: string): void => {
      if (doneRef.current) return
      doneRef.current = true
      onScan(code)
    }

    const tick = async (): Promise<void> => {
      if (doneRef.current || video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
        frame = window.requestAnimationFrame(() => void tick())
        return
      }
      if (detector) {
        try {
          const found = await detector.detect(video)
          const value = found[0]?.rawValue
          if (value) {
            finish(value)
            return
          }
        } catch {
          /* el detector nativo falló: jsQR abajo sigue leyendo */
        }
      }
      if (context) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        context.drawImage(video, 0, 0)
        const image = context.getImageData(0, 0, canvas.width, canvas.height)
        const result = jsQR(image.data, image.width, image.height, {
          inversionAttempts: 'dontInvert',
        })
        if (result?.data) {
          finish(result.data)
          return
        }
      }
      frame = window.requestAnimationFrame(() => void tick())
    }
    frame = window.requestAnimationFrame(() => void tick())
    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [isReady, onScan])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink text-white">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-sm font-semibold">Escanea el QR del acceso</p>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cerrar el lector"
          className="flex size-10 cursor-pointer items-center justify-center rounded-full bg-white/10"
        >
          <MaterialIcon name="close" aria-hidden />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 size-full object-cover"
        />
        {/* El cuadro de guía: dónde poner el código. Solo orienta, no recorta la lectura. */}
        <div
          aria-hidden
          className="relative size-64 rounded-2xl border-4 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
        />
        {error && (
          <p
            role="alert"
            className="absolute inset-x-6 bottom-6 rounded-lg bg-red/90 p-3 text-center text-sm"
          >
            {error}
          </p>
        )}
      </div>

      <p className="px-6 py-4 text-center text-sm text-white/80">
        Apunta al código impreso en el acceso del hotel. La app también toma tu ubicación.
      </p>
    </div>
  )
}

interface DetectorLike {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>
}

/** `BarcodeDetector` no está en los tipos del DOM todavía: se toca con cuidado. */
function createDetector(): DetectorLike | null {
  const ctor = (
    window as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => DetectorLike }
  ).BarcodeDetector
  if (!ctor) return null
  try {
    return new ctor({ formats: ['qr_code'] })
  } catch {
    return null
  }
}
