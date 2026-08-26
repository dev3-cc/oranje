import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { PipelinePage } from './PipelinePage'

import { store } from '@/app/store'

/**
 * Prueba de humo de la cadena completa: hook generado -> RTK Query -> capa de
 * fixtures -> componente. Si esto pasa, el día que se apaguen los mocks solo
 * cambia de dónde salen los datos.
 */
function renderPipeline(): void {
  const router = createMemoryRouter([{ path: '/pipeline', element: <PipelinePage /> }], {
    initialEntries: ['/pipeline'],
  })

  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
}

describe('PipelinePage', () => {
  it('pinta el resumen y las tarjetas que devuelve el endpoint', async () => {
    renderPipeline()

    // El total sale de `openCount`, no de contar las tarjetas visibles.
    /**
     * El contrato real no trae `zoneCount`: se deriva de las tarjetas de la
     * página (4 zonas en los fixtures). El 38 sí viaja: es `meta.total`.
     */
    expect(await screen.findByText('38 prospectos abiertos · 4 zonas')).toBeInTheDocument()

    expect(await screen.findByText('Hotel Riviera Maya')).toBeInTheDocument()
    expect(screen.getByText('Grand Costa Nube')).toBeInTheDocument()
    expect(screen.getByText('Hotel Puerto Real')).toBeInTheDocument()
  })

  it('rotula cada columna con lo que el color significa en este semáforo', async () => {
    renderPipeline()

    expect(await screen.findByText('Hotel identificado')).toBeInTheDocument()
    expect(screen.getByText('Contacto y datos')).toBeInTheDocument()
    expect(screen.getByText('Propuesta enviada')).toBeInTheDocument()
    expect(screen.getByText('Seguimiento')).toBeInTheDocument()
  })

  it('«Nuevo prospecto» abre el modal de alta, no otra pantalla', async () => {
    renderPipeline()

    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo prospecto' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Saltar' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Nuevo prospecto' })).toBeInTheDocument()
    // El modal estilo Estates no pinta descripción: sus chips de origen bastan.
    expect(within(dialog).getByRole('button', { name: 'Hotel ya registrado' })).toBeInTheDocument()
  })

  it('la tarjeta lleva al detalle del prospecto', async () => {
    renderPipeline()

    const card = await screen.findByRole('link', { name: /Hotel Puerto Real/ })
    expect(card).toHaveAttribute('href', '/pipeline/psp-0007')
  })
})
