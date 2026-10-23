import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it } from 'vitest'

import { MessagingContactsList } from './MessagingContactsList'

import { store } from '@/app/store'

/* Los mocks guardan lo que se escribe: cada prueba deja la lista como la
   encuentra la siguiente, así que el orden importa. */
function renderContacts(): void {
  render(
    <Provider store={store}>
      <MessagingContactsList />
    </Provider>,
  )
}

function rowOf(name: string): HTMLElement {
  return screen.getByText(name).closest('tr') as HTMLElement
}

describe('Acciones de Contactos', () => {
  it('crea un contacto y aparece en la lista con su etiqueta', async () => {
    renderContacts()
    await screen.findByText('Ana Ruiz')

    await userEvent.click(screen.getByRole('button', { name: '+ Nuevo contacto' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo contacto' })
    await userEvent.type(within(dialog).getByLabelText('Nombre *'), 'Sofía')
    await userEvent.type(within(dialog).getByLabelText('Teléfono *'), '5599887766')
    await userEvent.type(within(dialog).getByLabelText('País'), 'mx')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Pruebas' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear' }))

    expect(await screen.findByText('Sofía')).toBeInTheDocument()
    expect(screen.getByText('+525599887766')).toBeInTheDocument()
    expect(within(rowOf('Sofía')).getByText('Pruebas')).toBeInTheDocument()
  })

  it('un teléfono repetido muestra el error de la plataforma', async () => {
    renderContacts()
    await screen.findByText('Ana Ruiz')

    await userEvent.click(screen.getByRole('button', { name: '+ Nuevo contacto' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo contacto' })
    await userEvent.type(within(dialog).getByLabelText('Nombre *'), 'Otra Ana')
    await userEvent.type(within(dialog).getByLabelText('Teléfono *'), '+5215512345678')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Ya existe un contacto con ese teléfono',
    )
  })

  it('edita el apellido de un contacto', async () => {
    renderContacts()
    await screen.findByText('Marta')

    await userEvent.click(within(rowOf('Marta')).getByRole('button', { name: 'Editar' }))
    const dialog = await screen.findByRole('dialog', { name: 'Editar contacto' })
    await userEvent.type(within(dialog).getByLabelText('Apellido'), 'Gómez')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText('Marta Gómez')).toBeInTheDocument()
  })

  it('da de baja con confirmación', async () => {
    renderContacts()
    await screen.findByText('Ana Ruiz')

    await userEvent.click(within(rowOf('Ana Ruiz')).getByRole('button', { name: 'Dar de baja' }))
    const dialog = await screen.findByRole('dialog', { name: '¿Dar de baja a Ana Ruiz?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Dar de baja' }))

    expect(await within(rowOf('Ana Ruiz')).findByText('Dado de baja')).toBeInTheDocument()
    expect(within(rowOf('Ana Ruiz')).queryByRole('button', { name: 'Dar de baja' })).toBeNull()
  })

  it('elimina con confirmación', async () => {
    renderContacts()
    await screen.findByText('Jorge Díaz')

    await userEvent.click(within(rowOf('Jorge Díaz')).getByRole('button', { name: 'Eliminar' }))
    const dialog = await screen.findByRole('dialog', { name: '¿Eliminar a Jorge Díaz?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }))

    await waitFor(() => {
      expect(screen.queryByText('Jorge Díaz')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Ana Ruiz')).toBeInTheDocument()
  })
})
