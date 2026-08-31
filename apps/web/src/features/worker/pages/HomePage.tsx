import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import { MaterialIcon, statusLight } from '@oranje/ui'
import { useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { useGetTodayPunchingQuery, type MyShiftApi } from '../api/punchApi'
import { useGetMyProfileQuery, useSetAvailableMutation } from '../api/workerApi'
import { TaxDeadlineBanner } from '../components/TaxDeadlineBanner'
import { WorkerSkeleton } from '../components/WorkerSkeleton'

import auraAnimation from '@/assets/dashboard/oranje-aura.lottie'
import personajeBienvenida from '@/assets/ilustrations/personaje-bienvenida.svg'
import personajeNotificaciones from '@/assets/ilustrations/personaje-notificaciones.svg'
import personajePerfil from '@/assets/ilustrations/personaje-perfil.svg'
import personajeSubiendo from '@/assets/ilustrations/personaje-subiendo.svg'
import { Button } from '@/shared/components/Button'
import { NoticeCard } from '@/shared/components/NoticeCard'
import { OnboardingIntro, type OnboardingSlide } from '@/shared/components/OnboardingIntro'
import {
  WORKER_STATUS_LABEL,
  WORKER_STATUS_TOKEN,
  type WorkerStatus,
} from '@/shared/constants/workerStatus'
import { useIntroSeen } from '@/shared/hooks/useIntroSeen'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { formatTimeIn } from '@/shared/lib/formatters'

const INTRO_SLIDES: readonly OnboardingSlide[] = [
  {
    image: personajeBienvenida,
    title: 'Bienvenido a Oranje',
    text: 'Aquí ves tu estado, ponchas tus turnos y recibes los avisos de Reclutamiento y del hotel.',
  },
  {
    image: personajePerfil,
    title: 'Tu semáforo, en palabras',
    text: 'El color de arriba dice en qué punto estás: desde el alta hasta asignado. Lo mueve Oranje; tú solo enciendes tu disponibilidad.',
  },
  {
    image: personajeNotificaciones,
    title: 'Los avisos importan',
    text: 'Asignaciones, cambios de turno y recordatorios llegan a Avisos. Revísalos cada día.',
  },
]

/** Los tres orígenes desde donde el semáforo deja encender Amarillo (seed). */
const CAN_GO_AVAILABLE: ReadonlySet<string> = new Set(['STRONG_GREEN', 'ORANGE', 'PINK'])

/**
 * El hero: UNA sola pieza que sangra a los bordes bajo las pestañas —la foto
 * del hotel de hoy de fondo (Places, D-34) y, sobre un degradado oscuro que
 * garantiza el contraste, quién eres y tu turno. El aura vive DETRÁS del
 * avatar y el semáforo es el PUNTO de color en su esquina: el color es el
 * estado; el chip lo dice en palabras, sin el código. Sin foto —el contrato
 * aún no la trae— el fondo es un degradado Oranje; sin turno, el hero lo
 * dice y no manda a ponchar.
 */
function Hero({
  firstName,
  photoUrl,
  status,
  shift,
  punched,
  isResolved,
  reduceMotion,
}: {
  firstName: string
  photoUrl: string | null
  status: WorkerStatus
  shift: MyShiftApi | null
  punched: number
  isResolved: boolean
  reduceMotion: boolean
}): ReactNode {
  const identity = (
    <div className="flex items-center gap-3">
      <div className="relative flex size-20 shrink-0 items-center justify-center">
        <DotLottieReact
          src={auraAnimation}
          loop
          autoplay={!reduceMotion}
          className="pointer-events-none absolute inset-0 size-full"
        />
        {/* El semáforo es el ANILLO del avatar: el color rodea a la persona. En Blanco es un avatar normal. */}
        <span
          className="relative rounded-full p-[3px] shadow-md"
          style={{ backgroundColor: statusLight[WORKER_STATUS_TOKEN[status]] }}
        >
          {photoUrl ? (
            <img
              src={photoUrl}
              alt=""
              aria-hidden
              className="size-14 rounded-full border-2 border-white object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="flex size-14 items-center justify-center rounded-full border-2 border-white bg-o-500 text-xl font-bold text-ink"
            >
              {firstName.charAt(0)}
            </span>
          )}
          <span className="sr-only">Estado: {WORKER_STATUS_LABEL[status]}</span>
        </span>
      </div>
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-bold text-white">Hola, {firstName}</h1>
        <span className="mt-1 inline-block rounded-full bg-white/15 px-3 py-0.5 text-xs font-semibold text-white backdrop-blur-sm">
          {WORKER_STATUS_LABEL[status]}
        </span>
      </div>
    </div>
  )

  const background = (
    <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-br from-o-500 to-o-700">
      {shift?.hotelPhotoUrl && (
        <img src={shift.hotelPhotoUrl} alt="" className="size-full object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/40 to-ink/10" />
    </div>
  )

  if (!isResolved) {
    return <div className="-mx-5 -mt-5 h-72 animate-pulse bg-surface-2" aria-hidden />
  }

  if (!shift) {
    return (
      <section className="relative isolate -mx-5 -mt-5 flex min-h-72 flex-col justify-end gap-4 overflow-hidden rounded-b-[28px] px-5 pb-5">
        {background}
        {identity}
        <p className="rounded-xl bg-white/15 px-4 py-3 text-sm text-white backdrop-blur-sm">
          Hoy no tienes turno. Cuando te asignen, aquí aparece el hotel y el horario.
        </p>
      </section>
    )
  }

  return (
    <section className="relative isolate -mx-5 -mt-5 flex min-h-80 flex-col justify-end gap-4 overflow-hidden rounded-b-[28px] px-5 pb-5">
      {background}
      {identity}
      <Link
        to="/colaborador/ponchar"
        className="flex touch-manipulation items-center gap-3 rounded-2xl bg-white/15 p-3 text-white backdrop-blur-sm transition-colors hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-bold">{shift.hotel}</span>
          <span className="block text-sm text-white/85">
            {shift.position} · {formatTimeIn(shift.startsAt, shift.hotelTimeZone)} –{' '}
            {formatTimeIn(shift.endsAt, shift.hotelTimeZone)}
          </span>
          <span className="mt-2 flex items-center gap-2">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/25">
              <span
                className="block h-full rounded-full bg-o-500 transition-all duration-300"
                style={{ width: `${String((punched / 4) * 100)}%` }}
              />
            </span>
            <span className="text-xs font-semibold">{punched} de 4</span>
          </span>
        </span>
        <span className="flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-o-500 px-4 text-sm font-bold text-ink shadow-sm">
          Ponchar
          <MaterialIcon name="chevron_right" className="text-lg" aria-hidden />
        </span>
      </Link>
    </section>
  )
}

/**
 * Inicio del Colaborador: el hero con tu turno, y debajo SOLO lo que pide
 * acción — el plazo del SSN/ITIN, el expediente si falta, y la
 * disponibilidad (Amarillo). Zona, fecha de alta y el historial viven en
 * Perfil; los avisos, en su pestaña con el contador.
 */
export function HomePage(): ReactNode {
  const { isIntroOpen, dismissIntro } = useIntroSeen('worker-home')
  const reduceMotion = useReducedMotion() ?? false
  const { data: profile, isLoading } = useGetMyProfileQuery()
  const { data: today, isSuccess: isTodayResolved } = useGetTodayPunchingQuery()
  const [setAvailable, { isLoading: isSwitching, isError, error }] = useSetAvailableMutation()

  if (isIntroOpen) {
    return <OnboardingIntro slides={INTRO_SLIDES} startLabel="Empezar" onDone={dismissIntro} />
  }

  if (isLoading || !profile) return <WorkerSkeleton variant="home" />

  const status = profile.state.code as WorkerStatus
  const firstName = profile.fullName.split(/\s+/)[0] ?? profile.fullName
  const isAvailable = status === 'YELLOW'
  /** La tarjeta solo existe si hay algo que decidir o algo encendido. */
  const showAvailability = isAvailable || CAN_GO_AVAILABLE.has(status)

  return (
    <div className="flex flex-col gap-5">
      <Hero
        firstName={firstName}
        photoUrl={profile.photoUrl}
        status={status}
        shift={today?.shift ?? null}
        punched={today?.punches?.length ?? 0}
        isResolved={isTodayResolved}
        reduceMotion={reduceMotion}
      />

      <TaxDeadlineBanner deadline={profile.taxDeadline} />

      {!profile.isProfileComplete && (
        <NoticeCard
          image={personajeSubiendo}
          title="Faltan datos tuyos"
          tone="action"
          action={
            <Link
              to="/colaborador/alta-2"
              className="inline-flex min-h-11 touch-manipulation items-center rounded-md bg-o-500 px-4 text-sm font-semibold text-ink transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-700"
            >
              Completar mis datos
            </Link>
          }
        >
          Tu transporte, tu SSN o ITIN y un contacto de emergencia. Con eso Reclutamiento puede
          validarte y empiezas a recibir turnos.
        </NoticeCard>
      )}

      {showAvailability && (
        <section className="rounded-xl border border-line bg-surface p-4">
          <p className="text-sm font-semibold text-ink">Disponibilidad</p>
          {isAvailable ? (
            <p className="mt-1 text-sm text-ink-2">
              Estás <strong>disponible por voluntad propia</strong>: Reclutamiento puede asignarte
              en cuanto haya una requisición.
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm text-ink-2">
                Enciende Amarillo cuando quieras que te consideren para más turnos.
              </p>
              <Button
                variant="primary"
                className="mt-3"
                disabled={isSwitching}
                onClick={() => {
                  void setAvailable()
                }}
              >
                {isSwitching ? 'Un momento…' : 'Marcarme disponible'}
              </Button>
            </>
          )}
          {isError && (
            <p role="alert" className="mt-2 text-sm text-red">
              {apiErrorMessage(error, {
                byCode: {
                  TRANSITION_NOT_ALLOWED: 'Tu semáforo no permite encender Amarillo desde aquí.',
                },
                fallback: 'No se pudo cambiar tu disponibilidad. Inténtalo de nuevo.',
              })}
            </p>
          )}
        </section>
      )}
    </div>
  )
}
