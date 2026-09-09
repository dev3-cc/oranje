import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { UsersPage } from './UsersPage'

import { store } from '@/app/store'

function renderUsers(initialPath = '/usuarios'): void {
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialPath]}>
        <UsersPage />
      </MemoryRouter>
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

  it('«Personal de hoteles» lista las cuentas con su hotel y su departamento', async () => {
    const user = userEvent.setup()
    renderUsers()
    await screen.findByText('Hugo Curtidor')

    await user.click(screen.getByRole('tab', { name: 'Personal de hoteles' }))

    expect((await screen.findAllByText('Diego Ramírez'))[0]).toBeInTheDocument()
    expect(screen.getAllByText('Paola Herrera').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Hotel Xcaret').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Housekeeping').length).toBeGreaterThan(0)
    expect(screen.getByText('Todo el hotel')).toBeInTheDocument()
    // René está de baja: solo en Inactivos.
    expect(screen.queryByText('René Ochoa')).not.toBeInTheDocument()
    expect(screen.queryByText('Hugo Curtidor')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Inactivos/ }))
    expect(await screen.findByText('René Ochoa')).toBeInTheDocument()
  })

  it('el ámbito vive en la URL: ?ambito=hoteles abre directo la pestaña de hoteles', async () => {
    renderUsers('/usuarios?ambito=hoteles')
    expect((await screen.findAllByText('Diego Ramírez'))[0]).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Personal de hoteles' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('el alta de una cuenta del hotel pide departamento a un Supervisor y no al Manager General', async () => {
    const user = userEvent.setup()
    renderUsers('/usuarios?ambito=hoteles')
    await screen.findAllByText('Diego Ramírez')

    await user.click(screen.getByRole('button', { name: 'Agregar cuenta del hotel' }))
    expect((await screen.findAllByText('Nueva cuenta del hotel'))[0]).toBeInTheDocument()
    expect(screen.queryByLabelText('Departamento')).not.toBeInTheDocument()

    await user.click(screen.getByRole('combobox', { name: 'Rol' }))
    await user.click(await screen.findByRole('option', { name: 'Supervisor' }))
    expect(await screen.findByLabelText('Departamento')).toBeInTheDocument()

    await user.click(screen.getByRole('combobox', { name: 'Rol' }))
    await user.click(await screen.findByRole('option', { name: 'Manager General' }))
    await waitFor(() => {
      expect(screen.queryByLabelText('Departamento')).not.toBeInTheDocument()
    })
    expect(screen.getByText('El Manager General no reporta a nadie.')).toBeInTheDocument()
  })

  it('crear un Supervisor: los jefes salen del hotel elegido y la invitación se confirma', async () => {
    const user = userEvent.setup()
    renderUsers('/usuarios?ambito=hoteles')
    await screen.findAllByText('Diego Ramírez')

    await user.click(screen.getByRole('button', { name: 'Agregar cuenta del hotel' }))
    await screen.findAllByText('Nueva cuenta del hotel')

    await user.click(screen.getByRole('combobox', { name: 'Hotel' }))
    await user.click(await screen.findByRole('option', { name: 'Hotel Xcaret' }))
    await user.click(screen.getByRole('combobox', { name: 'Rol' }))
    await user.click(await screen.findByRole('option', { name: 'Supervisor' }))
    await user.click(await screen.findByLabelText('Departamento'))
    await user.click(await screen.findByRole('option', { name: 'Housekeeping' }))

    // Paola (Manager de Área de Housekeeping) y Diego (Manager General) son los jefes válidos.
    await user.click(screen.getByRole('combobox', { name: 'Reporta a' }))
    expect(await screen.findByRole('option', { name: /Paola Herrera/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Diego Ramírez/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Aldo Castillo/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('option', { name: /Paola Herrera/ }))

    await user.type(screen.getByLabelText('Nombre completo'), 'Nueva Supervisora')
    await user.type(screen.getByLabelText('Correo'), 'nueva@xcaret.local')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    expect(await screen.findByText('Invitación enviada a:')).toBeInTheDocument()
    // La lista se refresca con la cuenta nueva: el correo también aparece en su fila.
    expect(screen.getByText('nueva@xcaret.local', { selector: 'p' })).toBeInTheDocument()
  })

  it('editar una cuenta del hotel bloquea hotel, rol y correo', async () => {
    const user = userEvent.setup()
    renderUsers('/usuarios?ambito=hoteles')

    await user.click(await screen.findByText('Aldo Castillo'))
    expect((await screen.findAllByText('Editar cuenta del hotel'))[0]).toBeInTheDocument()
    expect(screen.getByLabelText('Correo')).toBeDisabled()
    expect(screen.getByRole('combobox', { name: 'Hotel' })).toBeDisabled()
    expect(screen.getByRole('combobox', { name: 'Rol' })).toBeDisabled()
    // Aldo no ha entrado: se puede reenviar la invitación.
    expect(screen.getByRole('button', { name: 'Reenviar invitación' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Activo' })).toBeInTheDocument()
  })
})
