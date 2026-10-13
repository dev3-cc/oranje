import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { TimesheetEntry, TimesheetRow } from '../types/timesheet.types'

import { WorkerWeekSummary } from './WorkerWeekSummary'

import { store } from '@/app/store'

/* El mock de sesión por defecto trae TODOS los permisos (sessionApi.ts: "en
   modo mock ningún botón se esconde") — para probar el camino del
   Supervisor puro (sin `timesheet:approve_hours`) hay que acotar la sesión,
   igual que `TimesheetPage.observer.spec.tsx`. */
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
    permissions: ['timesheet.review_punches', 'timesheet.create_manual_punch'],
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
    entries: [entry],
    assignment: { status: 'ACTIVE', endsOn: null },
    ...overrides,
  }
}

/**
 * El Supervisor no aprueba (D-09): en OPEN sigue viendo "Enviar a
 * revisión", no el botón combinado que sí ve un Manager de Área/General
 * (Hugo, 2026-10-10).
 */
describe('WorkerWeekSummary · Supervisor', () => {
  it('ve Enviar a revisión, no el botón combinado de aprobar', () => {
    render(
      <Provider store={store}>
        <MemoryRouter>
          <WorkerWeekSummary row={row()} onManualPunch={() => undefined} />
        </MemoryRouter>
      </Provider>,
    )

    expect(screen.getByRole('button', { name: 'Enviar a revisión' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Enviar y aprobar' })).not.toBeInTheDocument()
  })
})
