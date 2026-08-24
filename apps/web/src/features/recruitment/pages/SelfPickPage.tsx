import { MaterialIcon } from '@oranje/ui'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import { useGetSelfPickBoardQuery } from '../api/selfPickApi'
import type { SelfPickRow } from '../types/selfPick.types'

import { IS_DEV_UI } from '@/shared/lib/devMode'
import { formatDate } from '@/shared/lib/formatters'

const ANY = '__any__'

const FILTER_CLASS =
  'cursor-pointer rounded-md border border-line bg-surface py-2 pr-8 pl-9 text-sm text-ink focus:border-o-500 focus:outline-none appearance-none'

/** Un filtro con icono, como los de la maqueta. Las opciones salen de la bolsa misma. */
function BoardFilter({
  icon,
  label,
  value,
  options,
  onChange,
}: {
  icon: string
  label: string
  value: string
  options: Array<{ id: string; name: string }>
  onChange: (value: string) => void
}): ReactNode {
  return (
    <span className="relative">
      <MaterialIcon
        name={icon}
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-base text-ink-3"
      />
      <select
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
        }}
        aria-label={label}
        className={FILTER_CLASS}
      >
        <option value={ANY}>{label}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      <MaterialIcon
        name="expand_more"
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-base text-ink-3"
      />
    </span>
  )
}

function uniqueOptions(
  rows: SelfPickRow[],
  pick: (row: SelfPickRow) => { id: string; name: string } | null,
): Array<{ id: string; name: string }> {
  const map = new Map<string, { id: string; name: string }>()
  for (const row of rows) {
    const option = pick(row)
    if (option) map.set(option.id, option)
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Bolsa · Self-Pick (maqueta de la Reclutadora): los renglones con slots
 * libres de las requisiciones autorizadas o en proceso. Gana la primera que
 * confirma (RR-15) — tomar un slot bloquea ESA fila, no la requisición.
 */
export function SelfPickPage(): ReactNode {
  const { data: board, isLoading, isError } = useGetSelfPickBoardQuery()

  const [positionId, setPositionId] = useState(ANY)
  const [modalityId, setModalityId] = useState(ANY)
  const [englishId, setEnglishId] = useState(ANY)

  const rows = useMemo(() => {
    return (board?.rows ?? []).filter((row) => {
      if (positionId !== ANY && row.positionCatalogId !== positionId) return false
      if (modalityId !== ANY && row.modalityId !== modalityId) return false
      if (englishId !== ANY && row.englishId !== englishId) return false
      return true
    })
  }, [board, positionId, modalityId, englishId])

  if (isLoading) return <p className="text-sm text-ink-3">Cargando la bolsa…</p>
  if (isError || !board) {
    return <p className="text-sm text-red">No se pudo cargar la bolsa de Self-Pick.</p>
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-ink">Bolsa · Self-Pick</h1>
        <p className="mt-1 text-sm text-ink-3">
          {board.totalFreeSlots} slots libres en {board.totalRequisitions} requisiciones autorizadas
          {IS_DEV_UI && <code className="text-xs text-ink-4"> · demand.slot vía coverage</code>}
        </p>
      </header>

      <p className="flex items-start gap-2.5 rounded-lg bg-o-50 px-4 py-3 text-sm leading-relaxed text-ink-2">
        <MaterialIcon name="flash_on" aria-hidden className="mt-0.5 text-lg text-o-700" />
        <span>
          <span className="font-semibold text-ink">Gana el primero que confirma (RR-15).</span> Al
          tomar un slot se bloquea esa fila, no la requisición completa — otro reclutador puede
          seguir tomando los demás slots de la misma posición.
        </span>
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {/* El contrato de /requisitions no expone la zona del hotel: se dice. */}
        <span
          title="GET /requisitions no expone la zona del hotel todavía"
          className="relative inline-block"
        >
          <MaterialIcon
            name="place"
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-base text-ink-4"
          />
          <select
            disabled
            aria-label="Zona"
            className={`${FILTER_CLASS} cursor-not-allowed opacity-60`}
          >
            <option>Zona: el contrato no la expone</option>
          </select>
        </span>
        <BoardFilter
          icon="work"
          label="Posición: todas"
          value={positionId}
          options={uniqueOptions(board.rows, (row) => ({
            id: row.positionCatalogId,
            name: row.positionName,
          }))}
          onChange={setPositionId}
        />
        <BoardFilter
          icon="badge"
          label="Modalidad: todas"
          value={modalityId}
          options={uniqueOptions(board.rows, (row) => ({
            id: row.modalityId,
            name: row.modalityName,
          }))}
          onChange={setModalityId}
        />
        <BoardFilter
          icon="translate"
          label="Inglés: cualquiera"
          value={englishId}
          options={uniqueOptions(board.rows, (row) =>
            row.englishId ? { id: row.englishId, name: row.englishName ?? '' } : null,
          )}
          onChange={setEnglishId}
        />
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-10 text-center text-sm text-ink-3">
          Sin slots libres con esos filtros. La bolsa se llena al autorizarse requisiciones.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <li key={row.positionId}>
              <Link
                to={`/self-pick/${row.requisitionId}/${row.positionId}`}
                className="block rounded-lg border border-line bg-surface p-5 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
              >
                <p className="flex items-center gap-1.5 text-xs font-semibold text-o-700">
                  <MaterialIcon name="layers" aria-hidden className="text-base" />
                  {row.freeSlots} {row.freeSlots === 1 ? 'slot libre' : 'slots libres'}
                </p>
                <h2 className="mt-1.5 text-lg font-bold text-ink">{row.positionName}</h2>
                <p className="text-sm text-ink-3">
                  {row.hotelName} · {row.departmentName}
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm text-ink-2">
                  <div className="flex items-center gap-1.5">
                    <MaterialIcon name="event" aria-hidden className="text-base text-ink-3" />
                    {formatDate(row.startDate)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MaterialIcon name="schedule" aria-hidden className="text-base text-ink-3" />
                    {row.startTime ?? '—'}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MaterialIcon name="badge" aria-hidden className="text-base text-ink-3" />
                    {row.modalityName}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MaterialIcon name="translate" aria-hidden className="text-base text-ink-3" />
                    {row.englishName ?? 'No requerido'}
                  </div>
                </dl>
                <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-4">
                  <MaterialIcon name="assignment" aria-hidden className="text-sm" />
                  {row.requisitionNumber}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
