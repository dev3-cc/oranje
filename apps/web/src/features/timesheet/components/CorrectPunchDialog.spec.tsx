import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { CorrectPunchDialog } from './CorrectPunchDialog'

const triggerMock = vi.fn().mockReturnValue({ unwrap: () => Promise.resolve(null) })

vi.mock('../api/timesheetApi', () => ({
  useCorrectPunchMutation: () => [
    triggerMock,
    { isLoading: false, isError: false, error: undefined },
  ],
}))

/**
 * Corregir una marca YA registrada (Hugo, 2026-10-10) — distinta de Marca
 * manual. Precarga la hora que ya tenía la marca, exige motivo, y manda
 * `punchId` + la hora nueva al mutation.
 */
describe('CorrectPunchDialog', () => {
  it('precarga la hora actual y exige motivo antes de dejar corregir', async () => {
    const user = userEvent.setup()
    render(
      <CorrectPunchDialog
        target={{
          punch: {
            id: 'p-1',
            type: 'CLOCK_IN',
            serverTime: '08:00',
            deviceTime: '08:00',
            insideGeofence: true,
            isManual: false,
            manualReason: null,
          },
          date: '2026-06-01',
        }}
        workerName="Ana Rivera Gómez"
        onClose={() => {}}
      />,
    )

    expect(screen.getByText(/Ana Rivera Gómez/)).toBeInTheDocument()
    const timeInput: HTMLInputElement = screen.getByLabelText('Hora real de la marca')
    expect(timeInput.value).toBe('08:00')
    expect(screen.getByRole('button', { name: 'Corregir marca' })).toBeDisabled()

    await user.type(screen.getByLabelText('Motivo de la corrección'), 'La hora real era otra')
    expect(screen.getByRole('button', { name: 'Corregir marca' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Corregir marca' }))

    expect(triggerMock).toHaveBeenCalledWith(
      expect.objectContaining({ punchId: 'p-1', reason: 'La hora real era otra' }),
    )
  })
})
