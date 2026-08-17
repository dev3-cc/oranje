import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it, vi } from 'vitest'

import { NewRequisitionDialog } from './NewRequisitionDialog'

import { store } from '@/app/store'

function renderDialog(onClose = vi.fn()): { onClose: () => void } {
  render(
    <Provider store={store}>
      <NewRequisitionDialog isOpen onClose={onClose} />
    </Provider>,
  )
  return { onClose }
}

describe('NewRequisitionDialog', () => {
  it('no pide el folio: lo genera el backend al guardar', () => {
    renderDialog()

    expect(
      screen.getByText('El número se genera al guardar — AAAAMMDDHHMM + homoclave de 2 caracteres'),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText(/Número/)).not.toBeInTheDocument()
  })

  it('nombra el estado de nacimiento desde las constantes', () => {
    renderDialog()

    // §5 dice que una requisición nace en VERDE_MANZANA — «En elaboración».
    expect(screen.getByText(/Nace en En elaboración — por autorizar/)).toBeInTheDocument()
  })

  it('el inspector no se elige: sale de la zona del hotel', async () => {
    const user = userEvent.setup()
    renderDialog()

    const inspector = screen.getByLabelText('Inspector de zona')
    expect(inspector).toBeDisabled()
    expect(inspector).toHaveValue('')

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Hotel Xcaret Arte' })).toBeInTheDocument()
    })
    await user.selectOptions(screen.getByLabelText('Hotel'), 'htl-arte')

    expect(inspector).toHaveValue('R. Solís — zona Centro')
  })

  it('cada unidad de cantidad es un slot, y el total los suma', async () => {
    const user = userEvent.setup()
    renderDialog()

    expect(screen.getByText('Total: 1 posición · 1 slot')).toBeInTheDocument()

    const quantity = screen.getByLabelText('Cantidad 1')
    await user.clear(quantity)
    await user.type(quantity, '4')

    expect(screen.getByText('4 libres')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '+ Agregar posición' }))
    expect(screen.getByText('Total: 2 posiciones · 5 slots')).toBeInTheDocument()
  })

  it('no deja quitar la última posición', async () => {
    const user = userEvent.setup()
    renderDialog()

    expect(screen.getByRole('button', { name: 'Quitar posición 1' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: '+ Agregar posición' }))
    expect(screen.getByRole('button', { name: 'Quitar posición 1' })).toBeEnabled()
  })

  it('exige hotel, departamento, responsable y el nombre de la posición', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole('button', { name: 'Guardar requisición' }))

    expect(await screen.findByText('Falta el hotel')).toBeInTheDocument()
    expect(screen.getByText('Falta el GH responsable')).toBeInTheDocument()
    expect(screen.getByText('Posición 1: Escribe la posición')).toBeInTheDocument()
  })

  it('guarda y cierra cuando el alta está completa', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Provider store={store}>
        <NewRequisitionDialog isOpen onClose={onClose} />
      </Provider>,
    )

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Hotel Xcaret Arte' })).toBeInTheDocument()
    })

    await user.selectOptions(screen.getByLabelText('Hotel'), 'htl-arte')
    await user.selectOptions(screen.getByLabelText('Departamento del hotel'), 'Ama de llaves')
    await user.selectOptions(screen.getByLabelText('GH responsable del área'), 'gh-marcela')

    await user.type(screen.getByLabelText('Posición 1'), 'Camarista')
    await user.selectOptions(screen.getByLabelText('Departamento 1'), 'Ama de llaves')

    const row = screen.getByLabelText('Posición 1').closest('tr')
    const date = within(row as HTMLElement).getByLabelText('Inicio 1')
    await user.type(date, '2026-08-18')

    await user.click(screen.getByRole('button', { name: 'Guardar requisición' }))

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    })
  })
})
