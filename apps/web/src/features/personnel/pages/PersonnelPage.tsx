import { cn, MaterialIcon, statusLight, toast } from '@oranje/ui'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import { useGetHotelCardQuery, useGetPersonnelBoardQuery } from '../api/personnelApi'
import { ContactQr } from '../components/ContactQr'
import { StandByDialog } from '../components/StandByDialog'
import { WorkerPerformanceRadar } from '../components/WorkerPerformanceRadar'
import type { PersonnelRow } from '../types/personnel.types'

import { useGetSessionQuery } from '@/app/sessionApi'
import mascotaSaludando from '@/assets/mascota/mascota-saludando.png'
import { CardGridSkeleton } from '@/shared/components/CardGridSkeleton'
import { FoldText } from '@/shared/components/FoldText'
import { HotelPhotoBackdrop } from '@/shared/components/HotelPhotoBackdrop'
import { LoadError } from '@/shared/components/LoadError'
import { MagicCard } from '@/shared/components/MagicCard'
import { MetricCard } from '@/shared/components/MetricCard'
import { SearchField } from '@/shared/components/SearchField'
import {
  BLOOD_LABEL,
  GENDER_LABEL,
  RELATIONSHIP_LABEL,
  TRANSPORT_LABEL,
} from '@/shared/constants/workerEnums'
import {
  workerStatusChipLabel,
  WORKER_STATUS_TOKEN,
  type WorkerStatus,
} from '@/shared/constants/workerStatus'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { matchesSearch } from '@/shared/lib/text'

const NO_SHIFT_LABEL: Record<string, string> = {
  PINK: 'Pausado (Stand-by)',
  GRAY: 'Protegido (Gris)',
}

function initialsOf(fullName: string): string {
  return fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase()
}

function timeOf(iso: string): string {
  return iso.slice(11, 16)
}

function statusToken(row: PersonnelRow): keyof typeof statusLight {
  return WORKER_STATUS_TOKEN[row.stateCode as WorkerStatus] ?? 'st-blanco'
}

/** Turno sin entrada = alerta — salvo pausado/protegido: ahí es lo esperado. */
function hasMissingEntry(row: PersonnelRow): boolean {
  return row.shift !== null && row.clockInAt === null && !(row.stateCode in NO_SHIFT_LABEL)
}

/**
 * La cara con el semáforo como ANILLO — el lenguaje del Perfil del
 * Colaborador: el estado abraza a la persona, no vive en otra columna.
 */
function WorkerAvatar({ row, className }: { row: PersonnelRow; className: string }): ReactNode {
  const ring = statusLight[statusToken(row)]
  if (row.photoUrl) {
    return (
      <img
        src={row.photoUrl}
        alt=""
        aria-hidden
        style={{ borderColor: ring }}
        className={cn('shrink-0 rounded-full border-2 object-cover', className)}
      />
    )
  }
  return (
    <span
      aria-hidden
      style={{ borderColor: ring }}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full border-2 bg-o-500/15 font-bold text-o-700',
        className,
      )}
    >
      {initialsOf(row.fullName)}
    </span>
  )
}

/** Qué dice la fila de la izquierda debajo del nombre: turno y marca, en corto. */
function rowSubtitle(row: PersonnelRow): string {
  /* Rosa/Gris mandan sobre el turno: un pausado o protegido no debe leerse
     como si fuera a trabajar. */
  const paused = NO_SHIFT_LABEL[row.stateCode]
  if (paused !== undefined) return paused
  if (!row.shift) return 'Descansa hoy'
  const shift = `${timeOf(row.shift.startsAt)}–${timeOf(row.shift.endsAt)}`
  return row.clockInAt ? `${shift} · entró ${timeOf(row.clockInAt)}` : shift
}

/** La fila de la lista izquierda: quién es y cómo viene su día, de un vistazo. */
function WorkerRow({
  row,
  isSelected,
  onSelect,
}: {
  row: PersonnelRow
  isSelected: boolean
  onSelect: (workerId: string) => void
}): ReactNode {
  const missingEntry = hasMissingEntry(row)
  return (
    <li>
      {/* Magic Bento (reactbits): la fila avisa al pasar; se apaga sola en táctil y reduced motion. */}
      <MagicCard className="rounded-xl">
        <button
          type="button"
          onClick={() => {
            onSelect(row.workerId)
          }}
          className={cn(
            'flex w-full cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500',
            isSelected ? 'border-o-500 bg-o-50' : 'border-line bg-surface hover:bg-surface-2',
          )}
        >
          <WorkerAvatar row={row} className="size-11 text-sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">{row.fullName}</span>
            <span
              className={cn(
                'block text-xs',
                missingEntry ? 'font-semibold text-red' : 'text-ink-3',
              )}
            >
              {rowSubtitle(row)}
              {missingEntry && ' · sin entrada'}
            </span>
          </span>
          {/* El punto del semáforo también aquí: el anillo nunca habla solo. */}
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: statusLight[statusToken(row)] }}
          />
        </button>
      </MagicCard>
    </li>
  )
}

/** Un dato de la ficha: etiqueta en voz baja, valor legible. */
function PersonalField({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <div>
      <p className="text-xs text-ink-3">{label}</p>
      <p className="text-sm font-medium text-ink">{value}</p>
    </div>
  )
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'alert'
}): ReactNode {
  return (
    <div>
      <p className="text-xs text-ink-3">{label}</p>
      <p className={cn('text-xl font-bold', tone === 'alert' ? 'text-red' : 'text-ink')}>{value}</p>
    </div>
  )
}

/** Una pastilla de dato sobre el cristal oscuro (lenguaje de las fichas). */
function Pill({ children, className }: { children: ReactNode; className?: string }): ReactNode {
  return (
    <span
      className={cn(
        /* Cristalizada (pedido de Hugo): cada pastilla es su propio vidrio —
           blur + tinta translúcida — no un panel que tape la foto. */
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold backdrop-blur-md',
        className ?? 'bg-ink/35 text-white',
      )}
    >
      {children}
    </span>
  )
}

/** El panel de la derecha: la FICHA del colaborador — la foto de su hotel de
    fondo bajo cristal negro (el patrón del Perfil), sus datos como pastillas
    y las acciones contrastadas sobre el vidrio. */
function WorkerDetail({
  row,
  hotel,
  onStandBy,
}: {
  row: PersonnelRow
  /** El hotel del Supervisor (nombre y foto); `null` degrada a la marca. */
  hotel: { name: string; photoUrl: string | null } | null
  onStandBy: (row: PersonnelRow) => void
}): ReactNode {
  const missingEntry = hasMissingEntry(row)
  return (
    <article className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="relative">
        <HotelPhotoBackdrop photoUrl={hotel?.photoUrl ?? null} />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-ink/45 via-ink/65 to-ink/85"
        />

        <div className="relative flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <WorkerAvatar row={row} className="size-16 text-xl ring-2 ring-white/50" />
              <div>
                <h2 className="text-2xl font-bold text-white">{row.fullName}</h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {/* El estado, con su punto de color: el color nunca solo. */}
                  <Pill>
                    <span
                      aria-hidden
                      className="size-2 rounded-full ring-1 ring-white/40"
                      style={{ backgroundColor: statusLight[statusToken(row)] }}
                    />
                    {workerStatusChipLabel(row.stateCode as WorkerStatus)}
                  </Pill>
                  {row.positionName === '—' ? (
                    <Pill className="border border-dashed border-white/40 bg-ink/25 text-white/80">
                      Sin posición asignada
                    </Pill>
                  ) : (
                    <Pill>
                      <MaterialIcon name="badge" className="text-sm" aria-hidden />
                      {row.positionName}
                    </Pill>
                  )}
                  {hotel !== null && (
                    <Pill>
                      <MaterialIcon name="apartment" className="text-sm" aria-hidden />
                      {hotel.name}
                    </Pill>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {row.canStandBy && (
                <button
                  type="button"
                  title="Pausa temporal (Rosa); lo compartes con el Manager de Área"
                  onClick={() => {
                    onStandBy(row)
                  }}
                  className="cursor-pointer rounded-md bg-o-200 px-3 py-1.5 text-sm font-semibold text-o-900 transition-colors hover:bg-o-200/85"
                >
                  Mandar a Stand-by
                </button>
              )}
              <Link
                to={`/pool-colaboradores/${row.workerId}`}
                className="rounded-md border border-white/40 bg-ink/35 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-md transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
              >
                Ver Expediente
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-5">
        {/* El semáforo NO se repite aquí: ya abraza al avatar y habla en la
            pastilla junto al nombre. */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg bg-surface-2 p-4 sm:grid-cols-3">
          <Metric
            label="Turno de hoy"
            value={
              NO_SHIFT_LABEL[row.stateCode] ??
              (row.shift ? `${timeOf(row.shift.startsAt)}–${timeOf(row.shift.endsAt)}` : 'Descansa')
            }
          />
          <Metric
            label="Entrada de hoy"
            value={row.clockInAt ? timeOf(row.clockInAt) : row.shift ? 'Sin entrada' : '—'}
            {...(missingEntry ? { tone: 'alert' as const } : {})}
          />
          <div>
            <p className="text-xs text-ink-3">Teléfono</p>
            <p className="flex items-center gap-1.5 text-xl font-bold text-ink">
              {row.phone === '' ? '—' : row.phone}
              {row.phone !== '' && (
                <button
                  type="button"
                  title="Copiar el teléfono"
                  aria-label="Copiar el teléfono"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(row.phone)
                      .then(() => toast.success('Teléfono copiado: márcalo desde tu celular'))
                      .catch(() => toast.error('No se pudo copiar. Anótalo a mano.'))
                  }}
                  className="cursor-pointer rounded-md p-1 text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink"
                >
                  <MaterialIcon name="content_copy" className="text-base" />
                </button>
              )}
            </p>
          </div>
        </div>

        {missingEntry && (
          <p className="rounded-md bg-red/10 px-4 py-3 text-sm text-ink-2">
            Tiene turno hoy y no ha marcado entrada. Contáctalo — su teléfono está aquí arriba — y
            si el ponche falló, captura la
            <span className="font-semibold"> marca manual</span> desde el Timesheet.
          </p>
        )}

        {/* La semana medida en hechos + el puente al celular. */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="min-w-0 flex-1">
            <WorkerPerformanceRadar performance={row.performance} />
          </div>
          {row.phone !== '' && <ContactQr name={row.fullName} phone={row.phone} />}
        </div>

        {/* Su ficha personal, del mismo /workers que ya compone el plantel.
            Lo hondo (documentos, historial) sigue en Ver Expediente. */}
        <section className="rounded-lg border border-line bg-surface p-4">
          <p className="text-sm font-semibold text-ink">Sus datos</p>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            <PersonalField label="Edad" value={`${String(row.personal.age)} años`} />
            <PersonalField
              label="Género"
              value={GENDER_LABEL[row.personal.gender] ?? row.personal.gender}
            />
            <PersonalField label="Zona" value={row.personal.zoneName} />
            <PersonalField label="Inglés" value={row.personal.englishLevel ?? '—'} />
            <PersonalField label="Modalidad" value={row.personal.hiringModality ?? '—'} />
            <PersonalField
              label="Transporte"
              value={
                row.personal.transportType === null
                  ? '—'
                  : (TRANSPORT_LABEL[row.personal.transportType] ?? row.personal.transportType)
              }
            />
            <PersonalField
              label="Tipo de sangre"
              value={
                row.personal.bloodType === null
                  ? '—'
                  : (BLOOD_LABEL[row.personal.bloodType] ?? row.personal.bloodType)
              }
            />
            <PersonalField
              label="Contacto de emergencia"
              value={
                row.personal.emergencyContact === null
                  ? '—'
                  : `${row.personal.emergencyContact.name} (${
                      RELATIONSHIP_LABEL[row.personal.emergencyContact.relationship] ??
                      row.personal.emergencyContact.relationship
                    }) · ${row.personal.emergencyContact.phone}`
              }
            />
          </div>
        </section>
      </div>
    </article>
  )
}

/**
 * Mi Personal (Supervisor) con el patrón de Mi Equipo del BDC: lista a la
 * izquierda con el semáforo abrazando cada cara, y el colaborador elegido a
 * fondo a la derecha — la misma forma en que el BDC ve a sus BDs.
 */
export function PersonnelPage(): ReactNode {
  const { data: board, isLoading, isError, refetch } = useGetPersonnelBoardQuery()
  /** El hotel del Supervisor: nombre de /me, foto compuesta de /hotels/:id. */
  const { data: session } = useGetSessionQuery()
  const hotelId = session?.hotel?.id ?? ''
  const { data: hotel } = useGetHotelCardQuery(hotelId, { skip: hotelId === '' })
  const [standByTarget, setStandByTarget] = useState<PersonnelRow | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  /** Por nombre, EN MEMORIA: el plantel ya está cargado entero. */
  const [search, setSearch] = useState('')

  if (isLoading)
    return <CardGridSkeleton cards={6} className="grid-cols-1 md:grid-cols-2 xl:grid-cols-3" />
  if (isError || !board) {
    return (
      <LoadError
        message="No se pudo cargar Mi Personal. Revisa tu conexión e inténtalo de nuevo."
        onRetry={() => {
          void refetch()
        }}
      />
    )
  }

  const visibleRows = board.rows.filter((row) => matchesSearch(search, row.fullName))
  /* El elegido sale de lo VISIBLE: si la búsqueda lo deja fuera, el panel
     pasa al primero que sí se ve, y sin nadie visible no se pinta a nadie. */
  const selected = visibleRows.find((row) => row.workerId === selectedId) ?? visibleRows[0]

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          <FoldText text="Mi Personal" />
        </h1>
        <p className="mt-1.5 text-sm text-ink-3">
          Los colaboradores asignados a tus requisiciones, con su estado en el Semáforo. El Stand-by
          (Rosa) lo compartes con el Manager de Área.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          value={String(board.assignedToday)}
          label="Asignados hoy"
          foot="con turno del Schedule"
          icon="groups"
        />
        <MetricCard
          value={String(board.clockedInToday)}
          label="Con entrada registrada"
          foot="ya marcaron hoy"
          icon="login"
        />
        <MetricCard
          value={String(board.inStandBy)}
          label="En Stand-by"
          foot="pausa temporal (Rosa)"
          icon="pause_circle"
        />
        <MetricCard
          value={String(board.inAccident)}
          label="En accidente"
          foot={IS_DEV_UI ? 'protegido (Gris) · D-27' : 'protegido (Gris)'}
          icon="medical_services"
          tone={board.inAccident > 0 ? 'danger' : 'brand'}
        />
      </div>

      {board.rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line px-6 py-12 text-center">
          <img src={mascotaSaludando} alt="" aria-hidden className="h-32 w-auto" />
          <p className="text-base font-semibold text-ink">Aún no tienes colaboradores asignados</p>
          <p className="max-w-md text-sm text-ink-3">
            Cuando el Schedule programe turnos de tus requisiciones, aparecerán aquí con su estado y
            sus marcas del día.
          </p>
        </div>
      ) : (
        /* Lista a la izquierda, detalle a la derecha: siempre hay uno elegido. */
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[300px_1fr]">
          <div className="flex flex-col gap-3">
            <SearchField
              value={search}
              onChange={setSearch}
              label="Buscar en tu plantel"
              placeholder="Nombre del colaborador, p. ej. Ana Rivera…"
            />
            {visibleRows.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line bg-surface p-6 text-center text-sm text-ink-3">
                Nadie en tu plantel se llama «{search.trim()}». Cambia la búsqueda o límpiala para
                ver a todos.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {visibleRows.map((row) => (
                  <WorkerRow
                    key={row.workerId}
                    row={row}
                    isSelected={row.workerId === selected?.workerId}
                    onSelect={setSelectedId}
                  />
                ))}
              </ul>
            )}
          </div>

          {selected && (
            <WorkerDetail row={selected} hotel={hotel ?? null} onStandBy={setStandByTarget} />
          )}
        </div>
      )}

      <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-4">
        <MaterialIcon name="info" aria-hidden className="mt-0.5 text-sm" />
        El Stand-by (Rosa) lo compartes con el Manager de Área. Un colaborador en Gris (accidente)
        está protegido: no se manda a Stand-by, no se veta y sus faltas no cuentan
        {IS_DEV_UI ? ' (D-27)' : ''}.
        {IS_DEV_UI && (
          <code className="block">
            compuesto: /schedules + /timesheets + /workers · Stand-by = transición PINK
          </code>
        )}
      </p>

      {standByTarget && (
        <StandByDialog
          workerId={standByTarget.workerId}
          workerName={standByTarget.fullName}
          isOpen
          onClose={() => {
            setStandByTarget(null)
          }}
        />
      )}
    </div>
  )
}
