import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it, vi } from 'vitest'

import { NewRequisitionDialog } from './NewRequisitionDialog'

import { store } from '@/app/store'

async function pick(
  user: ReturnType<typeof userEvent.setup>,
  triggerLabel: string,
  optionName: string,
): Promise<void> {
  await user.click(screen.getByLabelText(triggerLabel))
  await user.click(await screen.findByRole('option', { name: optionName }))
}

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

    await pick(user, 'Hotel', 'Hotel Puerto Real')

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

    expect(screen.getByText('4 slots libres')).toBeInTheDocument()

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
    expect(screen.getByText('Falta la posición')).toBeInTheDocument()
  })

  it('guarda y cierra cuando el alta está completa', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Provider store={store}>
        <NewRequisitionDialog isOpen onClose={onClose} />
      </Provider>,
    )

    await pick(user, 'Hotel', 'Hotel Puerto Real')

    await pick(user, 'Posición 1', 'Housekeeper')
    await pick(user, 'Modalidad 1', 'Tiempo completo')
    await pick(user, 'Departamento 1', 'Housekeeping')

    await user.type(screen.getByLabelText('Inicio 1'), '2026-09-18')

    await user.click(screen.getByRole('button', { name: 'Guardar requisición' }))

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    })
  })
})
