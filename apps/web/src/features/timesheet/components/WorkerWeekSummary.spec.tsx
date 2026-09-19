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
    isAbsence: false,
    reviewNote: null,
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
  it('con la asignación activa, enviar y capturar marcas están disponibles', () => {
    renderSummary(row({ assignment: { status: 'ACTIVE', endsOn: null } }))

    expect(screen.getByRole('button', { name: 'Enviar a revisión' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Marca manual' })).toBeEnabled()
  })

  it('si el API no dice nada de la asignación, no se bloquea nada', () => {
    renderSummary(row())

    expect(screen.getByRole('button', { name: 'Marca manual' })).toBeEnabled()
  })

  it('con días con anomalía, enviar se deshabilita y el título dice cuántos', () => {
    renderSummary(
      row({
        entries: [entry(), entry({ id: 'day-2', date: '2026-09-01', hasAnomaly: true })],
      }),
    )

    const submit = screen.getByRole('button', { name: 'Enviar a revisión' })
    expect(submit).toBeDisabled()
    expect(submit).toHaveAttribute('title', expect.stringContaining('1 día con anomalía'))
  })

  it('con la asignación terminada, la marca manual se deshabilita y dice desde cuándo', () => {
    renderSummary(row({ assignment: { status: 'CLOSED', endsOn: '2026-09-02' } }))

    const manual = screen.getByRole('button', { name: 'Marca manual' })
    expect(manual).toBeDisabled()
    expect(manual).toHaveAttribute('title', expect.stringContaining('terminó el 2 sep 2026'))
    // Las horas registradas siguen siendo aprobables: enviar no se toca por esto.
    expect(screen.getByRole('button', { name: 'Enviar a revisión' })).toBeEnabled()
  })

  it('sin asignación (datos sembrados), la marca manual lo dice en vez de fallar al enviar', () => {
    renderSummary(row({ assignment: null }))

    expect(screen.getByRole('button', { name: 'Marca manual' })).toHaveAttribute(
      'title',
      expect.stringContaining('Sin asignación en esta requisición'),
    )
  })
})
