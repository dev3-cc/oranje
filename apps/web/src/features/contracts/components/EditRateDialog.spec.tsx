import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it } from 'vitest'

import type { ContractRate } from '../types/contract.types'

import { EditRateDialog } from './EditRateDialog'

import { store } from '@/app/store'

const RATES: ContractRate[] = [
  {
    id: 'rate-1',
    catalogPositionId: 'pos-hk',
    positionName: 'Housekeeper',
    payRate: 170,
    billRate: 250,
  },
  {
    id: 'rate-2',
    catalogPositionId: 'pos-hm',
    positionName: 'Houseman',
    payRate: 165,
    billRate: 240,
  },
]

function renderDialog(): void {
  render(
    <Provider store={store}>
      <EditRateDialog contractId="ct-0184" rates={RATES} isOpen onClose={() => {}} />
    </Provider>,
  )
}

describe('EditRateDialog', () => {
  // Hugo, 2026-10-20: antes ofrecía el catálogo completo (cientos de
  // posiciones de cualquier industria); ahora solo lo que el contrato ya
  // trae — agregar una posición nunca cotizada es un caso aparte.
  it('solo ofrece las posiciones que el contrato ya cotizó, no el catálogo completo', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole('combobox', { name: 'Posición' }))

    const listbox = screen.getByRole('listbox')
    expect(within(listbox).getByText('Housekeeper')).toBeInTheDocument()
    expect(within(listbox).getByText('Houseman')).toBeInTheDocument()
    // Ningún puesto fuera de las dos filas del contrato.
    expect(within(listbox).getAllByRole('option')).toHaveLength(2)
  })

  it('elegir una posición precarga su tarifa vigente, no la deja en blanco', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole('combobox', { name: 'Posición' }))
    await user.click(screen.getByRole('option', { name: 'Houseman' }))

    expect(screen.getByLabelText('Tarifa de pago')).toHaveValue('165.00')
    expect(screen.getByLabelText('Tarifa de facturación')).toHaveValue('240.00')
  })
})
