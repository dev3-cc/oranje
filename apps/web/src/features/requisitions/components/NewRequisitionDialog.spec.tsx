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

  it('el inspector no se elige: sale de la zona del hotel', async () => {
    const user = userEvent.setup()
    renderDialog()

    expect(screen.queryByLabelText('Inspector de zona')).not.toBeInTheDocument()
    expect(
      screen.getByText('El Inspector se asigna solo por la zona del hotel (RR-13)'),
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Hotel Puerto Real' })).toBeInTheDocument()
    })
    await user.selectOptions(screen.getByLabelText('Hotel'), 'htl-psp-0012')

    expect(
      screen.getByText('Zona Centro · el Inspector se congela al guardar (RR-13)'),
    ).toBeInTheDocument()
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

  it('exige hotel y los catálogos de la posición', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole('button', { name: 'Guardar requisición' }))

    expect(await screen.findByText('Falta el hotel')).toBeInTheDocument()
    expect(screen.getByText('Posición 1: Falta la posición')).toBeInTheDocument()
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
      expect(screen.getByRole('option', { name: 'Hotel Puerto Real' })).toBeInTheDocument()
    })

    await user.selectOptions(screen.getByLabelText('Hotel'), 'htl-psp-0012')

    await user.selectOptions(screen.getByLabelText('Posición 1'), 'pos-hk')
    await user.selectOptions(screen.getByLabelText('Modalidad 1'), 'mod-ft')
    await user.selectOptions(screen.getByLabelText('Departamento 1'), 'dep-hk')

    const row = screen.getByLabelText('Posición 1').closest('tr')
    const date = within(row as HTMLElement).getByLabelText('Inicio 1')
    await user.type(date, '2026-09-18')

    await user.click(screen.getByRole('button', { name: 'Guardar requisición' }))

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    })
  })
})
