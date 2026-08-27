import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { RequisitionAuthorizationPage } from './RequisitionAuthorizationPage'

import { store } from '@/app/store'

function renderQueue(): void {
  const router = createMemoryRouter(
    [{ path: '/requisiciones/autorizacion', element: <RequisitionAuthorizationPage /> }],
    { initialEntries: ['/requisiciones/autorizacion'] },
  )

  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
}

/*
 * La cola es el listado REAL filtrado por APPLE_GREEN. Los mocks la guardan en
 * memoria, así que firmar en una prueba la cambia para las siguientes: la que
 * resuelve va al final, a propósito. Orden por inicio más próximo:
 * req-0001 (2 días) → req-0002 (6) → req-0003 (9).
 */
describe('RequisitionAuthorizationPage', () => {
  it('nombra el salto del semáforo leyéndolo de las constantes', async () => {
    renderQueue()

    expect(
      await screen.findByText(
        '3 esperan tu firma. Autorizar mueve En elaboración → Autorizada y arranca el reloj de la urgencia',
      ),
    ).toBeInTheDocument()
  })

  it('la cola dice tamaño y cuánto falta para el inicio', async () => {
    renderQueue()

    expect(await screen.findByText('Housekeeping · 1 pos · 6 slots')).toBeInTheDocument()
    expect(screen.getByText('Inicia en 2 días')).toBeInTheDocument()

    // Dos departamentos distintos en la misma requisición se nombran juntos.
    expect(screen.getByText('Alimentos, Housekeeping · 2 pos · 5 slots')).toBeInTheDocument()
  })

  it('el panel muestra lo que se firma: modalidad, hora e inglés', async () => {
    renderQueue()

    // req-0001 va primero: una posición de Housekeeper, sin inglés exigido.
    expect((await screen.findAllByText('Housekeeper')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Tiempo completo').length).toBeGreaterThan(0)
    expect(screen.getAllByText('07:00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('advierte en qué urgencia nacerán las posiciones al firmar', async () => {
    renderQueue()

    // La fecha es dinámica (fixtures relativos a hoy): se afirma la frase.
    expect(
      await screen.findByText(/está a 2 días, así que la posición nace en Rojo \(< 72 h\)/),
    ).toBeInTheDocument()
  })

  it('elegir otra pendiente cambia el panel entero', async () => {
    const user = userEvent.setup()
    renderQueue()

    await user.click(await screen.findByRole('button', { name: /202608200815·B2/ }))

    expect(screen.getByText('Cocinero')).toBeInTheDocument()
    expect(screen.getByText('Básico')).toBeInTheDocument()

    // Con 6 días por delante nacen en Verde, no en Rojo.
    expect(
      screen.getByText(/está a 6 días, así que las 2 posiciones nacen en Verde \(> 120 h\)/),
    ).toBeInTheDocument()
  })

  it('el rechazo no existe en el backend y el botón lo dice', async () => {
    renderQueue()

    const reject = await screen.findByRole('button', { name: 'Rechazar' })
    expect(reject).toBeDisabled()
    expect(reject).toHaveAttribute('title', expect.stringContaining('pendiente 21'))
  })

  it('autorizar la saca de la cola y la selección cae en la siguiente', async () => {
    const user = userEvent.setup()
    renderQueue()

    /* FoldText duplica el texto (sr-only + palabras animadas): se toma el primero. */
    const queueList = (await screen.findAllByText('Pendientes'))[0]?.closest('section') ?? null
    expect(within(queueList as HTMLElement).getAllByRole('listitem')).toHaveLength(3)

    await user.click(screen.getByRole('button', { name: 'Autorizar requisición' }))

    await waitFor(() => {
      expect(screen.queryByText('202608190930·K7')).not.toBeInTheDocument()
    })

    expect(within(queueList as HTMLElement).getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText('Cocinero')).toBeInTheDocument()
  })
})
