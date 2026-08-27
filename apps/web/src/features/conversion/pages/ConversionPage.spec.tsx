import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { ConversionPage } from './ConversionPage'

import { store } from '@/app/store'

function renderConversion(prospectId: string): void {
  const router = createMemoryRouter(
    [{ path: '/conversion/:prospectId', element: <ConversionPage /> }],
    {
      initialEntries: [`/conversion/${prospectId}`],
    },
  )

  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
}

describe('ConversionPage', () => {
  it('lista los requisitos con su evidencia y lo que pasa al aprobar', async () => {
    renderConversion('psp-0007')

    expect(await screen.findByText('Propuesta enviada')).toBeInTheDocument()
    expect(screen.getByText('Propuesta v2 · 03 jun')).toBeInTheDocument()
    expect(screen.getByText('Contacto principal registrado')).toBeInTheDocument()
    expect(screen.getByText('Marta Solís · Gerente de Compras')).toBeInTheDocument()

    expect(screen.getByText(/El semáforo pasa a Naranja/)).toBeInTheDocument()
    expect(screen.getByText(/El hotel queda activado como cliente/)).toBeInTheDocument()
  })

  it('sin usuario del hotel la aprobación queda bloqueada y dice por qué', async () => {
    renderConversion('psp-0007')

    expect(await screen.findByText(/Se crea para el contacto principal/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aprobar conversión' })).toBeDisabled()
    expect(screen.getByText(/HOTEL_USER_REQUIRED/)).toBeInTheDocument()
  })

  it('crear el usuario del hotel desbloquea la aprobación sin salir de la pantalla', async () => {
    renderConversion('psp-0007')

    await userEvent.click(await screen.findByRole('button', { name: 'Crear cuenta del hotel' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Aprobar conversión' })).toBeEnabled()
    })
    expect(screen.getByText('Marta Solís · Manager General')).toBeInTheDocument()
  })

  it('devolver a Café exige elegir motivo antes de confirmar', async () => {
    renderConversion('psp-0007')

    await userEvent.click(await screen.findByRole('button', { name: 'Devolver a Café' }))

    const confirm = await screen.findByRole('button', { name: 'Confirmar regreso' })
    expect(confirm).toBeDisabled()
    expect(screen.getByLabelText(/Motivo del regreso/)).toBeInTheDocument()
  })

  it('un prospecto fuera de Rosa dice EN QUÉ estado está, no un error genérico', async () => {
    renderConversion('psp-0004')

    expect(await screen.findByText(/Este prospecto está en/)).toBeInTheDocument()
    expect(screen.getByText('Azul claro')).toBeInTheDocument()
  })
})
