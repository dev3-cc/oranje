import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import type { TimesheetEntry, TimesheetRow } from '../types/timesheet.types'

import { WorkerWeekSummary } from './WorkerWeekSummary'

import { store } from '@/app/store'

function entry(overrides: Partial<TimesheetEntry> = {}): TimesheetEntry {
  return {
    id: 'day-1',
    date: '2026-08-31',
    status: 'PENDING',
    hours: 8.5,
    startTime: '07:00',
    endTime: '16:00',
    requisitionNumber: '202608181919BZ',
    punch: 'COMPLETE',
    hasAnomaly: false,
    continuesNextDay: false,
    continuesFromPreviousDay: false,
    isAbsence: false,
    reviewNote: null,
    dayStatus: null,
    punches: [],
    ...overrides,
  }
}

function row(overrides: Partial<TimesheetRow> = {}): TimesheetRow {
  return {
    timesheetId: 'ts-1',
    requisitionId: 'req-1',
    workerId: 'w-1',
    workerName: 'Rosa Prueba',
    jobTitle: 'Camarista',
    hotelName: 'Hotel Xcaret',
    weekStatus: 'OPEN',
    totalHours: 8.5,
    targetHours: null,
    overtimeHours: null,
    entries: [entry()],
    ...overrides,
  }
}

function renderSummary(data: TimesheetRow): void {
  render(
    <Provider store={store}>
      <MemoryRouter>
        <WorkerWeekSummary row={data} onManualPunch={() => undefined} />
      </MemoryRouter>
    </Provider>,
  )
}

/**
 * Lo que el back rechazaría DESPUÉS (ANOMALIES_PENDING, ASSIGNMENT_NOT_ACTIVE)
 * el botón lo dice ANTES: deshabilitado y con el porqué en el título.
 */
describe('WorkerWeekSummary', () => {
  /* La sesión de prueba puede aprobar (hereda de Supervisor, D-09): en
     OPEN ve el botón combinado "Enviar y aprobar" — las dos cosas en un
     solo clic — no "Enviar a revisión" (Hugo, 2026-10-10). */
  it('con la asignación activa, aprobar y capturar marcas están disponibles', () => {
    renderSummary(row({ assignment: { status: 'ACTIVE', endsOn: null } }))

    expect(screen.getByRole('button', { name: 'Enviar y aprobar' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Marca manual' })).toBeEnabled()
  })

  it('si el API no dice nada de la asignación, no se bloquea nada', () => {
    renderSummary(row())

    expect(screen.getByRole('button', { name: 'Marca manual' })).toBeEnabled()
  })

  it('con días con anomalía, aprobar se deshabilita y el título dice cuántos', () => {
    renderSummary(
      row({
        entries: [entry(), entry({ id: 'day-2', date: '2026-09-01', hasAnomaly: true })],
      }),
    )

    const submit = screen.getByRole('button', { name: 'Enviar y aprobar' })
    expect(submit).toBeDisabled()
    expect(submit).toHaveAttribute('title', expect.stringContaining('1 día con anomalía'))
  })

  it('con la asignación terminada, la marca manual se deshabilita y dice desde cuándo', () => {
    renderSummary(row({ assignment: { status: 'CLOSED', endsOn: '2026-09-02' } }))

    const manual = screen.getByRole('button', { name: 'Marca manual' })
    expect(manual).toBeDisabled()
    expect(manual).toHaveAttribute('title', expect.stringContaining('terminó el 2 sep 2026'))
    // Las horas registradas siguen siendo aprobables: enviar/aprobar no se toca por esto.
    expect(screen.getByRole('button', { name: 'Enviar y aprobar' })).toBeEnabled()
  })

  it('sin asignación (datos sembrados), la marca manual lo dice en vez de fallar al enviar', () => {
    renderSummary(row({ assignment: null }))

    expect(screen.getByRole('button', { name: 'Marca manual' })).toHaveAttribute(
      'title',
      expect.stringContaining('Sin asignación en esta requisición'),
    )
  })
})
