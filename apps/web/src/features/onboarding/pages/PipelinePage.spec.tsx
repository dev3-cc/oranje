import { render, screen, waitFor, within } from '@testing-library/react'
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
    expect(screen.getAllByText('Grand Costa Nube').length).toBeGreaterThan(0)
    // Hotel Puerto Real sale dos veces a propósito: un prospecto en Rosa y
    // otro, distinto, ya convertido en Naranja (ver el tablero completo).
    expect(screen.getAllByText('Hotel Puerto Real').length).toBeGreaterThan(0)
  })

  it('rotula cada columna con lo que el color significa en este semáforo', async () => {
    renderPipeline()

    expect(await screen.findByText('Hotel identificado')).toBeInTheDocument()
    expect(screen.getByText('Contacto y datos')).toBeInTheDocument()
    expect(screen.getByText('Armar y enviar propuesta')).toBeInTheDocument()
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

  it('«Zona» filtra en el servidor y «Quitar filtros» devuelve el tablero', async () => {
    const user = userEvent.setup()
    renderPipeline()

    expect(await screen.findByText('Hotel Bahía Serena')).toBeInTheDocument()
    expect(screen.getByText('Hotel Riviera Maya')).toBeInTheDocument()
    // El BD ve solo lo suyo: el filtro de dueño no se le enseña.
    expect(screen.queryByLabelText('Dueño')).not.toBeInTheDocument()

    await user.click(screen.getByLabelText('Zona'))
    await user.click(await screen.findByRole('option', { name: 'Zona: Poniente' }))

    await waitFor(() => {
      expect(screen.queryByText('Hotel Riviera Maya')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Hotel Bahía Serena')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Quitar filtros/ }))
    expect(await screen.findByText('Hotel Riviera Maya')).toBeInTheDocument()
  })

  it('la tarjeta lleva al detalle del prospecto', async () => {
    renderPipeline()

    // Dos prospectos distintos comparten el nombre "Hotel Puerto Real"
    // (uno en Rosa, otro ya en Naranja) — se busca la tarjeta de ESTE
    // prospecto por su href, no por el nombre del hotel.
    const cards = await screen.findAllByRole('link', { name: /Hotel Puerto Real/ })
    const card = cards.find((link) => link.getAttribute('href') === '/pipeline/psp-0007')
    expect(card).toBeDefined()
  })

  // Hugo, 2026-10-23: antes solo el Manager de QA veía la columna Naranja —
  // BD/BDC tenía que ir a Clientes Activos, sin buscador, para encontrar un
  // hotel ya cliente. Ahora el tablero la pinta para todos.
  it('Naranja se ve para todos, no solo para el Manager de QA', async () => {
    renderPipeline()

    expect(await screen.findByText('Hotel identificado')).toBeInTheDocument()
    expect(screen.getByText('Cliente activo')).toBeInTheDocument()
  })

  it('el buscador filtra por nombre de hotel, sobre lo que ya cargó el tablero', async () => {
    const user = userEvent.setup()
    renderPipeline()

    expect(await screen.findByText('Hotel Riviera Maya')).toBeInTheDocument()
    expect(screen.getByText('Hotel Playa Azul')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Buscar hotel'), 'Riviera')

    await waitFor(() => {
      expect(screen.queryByText('Hotel Playa Azul')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Hotel Riviera Maya')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Quitar filtros/ }))
    expect(await screen.findByText('Hotel Playa Azul')).toBeInTheDocument()
  })
})
