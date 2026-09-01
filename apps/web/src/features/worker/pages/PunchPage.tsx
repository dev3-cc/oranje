import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import { MaterialIcon } from '@oranje/ui'
import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import {
  NEEDS_PHOTO,
  PUNCH_LABEL,
  PUNCH_ORDER,
  useGetTodayPunchingQuery,
  usePunchMutation,
  type PunchType,
} from '../api/punchApi'
import { CameraCapture } from '../components/CameraCapture'
import { WorkerSkeleton } from '../components/WorkerSkeleton'

import { useUploadFileMutation } from '@/app/filesApi'
import checkinLottie from '@/assets/check/oranje-checkin.lottie'
import checkoutLottie from '@/assets/check/oranje-checkout.lottie'
import exitoEntradaLottie from '@/assets/check/oranje-exito-entrada.lottie'
import exitoSalidaLottie from '@/assets/check/oranje-exito-salida.lottie'
import registrandoEntradaLottie from '@/assets/check/oranje-registrando-entrada.lottie'
import registrandoSalidaLottie from '@/assets/check/oranje-registrando-salida.lottie'
import verificandoEntradaLottie from '@/assets/check/oranje-verificando-entrada.lottie'
import verificandoSalidaLottie from '@/assets/check/oranje-verificando-salida.lottie'
import personajeAcceso from '@/assets/ilustrations/personaje-acceso-protegido.svg'
import personajeCronograma from '@/assets/ilustrations/personaje-cronograma.svg'
import personajeFoto from '@/assets/ilustrations/personaje-foto.svg'
import mascotaCelebrando from '@/assets/mascota/mascota-celebrando.png'
import mascotaPensando from '@/assets/mascota/mascota-pensando.png'
import errorLottie from '@/assets/selfie/oranje-error.lottie'
import fueraDelHotelLottie from '@/assets/selfie/oranje-fuera-del-hotel.lottie'
import { EmptyState } from '@/shared/components/EmptyState'
import { LoadError } from '@/shared/components/LoadError'
import { OnboardingIntro, type OnboardingSlide } from '@/shared/components/OnboardingIntro'
import { useIntroSeen } from '@/shared/hooks/useIntroSeen'
import { apiErrorMessage, readApiError } from '@/shared/lib/apiError'
import { formatTimeIn } from '@/shared/lib/formatters'
import { tapFeedback } from '@/shared/lib/motion'

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

function clockOf(date: Date): string {
  return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

function longDateOf(date: Date): string {
  const text = date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Horas netas del día: Entrada→Salida menos el lunch, solo cuando la salida ya existe. */
function hoursOf(marks: Partial<Record<PunchType, string>>): string {
  if (!marks.CLOCK_IN || !marks.CLOCK_OUT) return '--:--'
  let minutes = (new Date(marks.CLOCK_OUT).getTime() - new Date(marks.CLOCK_IN).getTime()) / 60_000
  if (marks.LUNCH_OUT && marks.LUNCH_IN) {
    minutes -= (new Date(marks.LUNCH_IN).getTime() - new Date(marks.LUNCH_OUT).getTime()) / 60_000
  }
  minutes = Math.max(0, Math.round(minutes))
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

/** El reloj vivo de la pantalla: la hora que se ve es la que se va a ponchar. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date())
    }, 1000)
    return () => {
      window.clearInterval(timer)
    }
  }, [])
  return now
}

/**
 * La confirmación que se siente: un timbre corto de dos notas (Web Audio, sin
 * archivo) y una vibración breve donde exista. Falla en silencio: un teléfono
 * en modo silencio o sin permiso no rompe el ponche.
 */
function confirmPunch(): void {
  try {
    navigator.vibrate?.(40)
  } catch {
    /* Sin vibración no pasa nada. */
  }
  try {
    const AudioCtor = window.AudioContext
    const context = new AudioCtor()
    const notes: Array<[number, number]> = [
      [660, 0],
      [880, 0.14],
    ]
    for (const [frequency, at] of notes) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, context.currentTime + at)
      gain.gain.exponentialRampToValueAtTime(0.25, context.currentTime + at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + at + 0.22)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(context.currentTime + at)
      oscillator.stop(context.currentTime + at + 0.25)
    }
    window.setTimeout(() => {
      void context.close()
    }, 600)
  } catch {
    /* Sin audio tampoco. */
  }
}

/**
 * En qué va la marca mientras se guarda: «registrando» cubre ubicación y foto,
 * «verificando» la espera del servidor (geocerca y registro), «éxito» es el
 * check que celebra la marca guardada, y los desenlaces malos: «fuera del
 * hotel» (la geocerca dijo que no) o «error» para todo lo demás. Cada fase
 * trae su propia naranja animada.
 */
type PunchPhase = 'idle' | 'registering' | 'verifying' | 'success' | 'outside' | 'error'

/** La naranja animada de cada fase, en su sentido: entrar o salir. */
const PHASE_LOTTIE: Record<Exclude<PunchPhase, 'idle'>, Record<'in' | 'out', string>> = {
  registering: { in: registrandoEntradaLottie, out: registrandoSalidaLottie },
  verifying: { in: verificandoEntradaLottie, out: verificandoSalidaLottie },
  success: { in: exitoEntradaLottie, out: exitoSalidaLottie },
  outside: { in: fueraDelHotelLottie, out: fueraDelHotelLottie },
  error: { in: errorLottie, out: errorLottie },
}

/** Cuánto se queda el desenlace —éxito o error— antes de devolverle su lugar al reloj. */
const OUTCOME_VISIBLE_MS = 2500

const INTRO_SLIDES: readonly OnboardingSlide[] = [
  {
    image: personajeCronograma,
    title: 'Cuatro marcas al día',
    text: 'Entrada, salida al lunch, regreso y salida. El botón siempre sabe cuál toca: solo tócalo cuando llegue el momento.',
  },
  {
    image: personajeFoto,
    title: 'Entrada y Salida llevan tu foto',
    text: 'Al tocar el botón se abre la cámara. La foto confirma que eres tú; no se comparte con el hotel.',
  },
  {
    image: personajeAcceso,
    title: 'Solo dentro del hotel',
    text: 'Tu teléfono manda la ubicación y el sistema verifica que estés en el hotel. Si estás fuera, pídele al Supervisor un ponche manual.',
  },
]

/** Un dato del pie: icono, hora y qué es (Entrada · Salida · Horas). */
function Stat({ icon, value, label }: { icon: string; value: string; label: string }): ReactNode {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="flex size-12 items-center justify-center rounded-full border-2 border-o-500/40 text-o-700">
        <MaterialIcon name={icon} className="text-2xl" />
      </span>
      <span className="mt-1 text-sm font-semibold text-ink">{value}</span>
      <span className="text-xs text-ink-3">{label}</span>
    </div>
  )
}

/** La posición del teléfono, en promesa. Sin permiso o sin GPS, un error con nombre. */
function locate(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('GEOLOCATION_UNSUPPORTED'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude })
      },
      (error) => {
        reject(
          new Error(
            error.code === error.PERMISSION_DENIED ? 'GEOLOCATION_DENIED' : 'GEOLOCATION_FAILED',
          ),
        )
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    )
  })
}

function punchErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    switch (error.message) {
      case 'GEOLOCATION_DENIED':
        return 'Sin permiso de ubicación no se puede ponchar: actívalo para este sitio en tu teléfono.'
      case 'GEOLOCATION_UNSUPPORTED':
        return 'Este navegador no da la ubicación: usa el navegador del teléfono.'
      case 'GEOLOCATION_FAILED':
        return 'No se pudo leer tu ubicación. Sal a cielo abierto e inténtalo de nuevo.'
      default:
        break
    }
  }
  return apiErrorMessage(error, {
    byCode: {
      NO_SHIFT_TODAY: 'Hoy no tienes turno: no hay nada que ponchar.',
      MULTIPLE_SHIFTS_TODAY:
        'Hoy tienes más de un turno: pídele al Supervisor que registre la marca.',
      NOT_YOUR_ASSIGNMENT: 'Ese turno no es tuyo. Recarga la pantalla e inténtalo de nuevo.',
      FORBIDDEN: 'Tu cuenta aún no tiene permiso para subir la foto: Oranje lo está habilitando.',
      OUTSIDE_GEOFENCE:
        'Estás fuera del hotel: la marca no se guarda. Pídele al Supervisor un ponche manual.',
      PHOTO_REQUIRED: 'Entrada y Salida necesitan tu foto: tómala y vuelve a intentar.',
      PUNCH_ALREADY_REGISTERED: 'Esa marca ya quedó registrada hoy.',
      TIMESHEET_NOT_EDITABLE: 'La semana ya se cerró: esta marca la captura el Supervisor.',
      WORKER_NOT_LINKED: 'Tu cuenta no está ligada a un colaborador: avisa a Reclutamiento.',
      UNSUPPORTED_FILE_TYPE: 'Esa foto no se pudo procesar: toma otra desde la cámara.',
    },
    fallback: 'No se pudo guardar la marca. Inténtalo de nuevo.',
  })
}

/**
 * Ponchar, al estilo del reloj de asistencia de referencia: la hora viva, la
 * fecha, un gran botón circular con anillos —la naranja del check-in o del
 * check-out gira dentro— y abajo Entrada · Salida · Horas. La marca que TOCA
 * (entrada → lunch → regreso → salida) la decide lo ya ponchado; Entrada y
 * Salida abren la cámara al tocar el botón y se guardan con esa foto. La
 * geocerca la decide el servidor (D-08); estar fuera se dice en palabras y
 * manda al Supervisor. Sin conexión hoy no se guarda: la cola offline llega
 * como actualización.
 */
export function PunchPage(): ReactNode {
  const { isIntroOpen, dismissIntro, reopenIntro } = useIntroSeen('worker-punch')
  const { data, isLoading, isError, refetch } = useGetTodayPunchingQuery()
  const [uploadFile, { isLoading: isUploading }] = useUploadFileMutation()
  const [punch, { isLoading: isPunching }] = usePunchMutation()
  const now = useNow()
  const reduceMotion = useReducedMotion() ?? false

  const photoInputRef = useRef<HTMLInputElement>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [phase, setPhase] = useState<PunchPhase>('idle')
  /** El sentido de la marca en curso, fijado al ponchar: el refetch tras el éxito no lo mueve. */
  const [direction, setDirection] = useState<'in' | 'out'>('in')
  /** La foto recién tomada, en el encuadre del botón mientras la marca se guarda. */
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [isCameraOpen, setCameraOpen] = useState(false)
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const goOnline = (): void => {
      setIsOnline(true)
    }
    const goOffline = (): void => {
      setIsOnline(false)
    }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  if (isIntroOpen) {
    return <OnboardingIntro slides={INTRO_SLIDES} startLabel="Ir a ponchar" onDone={dismissIntro} />
  }

  if (isLoading) return <WorkerSkeleton variant="punch" />
  if (isError || !data) {
    return (
      <LoadError
        message="No se pudo cargar tu turno."
        onRetry={() => {
          void refetch()
        }}
      />
    )
  }

  const { shift, punches } = data

  if (!shift) {
    return (
      <EmptyState
        image={mascotaPensando}
        title="Hoy no tienes turno"
        text="Cuando Reclutamiento te asigne a una requisición, tu turno del día aparece aquí y podrás ponchar."
      />
    )
  }

  const marks: Partial<Record<PunchType, string>> = {}
  for (const item of punches ?? []) marks[item.type as PunchType] = item.serverAt
  const next = PUNCH_ORDER.find((type) => marks[type] === undefined) ?? null
  const isDayComplete = next === null
  const needsPhoto = next !== null && NEEDS_PHOTO.has(next)
  const isBusy = phase !== 'idle' || isUploading || isPunching
  const canPunch = next !== null && isOnline && !isBusy
  /** Entrar y volver del lunch «entran»; salir al lunch y salir «salen». */
  const isEntering = next === 'CLOCK_IN' || next === 'LUNCH_IN'

  async function submit(photo: File | null): Promise<void> {
    if (!canPunch || next === null) return
    setFailure(null)
    setDirection(isEntering ? 'in' : 'out')
    setPhase('registering')
    const preview = photo ? URL.createObjectURL(photo) : null
    setPhotoPreview(preview)
    const backToIdle = (): void => {
      setPhase('idle')
      setPhotoPreview(null)
      if (preview) URL.revokeObjectURL(preview)
    }
    try {
      const { latitude, longitude } = await locate()
      let photoPath: string | undefined
      if (photo) {
        photoPath = (await uploadFile({ file: photo, purpose: 'PUNCH_PHOTO' }).unwrap()).path
      }
      setPhase('verifying')
      await punch({
        ...(shift?.assignmentId !== undefined ? { assignmentId: shift.assignmentId } : {}),
        type: next,
        latitude,
        longitude,
        ...(photoPath !== undefined ? { photoPath } : {}),
      }).unwrap()
      confirmPunch()
      setPhase('success')
      window.setTimeout(backToIdle, OUTCOME_VISIBLE_MS)
    } catch (error) {
      setFailure(punchErrorMessage(error))
      setPhase(readApiError(error).code === 'OUTSIDE_GEOFENCE' ? 'outside' : 'error')
      window.setTimeout(backToIdle, OUTCOME_VISIBLE_MS)
    }
  }

  function onTap(): void {
    if (!canPunch) return
    if (needsPhoto) {
      setCameraOpen(true)
      return
    }
    void submit(null)
  }

  return (
    <div className="flex flex-col gap-6">
      {isCameraOpen && (
        <CameraCapture
          onCapture={(file) => {
            setCameraOpen(false)
            void submit(file)
          }}
          onFallback={() => {
            setCameraOpen(false)
            photoInputRef.current?.click()
          }}
          onCancel={() => {
            setCameraOpen(false)
          }}
        />
      )}

      <section>
        <p className="text-lg font-bold text-ink">{shift.hotel}</p>
        <p className="text-sm text-ink-3">
          {shift.position} · turno {formatTimeIn(shift.startsAt, shift.hotelTimeZone)} –{' '}
          {formatTimeIn(shift.endsAt, shift.hotelTimeZone)}
        </p>
      </section>

      {/* Mientras la marca se guarda, la hora le presta su lugar a la fase:
          el encuadre se queda solo con la foto y el texto se lee aquí arriba. */}
      <section className="text-center" aria-live="polite">
        {isBusy ? (
          <>
            <p className="text-4xl font-bold tracking-tight text-ink">
              {phase === 'success'
                ? '¡Listo!'
                : phase === 'outside'
                  ? 'Fuera del hotel'
                  : phase === 'error'
                    ? 'No se guardó'
                    : phase === 'verifying'
                      ? 'Verificando…'
                      : 'Registrando…'}
            </p>
            <p className="mt-1 text-sm text-ink-3">
              {phase === 'success'
                ? 'Tu marca quedó registrada'
                : phase === 'outside' || phase === 'error'
                  ? 'La marca no quedó registrada'
                  : phase === 'verifying'
                    ? 'Confirmando que estás en el hotel'
                    : photoPreview !== null
                      ? 'Guardando tu ubicación y tu foto'
                      : 'Guardando tu ubicación'}
            </p>
          </>
        ) : (
          <>
            <p className="text-5xl font-bold tracking-tight text-ink" aria-live="off">
              {clockOf(now)}
            </p>
            <p className="mt-1 text-sm text-ink-3">{longDateOf(now)}</p>
          </>
        )}
      </section>

      {!isOnline && (
        <p role="alert" className="rounded-md bg-yellow/20 p-3 text-sm text-ink">
          Sin conexión: la marca no se puede guardar todavía. Vuelve a intentarlo cuando tengas
          señal.
        </p>
      )}

      {/* El botón: la naranja del check-in o del check-out orbita DETRÁS, como fondo.
          Mientras la marca se guarda, la naranja cambia a la de la fase en curso:
          registrando (ubicación y foto) y luego verificando (el servidor). */}
      <div className="relative mx-auto flex size-80 items-center justify-center">
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-0 scale-125 ${
            /* Con la foto en el encuadre, los corchetes del lottie la enmarcan POR ENCIMA. */
            isBusy && photoPreview !== null ? 'z-20' : ''
          }`}
        >
          <DotLottieReact
            key={`${phase}-${phase === 'idle' ? (isEntering ? 'in' : 'out') : direction}`}
            src={
              phase === 'idle'
                ? isEntering
                  ? checkinLottie
                  : checkoutLottie
                : PHASE_LOTTIE[phase][direction]
            }
            loop={phase !== 'success' && phase !== 'outside' && phase !== 'error'}
            autoplay={!reduceMotion}
          />
        </span>

        {isDayComplete ? (
          <div className="relative z-10 flex size-36 flex-col items-center justify-center rounded-full bg-surface shadow-lg">
            <img src={mascotaCelebrando} alt="" aria-hidden className="h-16 w-auto" />
            <span className="mt-1 text-xs font-semibold text-ink">Jornada completa</span>
          </div>
        ) : (
          <motion.button
            type="button"
            onClick={onTap}
            disabled={!canPunch}
            {...tapFeedback(reduceMotion)}
            aria-label={`Ponchar ${PUNCH_LABEL[next].toLowerCase()}`}
            className={`relative z-10 flex size-36 cursor-pointer touch-manipulation flex-col items-center justify-center overflow-hidden bg-surface shadow-lg transition-[border-radius,box-shadow] duration-300 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-o-500 disabled:cursor-not-allowed ${
              /* Con la foto en el encuadre, el círculo se vuelve cuadro: es el
                 recuadro que los corchetes del lottie están enmarcando. */
              isBusy && photoPreview !== null ? 'rounded-2xl' : 'rounded-full'
            } ${isBusy ? '' : 'disabled:opacity-60'}`}
          >
            {isBusy && photoPreview !== null ? (
              /* Solo la foto en el encuadre: la fase se lee arriba, donde la hora. */
              <img
                src={photoPreview}
                alt=""
                aria-hidden
                className="absolute inset-0 size-full object-cover"
              />
            ) : (
              <>
                <MaterialIcon
                  name={isEntering ? 'login' : 'logout'}
                  className="text-4xl text-o-700"
                  aria-hidden
                />
                <span className="mt-1 text-base font-bold text-ink">
                  {phase === 'success'
                    ? '¡Listo!'
                    : phase === 'outside'
                      ? 'Fuera del hotel'
                      : phase === 'error'
                        ? 'No se guardó'
                        : phase === 'verifying'
                          ? 'Verificando…'
                          : isBusy
                            ? 'Registrando…'
                            : PUNCH_LABEL[next]}
                </span>
                {needsPhoto && !isBusy && (
                  <span className="text-[11px] text-ink-3">con tu foto</span>
                )}
              </>
            )}
          </motion.button>
        )}
      </div>

      <input
        ref={photoInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="user"
        className="hidden"
        aria-label="Foto del ponche"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void submit(file)
        }}
      />

      {failure !== null && (
        <p role="alert" className="text-center text-sm text-red">
          {failure}
        </p>
      )}

      <section className="grid grid-cols-3 gap-2 rounded-xl border border-line bg-surface px-2 py-4">
        <Stat
          icon="login"
          value={marks.CLOCK_IN ? timeOf(marks.CLOCK_IN) : '--:--'}
          label="Entrada"
        />
        <Stat
          icon="logout"
          value={marks.CLOCK_OUT ? timeOf(marks.CLOCK_OUT) : '--:--'}
          label="Salida"
        />
        <Stat icon="schedule" value={hoursOf(marks)} label="Horas" />
      </section>

      {marks.LUNCH_OUT && (
        <p className="text-center text-xs text-ink-3">
          Lunch {timeOf(marks.LUNCH_OUT)} – {marks.LUNCH_IN ? timeOf(marks.LUNCH_IN) : '--:--'}
        </p>
      )}

      <button
        type="button"
        onClick={reopenIntro}
        className="mx-auto min-h-11 cursor-pointer touch-manipulation px-3 text-sm font-semibold text-o-700 underline-offset-4 hover:underline"
      >
        ¿Cómo funciona el ponche?
      </button>
    </div>
  )
}
