import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { CatalogsPage } from './CatalogsPage'

import { store } from '@/app/store'

async function renderPage(): Promise<void> {
  render(
    <Provider store={store}>
      <MemoryRouter>
        <CatalogsPage />
      </MemoryRouter>
    </Provider>,
  )
  /* Sin storage en jsdom el intro es fail-open: sale siempre y se salta. */
  await userEvent.click(await screen.findByRole('button', { name: 'Saltar' }))
}

describe('CatalogsPage', () => {
  it('cada posición vive dentro de la sección de su departamento', async () => {
    await renderPage()

    // Pestaña inicial: departamentos del seed de mocks, cada uno como sección.
    expect(await screen.findByText('Housekeeping')).toBeInTheDocument()
    expect(screen.getByText('Alimentos')).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Posiciones' })).not.toBeInTheDocument()

    const section = (await screen.findByText('Housekeeper')).closest('section') as HTMLElement
    expect(within(section).getByRole('heading', { name: 'Housekeeping' })).toBeInTheDocument()
    expect(within(section).getByRole('button', { name: 'Agregar posición' })).toBeInTheDocument()
  })

  it('el buscador filtra la pestaña en memoria y el vacío dice cómo salir', async () => {
    const user = userEvent.setup()
    await renderPage()

    expect(await screen.findByText('Housekeeping')).toBeInTheDocument()
    const field = screen.getByLabelText('Buscar en Departamentos y posiciones')

    // Sin acentos ni mayúsculas: «alim» encuentra «Alimentos».
    await user.type(field, 'ALIM')
    expect(screen.getByText('Alimentos')).toBeInTheDocument()
    expect(screen.queryByText('Housekeeping')).not.toBeInTheDocument()

    await user.clear(field)
    await user.type(field, 'zzz')
    expect(
      screen.getByText(/Ningún departamento ni posición coincide con «zzz»/),
    ).toBeInTheDocument()

    // La búsqueda también entra por la posición: «house» trae Housekeeper dentro de su sección.
    await user.clear(field)
    await user.type(field, 'housekeeper')
    expect(screen.getByText('Housekeeper')).toBeInTheDocument()

    // Cambiar de pestaña limpia la búsqueda: la pestaña nueva se abre completa.
    await user.click(screen.getByRole('tab', { name: 'Modalidades' }))
    expect(screen.getByLabelText('Buscar en Modalidades')).toHaveValue('')
  })

  it('agrega una modalidad nueva desde el diálogo', async () => {
    const user = userEvent.setup()
    await renderPage()

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
    await renderPage()

    const section = (await screen.findByText('Housekeeping')).closest('section') as HTMLElement
    await user.click(within(section).getByRole('button', { name: 'Eliminar Housekeeping' }))
    await user.click(await screen.findByRole('button', { name: 'Sí, eliminar' }))

    // El mock simula la FK del back: el departamento tiene posiciones.
    expect(await screen.findByRole('alert')).toHaveTextContent(/no se puede eliminar/i)
    // Y la fila sigue viva.
    expect(screen.getByText('Housekeeping')).toBeInTheDocument()
  })
})
