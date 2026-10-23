import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it } from 'vitest'

import { MessagingContactsList } from './MessagingContactsList'

import { store } from '@/app/store'

function renderContacts(): void {
  render(
    <Provider store={store}>
      <MessagingContactsList />
    </Provider>,
  )
}

describe('MessagingContactsList', () => {
  it('lista los contactos con su teléfono, etiquetas y estado', async () => {
    renderContacts()

    expect(await screen.findByText('Ana Ruiz')).toBeInTheDocument()
    expect(screen.getByText('4 en total')).toBeInTheDocument()
    expect(screen.getByText('+5215512345678')).toBeInTheDocument()
    expect(screen.getAllByText('Oficina')).toHaveLength(2)
    expect(screen.getByText('Dado de baja')).toBeInTheDocument()
  })

  it('busca por nombre, teléfono o email', async () => {
    renderContacts()
    await screen.findByText('Ana Ruiz')

    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar contactos' }), 'marta')
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }))

    expect(await screen.findByText('1 en total')).toBeInTheDocument()
    expect(screen.getByText('Marta')).toBeInTheDocument()
    expect(screen.queryByText('Ana Ruiz')).not.toBeInTheDocument()
  })

  it('sin coincidencias lo dice', async () => {
    renderContacts()
    await screen.findByText('Ana Ruiz')

    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar contactos' }), 'zzz')
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }))

    expect(await screen.findByText('Nadie coincide')).toBeInTheDocument()
  })
})
