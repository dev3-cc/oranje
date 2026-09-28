import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { MailSettingsPage } from './MailSettingsPage'

import { store } from '@/app/store'

function renderPage(): void {
  render(
    <Provider store={store}>
      <MemoryRouter>
        <MailSettingsPage />
      </MemoryRouter>
    </Provider>,
  )
}

describe('MailSettingsPage', () => {
  it('dice primero qué ha pasado con el correo, y luego ofrece el interruptor', async () => {
    renderPage()

    /* El resumen va antes que el control: mover el interruptor sin saber qué
       está pasando sería un acto de fe. */
    expect(await screen.findByText('Por el servidor de Oranje')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('Por el respaldo')).toBeInTheDocument()

    const propio = screen.getByRole('button', { name: /Servidor de Oranje/ })
    expect(propio).toHaveAttribute('aria-pressed', 'true')
  })

  it('cambiar a Firebase marca la otra opción', async () => {
    const user = userEvent.setup()
    renderPage()

    const respaldo = await screen.findByRole('button', { name: /Firebase/ })
    await user.click(respaldo)

    await waitFor(() => expect(respaldo).toHaveAttribute('aria-pressed', 'true'))
    expect(screen.getByRole('button', { name: /Servidor de Oranje/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('el último correo que salió por el respaldo se distingue del que salió por lo nuestro', async () => {
    renderPage()

    expect(await screen.findByText('ana@oranjepeople.com')).toBeInTheDocument()
    expect(screen.getByText('luis@oranjepeople.com')).toBeInTheDocument()
    // Dos etiquetas distintas, no un color: «Respaldo» se lee, el naranja no.
    expect(screen.getAllByText('Respaldo').length).toBeGreaterThan(0)
  })
})
