import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it, vi } from 'vitest'

import { NewRequisitionDialog } from './NewRequisitionDialog'

import { store } from '@/app/store'

async function toPositions(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await pick(user, 'Hotel', 'Hotel Puerto Real')
  await user.click(screen.getByRole('button', { name: 'Continuar' }))
  await screen.findByText('Posiciones solicitadas')
}

async function pick(
  user: ReturnType<typeof userEvent.setup>,
  triggerLabel: string,
  optionName: string,
): Promise<void> {
  await user.click(screen.getByLabelText(triggerLabel))
  await user.click(await screen.findByRole('option', { name: optionName }))
}

async function renderDialog(onClose = vi.fn()): Promise<{ onClose: () => void }> {
  render(
    <Provider store={store}>
      <NewRequisitionDialog isOpen onClose={onClose} />
    </Provider>,
  )
  await userEvent.setup().click(await screen.findByRole('button', { name: 'Saltar' }))
  return { onClose }
}

describe('NewRequisitionDialog', () => {
  it('no pide el folio: lo genera el backend al guardar', async () => {
    await renderDialog()

    expect(screen.getByText(/El folio se asigna automáticamente al guardar/)).toBeInTheDocument()
    expect(screen.getByText('AAAAMMDDHHMM + homoclave')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Número/)).not.toBeInTheDocument()
  })

  it('el inspector no se elige: sale de la zona del hotel', async () => {
    const user = userEvent.setup()
    await renderDialog()

    expect(screen.queryByLabelText('Inspector de zona')).not.toBeInTheDocument()
    expect(
      screen.getByText(/El Inspector se asigna solo por la zona del hotel/),
    ).toBeInTheDocument()

    await pick(user, 'Hotel', 'Hotel Puerto Real')

    expect(screen.getByText(/Zona Centro · el Inspector se congela al guardar/)).toBeInTheDocument()
  })

  it('cada unidad de cantidad es un slot, y el total los suma', async () => {
    const user = userEvent.setup()
    await renderDialog()
    await toPositions(user)

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
    await renderDialog()
    await toPositions(user)

    expect(screen.getByRole('button', { name: 'Quitar posición 1' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: '+ Agregar posición' }))
    expect(screen.getByRole('button', { name: 'Quitar posición 1' })).toBeEnabled()
  })

  it('cada paso exige lo suyo: primero el hotel, luego la posición', async () => {
    const user = userEvent.setup()
    await renderDialog()

    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(await screen.findByText('Falta el hotel')).toBeInTheDocument()

    await toPositions(user)
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(await screen.findByText('Falta la posición')).toBeInTheDocument()
  })

  it('guarda y cierra cuando el alta está completa', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Provider store={store}>
        <NewRequisitionDialog isOpen onClose={onClose} />
      </Provider>,
    )
    await user.click(await screen.findByRole('button', { name: 'Saltar' }))

    await toPositions(user)

    await pick(user, 'Posición 1', 'Housekeeper')
    await pick(user, 'Modalidad 1', 'Tiempo completo')
    await pick(user, 'Departamento 1', 'Housekeeping')

    await user.type(screen.getByLabelText('Inicio 1'), '2026-09-18')

    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(await screen.findByText(/Nace en Borrador/)).toBeInTheDocument()

    // El botón se arma 350ms después de llegar a Revisión: frena el doble clic.
    const save = screen.getByRole('button', { name: 'Guardar requisición' })
    await waitFor(() => {
      expect(save).toBeEnabled()
    })
    await user.click(save)

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    })
  })
})
