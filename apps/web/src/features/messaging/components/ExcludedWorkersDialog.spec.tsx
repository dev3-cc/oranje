import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { ExcludedWorkersLink } from './ExcludedWorkersDialog'

import { store } from '@/app/store'

describe('ExcludedWorkersLink', () => {
  it('lista a quienes no se pueden sincronizar, con el motivo y su expediente', async () => {
    const user = userEvent.setup()
    render(
      <Provider store={store}>
        <MemoryRouter>
          <ExcludedWorkersLink />
        </MemoryRouter>
      </Provider>,
    )

    expect(await screen.findByText(/3 colaboradores sin teléfono válido/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Teléfono inválido: 555-12')).toBeInTheDocument()
    expect(within(dialog).getAllByText('Sin teléfono')).toHaveLength(2)
    const links = within(dialog).getAllByRole('link', { name: 'Abrir expediente' })
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/collaborator-pool/wrk-0001',
      '/collaborator-pool/wrk-0002',
      '/collaborator-pool/wrk-0003',
    ])
  })
})
