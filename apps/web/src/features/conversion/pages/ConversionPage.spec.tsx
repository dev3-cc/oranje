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

    expect(await screen.findByText('Propuesta enviada y aceptada')).toBeInTheDocument()
    expect(screen.getByText('Propuesta v2 · 03 jun 2026')).toBeInTheDocument()
    expect(screen.getByText('Contacto principal registrado')).toBeInTheDocument()

    expect(screen.getByText('prospect.onboarding_state_id pasa a ORANGE')).toBeInTheDocument()
    expect(screen.getByText('hotel.activated_at toma la fecha de hoy')).toBeInTheDocument()
  })

  /** El permiso lo decide el backend; el front no cuenta palomitas. */
  it('un requisito pendiente bloquea la aprobación y dice por qué', async () => {
    renderConversion('psp-0007')

    expect(await screen.findByText('No existe todavía — bloquea la conversión')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aprobar conversión' })).toBeDisabled()
    expect(screen.getByText('Faltan 1 requisitos por cumplir.')).toBeInTheDocument()
  })

  it('crear el usuario del hotel desbloquea la aprobación sin salir de la pantalla', async () => {
    renderConversion('psp-0007')

    await userEvent.click(await screen.findByRole('button', { name: 'Crear usuario' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Aprobar conversión' })).toBeEnabled()
    })
    expect(screen.getByText('Creado desde el contacto principal')).toBeInTheDocument()
  })

  it('con todo cumplido se puede aprobar de entrada', async () => {
    renderConversion('psp-0012')

    expect(await screen.findByText('Conversión a cliente activo')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Aprobar conversión' })).toBeEnabled()
    })
  })
})
