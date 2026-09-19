import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { ContractListPage } from './ContractListPage'

import { store } from '@/app/store'

const SLOW = { timeout: 4000 }

async function renderList(): Promise<void> {
  const router = createMemoryRouter([{ path: '/contracts', element: <ContractListPage /> }], {
    initialEntries: ['/contracts'],
  })

  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )

  /* Sin storage en jsdom el intro es fail-open: sale siempre. Radix pone
     `aria-hidden` en el resto de la página mientras está abierto, así que hay
     que cerrarlo ANTES de leer nada. */
  await userEvent.click(await screen.findByRole('button', { name: 'Saltar' }))
}

/*
 * Toda la suite con tiempo propio: la pantalla monta la lista Y el documento
 * embebido, y en el runner del CI (suite en paralelo) cualquiera de sus casos
 * puede pasarse de los 5 s por defecto. En local pasan siempre.
 */
describe('ContractListPage', { timeout: 20_000 }, () => {
  it('el intro explica de qué va la pantalla antes de entrar', async () => {
    const router = createMemoryRouter([{ path: '/contracts', element: <ContractListPage /> }], {
      initialEntries: ['/contracts'],
    })
    render(
      <Provider store={store}>
        <RouterProvider router={router} />
      </Provider>,
    )

    /* Lo primero que ve quien entra: qué distingue un contrato de una propuesta
       y de dónde salen la nómina y la factura. */
    expect(await screen.findByText('El hotel ya dijo que sí')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(await screen.findByText('De aquí salen la nómina y la factura')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Saltar' }))
    expect(screen.queryByText('El hotel ya dijo que sí')).not.toBeInTheDocument()
  })

  it('muestra el estado de cada contrato en su tarjeta', async () => {
    await renderList()

    expect((await screen.findAllByText('Activo')).length).toBeGreaterThanOrEqual(3)
    expect(screen.getByText('Expirado')).toBeInTheDocument()
    expect(screen.getByText('Borrador')).toBeInTheDocument()
  })

  it('la tarjeta lleva el hotel, su foto y desde cuánto se factura', async () => {
    await renderList()

    /* El documento es el mismo machote para todos: lo que distingue una tarjeta
       de otra es el hotel y su foto, no una miniatura del papel. */
    const card = (await screen.findAllByRole('link'))
      .map((link) => link)
      .find((link) => link.getAttribute('href')?.startsWith('/contracts/'))
    expect(card).toBeDefined()
    /* El fondo del hotel: su foto de Places o, sin ella, el placeholder de marca. */
    expect((card as HTMLElement).querySelector('img')).not.toBeNull()
    expect(screen.getAllByText(/desde \$/).length).toBeGreaterThan(0)
  })

  it('cada tarjeta enlaza a la ficha de su contrato', async () => {
    await renderList()

    const links = await screen.findAllByRole('link')
    const hrefs = links
      .map((link) => link.getAttribute('href'))
      .filter((href): href is string => href?.startsWith('/contracts/') ?? false)

    expect(hrefs.length).toBeGreaterThanOrEqual(5)
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  it('los filtros viven detrás de «Filtrar» y no ocupan la pantalla', async () => {
    const user = userEvent.setup()
    await renderList()

    await screen.findAllByText('Activo')
    expect(screen.queryByLabelText('Buscar contrato')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Filtrar/ }))
    expect(await screen.findByLabelText('Buscar contrato')).toBeInTheDocument()
  })

  it('el estado sí filtra, y lo hace en el servidor', async () => {
    const user = userEvent.setup()
    await renderList()

    await screen.findAllByText('Activo')
    await user.click(screen.getByRole('button', { name: /Filtrar/ }))
    await user.click(await screen.findByLabelText('Estado'))
    /* La opción se lee con la etiqueta humana del estado, no con el código
       crudo del enum: lo que viaja al servidor sigue siendo DRAFT. */
    await user.click(await screen.findByRole('option', { name: 'Estado: Borrador' }))

    await waitFor(() => {
      expect(screen.queryByText('Expirado')).not.toBeInTheDocument()
    }, SLOW)
    expect(screen.getByText('Borrador')).toBeInTheDocument()
  })

  it('la búsqueda espera a que dejes de teclear', async () => {
    const user = userEvent.setup()
    await renderList()

    await screen.findAllByText('Activo')
    await user.click(screen.getByRole('button', { name: /Filtrar/ }))
    await user.type(await screen.findByLabelText('Buscar contrato'), 'Mirador')

    await waitFor(() => {
      expect(
        screen.getAllByRole('link').filter((l) => l.getAttribute('href')?.startsWith('/contracts/'))
          .length,
      ).toBe(1)
    }, SLOW)
  })

  it('con un filtro sin resultados lo dice y ofrece quitarlo', async () => {
    const user = userEvent.setup()
    await renderList()

    await screen.findAllByText('Activo')
    await user.click(screen.getByRole('button', { name: /Filtrar/ }))
    await user.type(await screen.findByLabelText('Buscar contrato'), 'Hotel que no existe')

    expect(
      await screen.findByText(/Ningún contrato con estos filtros/, undefined, SLOW),
    ).toBeInTheDocument()
  })
})
