import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it } from 'vitest'

import { CatalogsPage } from './CatalogsPage'

import { store } from '@/app/store'

function renderPage(): void {
  render(
    <Provider store={store}>
      <CatalogsPage />
    </Provider>,
  )
}

describe('CatalogsPage', () => {
  it('lista los departamentos y cada posición dice el suyo', async () => {
    const user = userEvent.setup()
    renderPage()

    // Pestaña inicial: departamentos del seed de mocks.
    expect(await screen.findByText('Housekeeping')).toBeInTheDocument()
    expect(screen.getByText('Alimentos')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Posiciones' }))
    const housekeeper = (await screen.findByText('Housekeeper')).closest('li') as HTMLElement
    expect(within(housekeeper).getByText('Housekeeping')).toBeInTheDocument()
  })

  it('agrega una modalidad nueva desde el diálogo', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('tab', { name: 'Modalidades' }))
    await user.click(screen.getByRole('button', { name: 'Agregar modalidad' }))

    await user.type(screen.getByLabelText('Nombre'), 'Por temporada alta')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(
      () => {
        expect(screen.getByText('Por temporada alta')).toBeInTheDocument()
      },
      { timeout: 4000 },
    )
  })

  it('eliminar un departamento en uso explica el freno, no truena', async () => {
    const user = userEvent.setup()
    renderPage()

    const row = (await screen.findByText('Housekeeping')).closest('li') as HTMLElement
    await user.click(within(row).getByRole('button', { name: 'Eliminar Housekeeping' }))
    await user.click(await screen.findByRole('button', { name: 'Sí, eliminar' }))

    // El mock simula la FK del back: el departamento tiene posiciones.
    expect(await screen.findByRole('alert')).toHaveTextContent(/no se puede eliminar/i)
    // Y la fila sigue viva.
    expect(screen.getByText('Housekeeping')).toBeInTheDocument()
  })
})
