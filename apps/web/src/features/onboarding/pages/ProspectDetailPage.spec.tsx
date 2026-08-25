import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { ProspectDetailPage } from './ProspectDetailPage'

import { store } from '@/app/store'

function renderDetail(prospectId: string): void {
  const router = createMemoryRouter(
    [{ path: '/pipeline/:prospectId', element: <ProspectDetailPage /> }],
    { initialEntries: [`/pipeline/${prospectId}`] },
  )

  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
}

describe('ProspectDetailPage', () => {
  it('muestra las versiones de la propuesta dentro de la ficha del hotel', async () => {
    renderDetail('psp-0008')

    expect(await screen.findByText('Versiones de la propuesta')).toBeInTheDocument()
    expect(await screen.findByText('Propuesta v3')).toBeInTheDocument()
    expect(screen.getByText('Propuesta v2')).toBeInTheDocument()
    expect(screen.getByText('Propuesta v1')).toBeInTheDocument()

    // El borrador se distingue de las enviadas sin salir de la ficha.
    expect(screen.getByText('Borrador · sin enviar')).toBeInTheDocument()
  })

  it('entra al editor por una ruta que cuelga del pipeline', async () => {
    renderDetail('psp-0008')

    const link = await screen.findByRole('link', { name: 'Abrir propuesta' })
    expect(link).toHaveAttribute('href', '/pipeline/psp-0008/propuesta')
  })

  it('el encabezado conserva solo las dos acciones del diseño', async () => {
    renderDetail('psp-0008')

    await screen.findByText('Versiones de la propuesta')

    expect(screen.getByRole('button', { name: 'Registrar intento' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cambiar estado' })).toBeInTheDocument()
    // La entrada a la propuesta vive en su tarjeta, no como tercera acción.
    expect(screen.queryByRole('link', { name: 'Enviar propuesta' })).not.toBeInTheDocument()
  })

  it('un cliente activo es esta misma ficha, en naranja y sin más movimientos', async () => {
    renderDetail('psp-0012')

    expect(await screen.findByRole('heading', { name: 'Hotel Puerto Real' })).toBeInTheDocument()
    expect(screen.getByText('Naranja')).toBeInTheDocument()

    // NARANJA es terminal: ofrecer el diálogo solo para enseñarlo vacío es peor
    // que no ofrecerlo.
    expect(screen.getByRole('button', { name: 'Cambiar estado' })).toBeDisabled()
  })

  it('el historial de un convertido no salta pasos del semáforo', async () => {
    renderDetail('psp-0012')

    // GRIS -> AZUL_CLARO -> VERDE -> AMARILLO -> ROSA -> NARANJA: el camino que
    // permiten las transiciones, no un salto que el backend no podría escribir.
    expect(await screen.findByText('Hotel identificado')).toBeInTheDocument()
    expect(screen.getByText('Negociación de términos')).toBeInTheDocument()
    expect(screen.getByText('Cliente activo')).toBeInTheDocument()
  })

  it('«Editar» en Contactos del hotel abre el alta de contactos', async () => {
    const user = userEvent.setup()
    renderDetail('psp-0007')

    expect(await screen.findByText('Contactos del hotel')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Editar' }))

    expect(screen.getByText('commercial.hotel_contact · Hotel Puerto Real')).toBeInTheDocument()
    expect(screen.getByText('3 registrados · 1 sin guardar')).toBeInTheDocument()
  })
})
