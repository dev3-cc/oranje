import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it } from 'vitest'

import { UsersPage } from './UsersPage'

import { store } from '@/app/store'

function renderUsers(): void {
  render(
    <Provider store={store}>
      <UsersPage />
    </Provider>,
  )
}

describe('UsersPage', () => {
  it('lista al personal activo con su rol y el estado de su cuenta', async () => {
    renderUsers()

    expect(await screen.findByText('Hugo Curtidor')).toBeInTheDocument()
    expect(screen.getByText('bdc@casacurtidor.com')).toBeInTheDocument()
    // Iván no ha hecho su primer login: su cuenta sigue en invitación.
    expect(screen.getByText('Invitación enviada')).toBeInTheDocument()
    // Sofía está de baja y el filtro por defecto la oculta.
    expect(screen.queryByText('Sofía Vega')).not.toBeInTheDocument()
  })

  it('la pestaña de inactivos trae a la gente dada de baja, con su conteo', async () => {
    const user = userEvent.setup()
    renderUsers()
    await screen.findByText('Hugo Curtidor')

    const inactiveTab = screen.getByRole('button', { name: /Inactivos/ })
    expect(inactiveTab).toHaveTextContent('1')
    await user.click(inactiveTab)

    expect(await screen.findByText('Sofía Vega')).toBeInTheDocument()
    expect(screen.getByText('Inactivo')).toBeInTheDocument()
    expect(screen.queryByText('Hugo Curtidor')).not.toBeInTheDocument()
  })

  it('buscar espera a que dejes de teclear, y «Quitar filtros» regresa a todos', async () => {
    const user = userEvent.setup()
    renderUsers()
    await screen.findByText('Hugo Curtidor')

    const search = screen.getByLabelText('Buscar usuario')
    await user.type(search, 'Marta')
    expect(search).toHaveValue('Marta')

    await waitFor(() => {
      expect(screen.queryByText('Hugo Curtidor')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Marta Solís')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Quitar filtros/ }))
    expect(search).toHaveValue('')
    expect(await screen.findByText('Hugo Curtidor')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Quitar filtros/ })).not.toBeInTheDocument()
  })

  it('el alta por invitación no pide contraseña; definirla la exige de 8+', async () => {
    const user = userEvent.setup()
    renderUsers()
    await screen.findByText('Hugo Curtidor')

    await user.click(screen.getByRole('button', { name: 'Agregar usuario' }))
    expect(await screen.findByText('Bienvenido al alta de personal')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Saltar' }))
    expect(await screen.findByText(/recibe un correo de invitación/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Contraseña')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Definir contraseña' }))
    expect(screen.queryByText(/recibe un correo de invitación/)).not.toBeInTheDocument()
    const password = screen.getByLabelText('Contraseña')

    await user.type(screen.getByLabelText('Nombre completo'), 'Prueba Nueva')
    await user.type(screen.getByLabelText('Correo'), 'prueba@casacurtidor.com')
    await user.type(password, 'corta')
    await user.click(screen.getByRole('button', { name: 'Crear usuario' }))
    expect(
      await screen.findByText('La contraseña necesita al menos 8 caracteres'),
    ).toBeInTheDocument()
  })

  it('editar bloquea el correo: cambiar de persona es baja y alta', async () => {
    const user = userEvent.setup()
    renderUsers()

    await user.click(await screen.findByText('Marta Solís'))
    expect(await screen.findByText('Editar usuario')).toBeInTheDocument()

    const email = screen.getByLabelText('Correo')
    expect(email).toBeDisabled()
    await waitFor(() => {
      expect(email).toHaveValue('reclutadora@casacurtidor.com')
    })
    expect(screen.getByRole('switch', { name: 'Activo' })).toBeInTheDocument()
  })
})
