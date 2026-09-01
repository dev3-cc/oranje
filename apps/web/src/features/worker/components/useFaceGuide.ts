import { useEffect, useState, type RefObject } from 'react'

/**
 * Detección de cara con MediaPipe (Face Detector, modelo corto: rostros a
 * menos de 2 m — el selfie del ponche). Se carga SOLO al abrir la cámara:
 * el WASM (~12 MB, cacheado por el navegador) viene del CDN de jsDelivr
 * fijado a la versión instalada; el modelo (~230 KB) vive en `public/`.
 *
 * Devuelve cómo va el encuadre respecto al óvalo de la guía. Si MediaPipe no
 * carga (sin red, navegador viejo) se responde `unavailable` y el disparador
 * queda libre: la detección ayuda, no bloquea a quien tiene que ponchar.
 */
export type FaceGuide = 'loading' | 'unavailable' | 'no-face' | 'too-far' | 'off-center' | 'ok'

const MEDIAPIPE_VERSION = '1.0.1'
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`
const MODEL_URL = '/mediapipe/blaze_face_short_range.tflite'

/**
 * El óvalo de la guía en fracciones del cuadro. La guía visual tiene
 * proporción fija 3:4 centrada, así que esto es una aproximación tolerante
 * (el factor 0.55 de la elipse ya perdona el recorte del object-cover).
 */
const OVAL = { cx: 0.5, cy: 0.5, rx: 0.34, ry: 0.34 }
/** Ancho mínimo de la cara respecto al cuadro para que la foto sirva. */
const MIN_FACE_WIDTH = 0.22
const FRAME_INTERVAL_MS = 120

export function useFaceGuide(
  videoRef: RefObject<HTMLVideoElement | null>,
  isReady: boolean,
): FaceGuide {
  const [guide, setGuide] = useState<FaceGuide>('loading')

  useEffect(() => {
    if (!isReady) return
    let cancelled = false
    let timer = 0
    let detector: {
      detectForVideo: (v: HTMLVideoElement, t: number) => unknown
      close: () => void
    } | null = null

    async function start(): Promise<void> {
      try {
        const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision')
        const fileset = await FilesetResolver.forVisionTasks(WASM_URL)
        const created = await FaceDetector.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.5,
        })
        if (cancelled) {
          created.close()
          return
        }
        detector = created
        tick()
      } catch {
        if (!cancelled) setGuide('unavailable')
      }
    }

    function tick(): void {
      const video = videoRef.current
      if (cancelled || !detector || !video || video.videoWidth === 0) {
        timer = window.setTimeout(tick, FRAME_INTERVAL_MS)
        return
      }
      const result = detector.detectForVideo(video, performance.now()) as {
        detections: Array<{
          boundingBox?: { originX: number; originY: number; width: number; height: number }
        }>
      }
      const box = result.detections[0]?.boundingBox
      if (!box) {
        setGuide('no-face')
      } else {
        const width = box.width / video.videoWidth
        const cx = (box.originX + box.width / 2) / video.videoWidth
        const cy = (box.originY + box.height / 2) / video.videoHeight
        /* Dentro del óvalo: la ecuación de la elipse con la cara al centro. */
        const inside = ((cx - OVAL.cx) / OVAL.rx) ** 2 + ((cy - OVAL.cy) / OVAL.ry) ** 2 <= 0.55
        setGuide(width < MIN_FACE_WIDTH ? 'too-far' : inside ? 'ok' : 'off-center')
      }
      timer = window.setTimeout(tick, FRAME_INTERVAL_MS)
    }

    void start()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      detector?.close()
    }
  }, [videoRef, isReady])

  return guide
}

export const FACE_GUIDE_HINT: Record<FaceGuide, string> = {
  loading: 'Preparando la cámara…',
  unavailable: 'Centra tu cara en el óvalo',
  'no-face': 'No vemos tu cara: mira a la cámara',
  'too-far': 'Acércate un poco',
  'off-center': 'Centra tu cara en el óvalo',
  ok: 'Perfecto, toma la foto',
}
