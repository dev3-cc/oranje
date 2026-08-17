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
 * Los mocks guardan la cola en memoria, así que firmar en una prueba la cambia
 * para las siguientes: las que resuelven van al final, a propósito.
 */
describe('RequisitionAuthorizationPage', () => {
  it('nombra el salto del semáforo leyéndolo de las constantes', async () => {
    renderQueue()

    // §5 dice que autorizar mueve «En elaboración» a «Autorizada». Si el vault
    // corrige el semáforo, esta frase se corrige sola.
    expect(
      await screen.findByText(
        '3 esperan tu firma. Autorizar mueve En elaboración → Autorizada y arranca el reloj de la urgencia',
      ),
    ).toBeInTheDocument()
  })

  it('la cola dice tamaño y cuánto falta para el inicio', async () => {
    renderQueue()

    expect(await screen.findByText('Mantenimiento · 2 pos · 2 slots')).toBeInTheDocument()
    expect(screen.getByText('Inicia en 2 días')).toBeInTheDocument()

    // Una sola posición y un solo slot van en singular.
    expect(screen.getByText('Recepción · 1 pos · 1 slot')).toBeInTheDocument()
  })

  it('el panel muestra lo que se firma: modalidad, hora e inglés', async () => {
    renderQueue()

    expect(await screen.findByText('Técnico de mantenimiento')).toBeInTheDocument()
    expect(screen.getByText('Auxiliar de albañilería')).toBeInTheDocument()
    expect(screen.getByText('Nómina')).toBeInTheDocument()
    expect(screen.getAllByText('06:00')).toHaveLength(2)
    expect(screen.getByText('Básico')).toBeInTheDocument()
    expect(screen.getByText('No requerido')).toBeInTheDocument()
  })

  it('advierte en qué urgencia nacerán las posiciones al firmar', async () => {
    renderQueue()

    expect(
      await screen.findByText(
        'Al autorizar, la urgencia se calcula contra la fecha de inicio: 14 ago está a 2 días, así que las 2 posiciones nacen en Rojo (< 72 h)',
      ),
    ).toBeInTheDocument()
  })

  it('elegir otra pendiente cambia el panel entero', async () => {
    const user = userEvent.setup()
    renderQueue()

    await user.click(await screen.findByRole('button', { name: /202608120955·N5/ }))

    expect(screen.getByText('Guardia de acceso')).toBeInTheDocument()
    expect(screen.getByText('Monitorista de CCTV')).toBeInTheDocument()
    expect(screen.queryByText('Técnico de mantenimiento')).not.toBeInTheDocument()

    // Con 9 días por delante nacen en Verde, no en Rojo.
    expect(
      screen.getByText(
        'Al autorizar, la urgencia se calcula contra la fecha de inicio: 21 ago está a 9 días, así que las 3 posiciones nacen en Verde (> 120 h)',
      ),
    ).toBeInTheDocument()
  })

  it('rechazar sin motivo no resuelve nada', async () => {
    const user = userEvent.setup()
    renderQueue()

    await user.click(await screen.findByRole('button', { name: 'Rechazar' }))

    expect(screen.getByText('El motivo es obligatorio al rechazar')).toBeInTheDocument()
    // Sigue en la cola: el rechazo no salió.
    expect(screen.getAllByText('202608121115·M9').length).toBeGreaterThan(0)
  })

  it('autorizar la saca de la cola y la selección cae en la siguiente', async () => {
    const user = userEvent.setup()
    renderQueue()

    const queueList = (await screen.findByText('Pendientes')).closest('section')
    expect(within(queueList as HTMLElement).getAllByRole('listitem')).toHaveLength(3)

    // El motivo es opcional al autorizar, pero se elige para comprobar que viaja.
    await user.selectOptions(screen.getByLabelText(/Motivo/), 'reason-01')
    await user.click(screen.getByRole('button', { name: 'Autorizar requisición' }))

    await waitFor(() => {
      expect(screen.queryByText('202608121115·M9')).not.toBeInTheDocument()
    })

    expect(within(queueList as HTMLElement).getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText('Recepcionista bilingüe')).toBeInTheDocument()
  })
})
