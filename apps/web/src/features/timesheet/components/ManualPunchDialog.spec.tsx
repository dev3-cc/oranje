import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { TimesheetEntry } from '../types/timesheet.types'

import { ManualPunchDialog } from './ManualPunchDialog'

const triggerMock = vi.fn()

vi.mock('../api/timesheetApi', () => ({
  useCreateManualPunchMutation: () => [
    triggerMock,
    { isLoading: false, isError: false, error: undefined },
  ],
}))

function makeEntry(overrides: Partial<TimesheetEntry>): TimesheetEntry {
  return {
    id: 'day-1',
    date: '2026-06-01',
    status: 'PENDING',
    hours: null,
    lunchDeductionMinutes: 0,
    startTime: null,
    endTime: null,
    requisitionNumber: 'REQ-0001',
    punch: 'NO_SHIFT',
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

/**
 * El selector de «Tipo de marca» ya no asume siempre Entrada: propone la que
 * sigue según lo que ese día ya tenga marcado (Hugo, 2026-10-10).
 */
describe('ManualPunchDialog', () => {
  it('sin marcas ese día, propone Entrada', async () => {
    const user = userEvent.setup()
    render(
      <ManualPunchDialog
        row={{
          requisitionId: 'req-1',
          workerId: 'wrk-1',
          workerName: 'Ana Rivera Gómez',
          entries: [makeEntry({ date: '2026-06-01', punches: [] })],
        }}
        initialDate="2026-06-01"
        onClose={() => {}}
      />,
    )
    // jsdom no trae localStorage: el intro siempre se ve la primera vez.
    await user.click(await screen.findByRole('button', { name: 'Saltar' }))

    expect(screen.getByText('Vas a marcar:')).toBeInTheDocument()
    // «Entrada» también vive en las opciones del selector: se cuenta, no se
    // busca única.
    expect(screen.getAllByText('Entrada').length).toBeGreaterThan(0)
  })

  it('con entrada ya marcada, propone Salida a lunch — no Entrada otra vez', async () => {
    const user = userEvent.setup()
    render(
      <ManualPunchDialog
        row={{
          requisitionId: 'req-1',
          workerId: 'wrk-1',
          workerName: 'Ana Rivera Gómez',
          entries: [
            makeEntry({
              date: '2026-06-01',
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
            }),
          ],
        }}
        initialDate="2026-06-01"
        onClose={() => {}}
      />,
    )
    await user.click(await screen.findByRole('button', { name: 'Saltar' }))

    expect(screen.getAllByText('Salida a lunch').length).toBeGreaterThan(0)
  })
})
