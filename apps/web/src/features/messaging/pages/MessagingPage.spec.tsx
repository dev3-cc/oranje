import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it } from 'vitest'

import { MessagingPage } from './MessagingPage'

import { store } from '@/app/store'

function renderMessaging(): void {
  render(
    <Provider store={store}>
      <MessagingPage />
    </Provider>,
  )
}

describe('MessagingPage', () => {
  it('muestra las cuatro secciones, con el Panel elegido al entrar', () => {
    renderMessaging()

    for (const name of [/Panel/, /Colaboradores/, /Plantillas/, /Campañas/]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: /Panel/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('el Panel trae las cifras y las campañas recientes de la plataforma', async () => {
    renderMessaging()

    const panel = screen.getByRole('region', { name: 'Panel' })
    expect(await within(panel).findByText('Prueba oficina')).toBeInTheDocument()
    expect(within(panel).getByText('hello_world')).toBeInTheDocument()
    expect(within(panel).getByText('Completada')).toBeInTheDocument()
    expect(within(panel).getByText('3/3')).toBeInTheDocument()
  })

  it('al elegir otra sección, la marca y la muestra debajo', async () => {
    renderMessaging()

    await userEvent.click(screen.getByRole('button', { name: /Campañas/ }))

    expect(screen.getByRole('button', { name: /Campañas/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Panel/ })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('region', { name: 'Campañas' })).toBeInTheDocument()
  })
})
