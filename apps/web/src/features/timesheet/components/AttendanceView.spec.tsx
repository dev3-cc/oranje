import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import type { TimesheetRow } from '../types/timesheet.types'

import { AttendanceView } from './AttendanceView'

import { store } from '@/app/store'

/* `AttendanceView` ahora embebe `WorkerWeekSummary` (las mismas acciones
   que Días, Hugo 2026-10-10), que usa RTK Query y el badge de requisición
   es un `Link` — necesita Provider y Router, como `TimesheetPage.spec.tsx`. */
function renderAttendance(ui: ReactElement): void {
  render(
    <Provider store={store}>
      <MemoryRouter>{ui}</MemoryRouter>
    </Provider>,
  )
}

function makeRow(overrides: Partial<TimesheetRow>): TimesheetRow {
  return {
    timesheetId: 'ts-1',
    requisitionId: 'req-1',
    workerId: 'wrk-1',
    workerName: 'Ana Rivera Gómez',
    jobTitle: 'Housekeeper',
    photoUrl: null,
    hotelName: 'Hotel Las Palmas',
    weekStatus: 'OPEN',
    totalHours: 34,
    targetHours: 40,
    overtimeHours: null,
    approvedAt: null,
    entries: [
      {
        id: 'entry-1',
        date: '2026-06-01',
        status: 'PENDING',
        hours: 8,
        lunchDeductionMinutes: 0,
        startTime: '08:00',
        endTime: '16:00',
        requisitionNumber: 'REQ-0001',
        punch: 'COMPLETE',
        hasAnomaly: false,
        continuesNextDay: false,
        continuesFromPreviousDay: false,
        isAbsence: false,
        reviewNote: null,
        dayStatus: null,
        punches: [
          {
            id: 'p-1',
            type: 'CLOCK_IN',
            serverTime: '08:00',
            deviceTime: '08:00',
            insideGeofence: true,
            isManual: false,
            manualReason: null,
          },
        ],
      },
    ],
    ...overrides,
  }
}

/**
 * Densidad «Asistencia» del Timesheet (Hugo, 2026-10-09): lista a la
 * izquierda, detalle a la derecha, mismos datos de la semana.
 */
describe('AttendanceView', () => {
  it('elige al primero por defecto y muestra sus horas', () => {
    renderAttendance(
      <AttendanceView
        rows={[makeRow({ workerId: 'wrk-1', workerName: 'Ana Rivera Gómez' })]}
        selectedWeek="2026-06-01"
      />,
    )

    expect(screen.getAllByText('Ana Rivera Gómez').length).toBeGreaterThan(0)
    expect(screen.getAllByText('34h').length).toBeGreaterThan(0)
    // «Horas negativas» se quitó a pedido de Hugo.
    expect(screen.queryByText(/Horas negativas/)).not.toBeInTheDocument()
  })

  it('elegir a otro en la lista cambia el detalle', async () => {
    const user = userEvent.setup()
    renderAttendance(
      <AttendanceView
        rows={[
          makeRow({ workerId: 'wrk-1', workerName: 'Ana Rivera Gómez' }),
          makeRow({ workerId: 'wrk-2', workerName: 'Luis Cabrera', totalHours: 20 }),
        ]}
        selectedWeek="2026-06-01"
      />,
    )

    const list = screen.getAllByRole('list')[0] as HTMLElement
    await user.click(within(list).getByRole('button', { name: /Luis Cabrera/ }))

    expect(screen.getAllByText('Luis Cabrera').length).toBeGreaterThan(1)
    expect(screen.getAllByText('20h').length).toBeGreaterThan(0)
  })

  it('sin Timesheets esa semana lo dice, no inventa una lista vacía', () => {
    renderAttendance(<AttendanceView rows={[]} selectedWeek="2026-06-01" />)

    expect(screen.getByText('Sin Timesheets esta semana.')).toBeInTheDocument()
  })

  /* El botón de enviar/aprobar vive junto a la tabla de días, no en la
     tarjeta de resumen de arriba — una sola vez, no dos (Hugo, 2026-10-10:
     "que el botón esté en la tabla"). El botón de "Aprobar todas" (arriba de
     la lista, Hugo 2026-10-12) es OTRO botón, fuera de la tabla: no cuenta
     para esta regla. */
  it('el botón de enviar/aprobar vive junto a la tabla, no duplicado arriba', () => {
    renderAttendance(
      <AttendanceView
        rows={[makeRow({ workerId: 'wrk-1', workerName: 'Ana Rivera Gómez' })]}
        selectedWeek="2026-06-01"
      />,
    )

    const table = screen.getByText(/^Semana del/).closest('div') as HTMLElement
    const buttons = within(table).getAllByRole('button', { name: /enviar|aprobar/i })
    expect(buttons).toHaveLength(1)
  })
})
