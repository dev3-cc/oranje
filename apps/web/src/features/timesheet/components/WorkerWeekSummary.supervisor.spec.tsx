import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { TimesheetEntry, TimesheetRow } from '../types/timesheet.types'

import { WorkerWeekSummary } from './WorkerWeekSummary'

import { store } from '@/app/store'

/* El mock de sesión por defecto trae TODOS los permisos (sessionApi.ts: "en
   modo mock ningún botón se esconde") — para probar el camino del
   Supervisor real hay que acotar la sesión, igual que
   `TimesheetPage.observer.spec.tsx`. */
const SUPERVISOR_SESSION = {
  data: {
    id: 'u-sup',
    email: 'supervisor@casacurtidor.com',
    name: 'Supervisor',
    shortName: 'Supervisor',
    roleId: 'ROL-H-01',
    photoUrl: null,
    roleCode: 'ROL-H-01',
    roleTitle: 'Supervisor',
    hotel: null,
    department: null,
    locale: 'es',
    permissions: ['timesheet.create_manual_punch'],
  },
}

vi.mock('@/app/sessionApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/sessionApi')>()
  return { ...actual, useGetSessionQuery: () => SUPERVISOR_SESSION }
})

function row(overrides: Partial<TimesheetRow> = {}): TimesheetRow {
  const entry: TimesheetEntry = {
    id: 'day-1',
    date: '2026-08-31',
    status: 'PENDING',
    hours: 8.5,
    lunchDeductionMinutes: 0,
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
  }
  return {
    timesheetId: 'ts-1',
    requisitionId: 'req-1',
    workerId: 'w-1',
    workerName: 'Rosa Prueba',
    jobTitle: 'Camarista',
    photoUrl: null,
    hotelName: 'Hotel Xcaret',
    weekStatus: 'OPEN',
    totalHours: 8.5,
    targetHours: null,
    overtimeHours: null,
    approvedAt: null,
    entries: [entry],
    assignment: { status: 'ACTIVE', endsOn: null },
    ...overrides,
  }
}

/**
 * El Supervisor ya ni envía ni aprueba (Hugo, 2026-10-21 — antes sí enviaba,
 * D-09 lo separaba de aprobar; ahora las dos son del Manager de Área/General).
 * En OPEN no ve ningún botón de Enviar/Aprobar, solo sigue pudiendo capturar
 * una marca manual (`timesheet:create_manual_punch`, que no se tocó).
 */
describe('WorkerWeekSummary · Supervisor', () => {
  it('no ve ni «Enviar a revisión» ni el botón combinado de aprobar', () => {
    render(
      <Provider store={store}>
        <MemoryRouter>
          <WorkerWeekSummary row={row()} onManualPunch={() => undefined} />
        </MemoryRouter>
      </Provider>,
    )

    expect(screen.queryByRole('button', { name: 'Enviar a revisión' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Enviar y aprobar' })).not.toBeInTheDocument()
    // Sigue pudiendo capturar una marca que el ponche no registró.
    expect(screen.getByRole('button', { name: 'Marca manual' })).toBeEnabled()
  })
})
