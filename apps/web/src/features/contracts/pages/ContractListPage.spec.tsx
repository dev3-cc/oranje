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
  await userEvent.click(await screen.findByRole('button', { name: 'Saltar' }, SLOW))
}

/*
 * Toda la suite con tiempo propio: la pantalla monta la lista Y el contrato
 * elegido embebido (con su propia vista previa del documento), y en el
 * runner del CI (suite en paralelo) cualquiera de sus casos puede pasarse de
 * los 5 s por defecto. En local pasan siempre.
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
       y de dónde salen la nómina y la factura. `findBy*` sin segundo argumento
       usa 1 s por omisión, menor que el `timeout: 20_000` del describe — bajo
       el runner en paralelo (suite completa) eso solo alcanzaba a veces
       (visto en vivo 2026-10-20), así que cada espera lleva su propio SLOW. */
    expect(await screen.findByText('El hotel ya dijo que sí', undefined, SLOW)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(
      await screen.findByText('De aquí salen la nómina y la factura', undefined, SLOW),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Saltar' }))
    expect(screen.queryByText('El hotel ya dijo que sí')).not.toBeInTheDocument()
  })

  it('al entrar ya se ve el primer contrato de la lista, sin tener que elegirlo', async () => {
    await renderList()

    expect(
      await screen.findByRole('heading', { name: 'Contrato CT-2026-0184' }, SLOW),
    ).toBeInTheDocument()
  })

  it('elegir otro contrato de la lista lo abre a la derecha, sin salir de la lista', async () => {
    await renderList()

    await screen.findByRole('heading', { name: 'Contrato CT-2026-0184' }, SLOW)
    await userEvent.click(screen.getByRole('button', { name: /Hotel Mirador/ }))
    expect(
      await screen.findByRole('heading', { name: 'Contrato CT-2026-0098' }, SLOW),
    ).toBeInTheDocument()
  })

  it('muestra el estado de cada contrato en su renglón', async () => {
    await renderList()

    expect((await screen.findAllByText('Activo', undefined, SLOW)).length).toBeGreaterThanOrEqual(3)
    expect(screen.getByText('Expirado')).toBeInTheDocument()
    expect(screen.getByText('Borrador')).toBeInTheDocument()
  })

  // Hugo, 2026-10-21: "necesitamos un buscador de hoteles" — ya existía,
  // pero escondido detrás de «Filtrar» nadie lo encontraba. Los 3 filtros de
  // categoría (Estado/Zona/Vencimiento) sí se quedan detrás del botón.
  it('el buscador vive siempre visible; los filtros de categoría detrás de «Filtrar»', async () => {
    const user = userEvent.setup()
    await renderList()

    await screen.findAllByText('Activo', undefined, SLOW)
    expect(screen.getByLabelText('Buscar contrato')).toBeInTheDocument()
    expect(screen.queryByLabelText('Estado')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Filtrar/ }))
    expect(await screen.findByLabelText('Estado')).toBeInTheDocument()
  })

  it('el estado sí filtra la lista', async () => {
    const user = userEvent.setup()
    await renderList()

    await screen.findAllByText('Activo', undefined, SLOW)
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

    await screen.findAllByText('Activo', undefined, SLOW)
    await user.click(screen.getByRole('button', { name: /Filtrar/ }))
    await user.type(await screen.findByLabelText('Buscar contrato'), 'Mirador')

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Hotel Puerto Real/ })).not.toBeInTheDocument()
    }, SLOW)
    expect(screen.getByRole('button', { name: /Hotel Mirador/ })).toBeInTheDocument()
  })

  it('con un filtro sin resultados lo dice y ofrece quitarlo', async () => {
    const user = userEvent.setup()
    await renderList()

    await screen.findAllByText('Activo', undefined, SLOW)
    await user.click(screen.getByRole('button', { name: /Filtrar/ }))
    await user.type(await screen.findByLabelText('Buscar contrato'), 'Hotel que no existe')

    expect(
      await screen.findByText(/Ningún contrato con estos filtros/, undefined, SLOW),
    ).toBeInTheDocument()
  })
})
