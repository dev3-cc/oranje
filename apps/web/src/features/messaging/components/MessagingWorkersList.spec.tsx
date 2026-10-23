import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it } from 'vitest'

import { MessagingWorkersList } from './MessagingWorkersList'

import { store } from '@/app/store'

function renderWorkers(): void {
  render(
    <Provider store={store}>
      <MessagingWorkersList />
    </Provider>,
  )
}

describe('MessagingWorkersList', () => {
  it('lista los colaboradores con su total', async () => {
    renderWorkers()

    expect(await screen.findByText(/en total/)).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Teléfono' })).toBeInTheDocument()
    expect(screen.getAllByRole('row').length).toBeGreaterThan(1)
  })

  it('el filtro por estado deja solo a los de ese semáforo', async () => {
    const user = userEvent.setup()
    renderWorkers()
    await screen.findByText('Luis Cabrera')

    await user.click(screen.getByRole('combobox', { name: 'Estado' }))
    await user.click(await screen.findByRole('option', { name: 'Estado: Fijo' }))

    await waitFor(() => {
      expect(screen.queryByText('Ana Rivera')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Luis Cabrera')).toBeInTheDocument()
  })

  it('el filtro por hotel deja solo a quien trabaja ahí', async () => {
    const user = userEvent.setup()
    renderWorkers()
    await screen.findByText('Luis Cabrera')

    await user.click(await screen.findByRole('combobox', { name: 'Hotel' }))
    await user.click(
      await screen.findByRole('option', { name: 'Hotel: Home2 Suites by Hilton Cartersville' }),
    )

    await waitFor(() => {
      expect(screen.queryByText('Ana Rivera Gómez')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Luis Cabrera')).toBeInTheDocument()
  })

  it('una búsqueda sin coincidencias lo dice', async () => {
    renderWorkers()
    await screen.findByText(/en total/)

    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Buscar colaboradores' }),
      'zzzz-nadie',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }))

    expect(await screen.findByText('Nadie coincide')).toBeInTheDocument()
  })
})
