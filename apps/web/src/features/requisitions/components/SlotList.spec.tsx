import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import type { RequisitionPosition } from '../types/requisition.types'

import { SlotList } from './SlotList'

/** Una posición con un slot ocupado y uno libre: los dos casos en una. */
const POSICIÓN: RequisitionPosition = {
  id: 'pos-1',
  index: 1,
  name: 'Stewar',
  quantity: 2,
  startDate: '2026-10-20',
  slots: [
    {
      id: 'slot-1',
      index: 1,
      status: 'occupied',
      assigneeName: 'Juan David',
      assigneeId: 'wrk-1',
      assignedAt: '2026-10-09T15:00:00.000Z',
      offerChannel: null,
    },
    {
      id: 'slot-2',
      index: 2,
      status: 'free',
      assigneeName: null,
      assigneeId: null,
      assignedAt: null,
      offerChannel: null,
    },
  ],
} as RequisitionPosition

function pintar(canAssign: boolean): void {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <SlotList
            position={POSICIÓN}
            requisitionId="req-9"
            canAssign={canAssign}
            assignHint="La requisición todavía no está autorizada."
          />
        ),
      },
    ],
    { initialEntries: ['/'] },
  )
  render(<RouterProvider router={router} />)
}

describe('SlotList', () => {
  it('el slot libre lleva a llenarlo y el ocupado al perfil de quien lo ocupa', () => {
    pintar(true)

    expect(screen.getByRole('link', { name: 'Asignar al siguiente slot libre' })).toHaveAttribute(
      'href',
      '/self-pick/req-9/pos-1',
    )
    expect(screen.getByRole('link', { name: 'Ver el perfil de Juan David' })).toHaveAttribute(
      'href',
      '/collaborator-pool/wrk-1',
    )
    // Uno por fila y nada más: el ocupado nunca ofrece asignar.
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })

  it('sin permiso para asignar, el slot libre no es un enlace muerto: no es enlace', () => {
    pintar(false)

    expect(screen.queryByRole('link', { name: 'Asignar al siguiente slot libre' })).toBeNull()
    expect(screen.getByText('Sin asignar')).toBeInTheDocument()
    // El perfil no depende de poder asignar: son dos cosas distintas.
    expect(screen.getByRole('link', { name: 'Ver el perfil de Juan David' })).toBeInTheDocument()
    // Y dice POR QUÉ no se puede, en vez de quedarse mudo (Hugo, 2026-10-09).
    expect(screen.getByText('La requisición todavía no está autorizada.')).toBeInTheDocument()
  })
})
