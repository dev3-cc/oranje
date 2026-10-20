import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it } from 'vitest'

import type { TimesheetPayPreview } from '../types/timesheet.types'

import { PayPreviewBadge } from './PayPreviewBadge'

import { store } from '@/app/store'

function preview(overrides: Partial<TimesheetPayPreview> = {}): TimesheetPayPreview {
  return {
    regularMinutes: 2400,
    overtimeMinutes: 0,
    payRate: '20.00',
    isInternalRate: false,
    overtimeMultiplier: 1.5,
    subtotal: '800.00',
    deductionAmount: '0.00',
    netAmount: '800.00',
    isOverridden: false,
    overrideReason: null,
    billRate: '30.00',
    billSubtotal: '1200.00',
    contractUpdatedAt: null,
    ...overrides,
  }
}

function renderBadge(props: Parameters<typeof PayPreviewBadge>[0]): void {
  render(
    <Provider store={store}>
      <PayPreviewBadge {...props} />
    </Provider>,
  )
}

/**
 * Hugo, 2026-10-16: si el contrato se edita DESPUÉS de que la semana ya se
 * aprobó, lo que se ve ya no es lo que se aprobó — se avisa, no se oculta.
 */
describe('PayPreviewBadge', () => {
  it('sin aprobar todavía: el contrato pudo cambiar y no avisa nada', () => {
    renderBadge({
      payPreview: preview({ contractUpdatedAt: '2026-10-16T12:00:00.000Z' }),
      approvedAt: null,
    })

    expect(screen.queryByText('Contrato cambió')).not.toBeInTheDocument()
  })

  it('aprobada y el contrato se editó ANTES: no avisa — es lo mismo que se aprobó', () => {
    renderBadge({
      payPreview: preview({ contractUpdatedAt: '2026-10-01T12:00:00.000Z' }),
      approvedAt: '2026-10-10T12:00:00.000Z',
    })

    expect(screen.queryByText('Contrato cambió')).not.toBeInTheDocument()
  })

  it('aprobada y el contrato se editó DESPUÉS: avisa', async () => {
    renderBadge({
      payPreview: preview({ contractUpdatedAt: '2026-10-16T12:00:00.000Z' }),
      approvedAt: '2026-10-10T12:00:00.000Z',
    })

    expect(screen.getByText('Contrato cambió')).toBeInTheDocument()

    await userEvent.hover(screen.getByText('Contrato cambió'))
    expect(
      await screen.findByText(/lo que ves aquí es el cálculo nuevo, no el que se aprobó/),
    ).toBeInTheDocument()
  })
})
