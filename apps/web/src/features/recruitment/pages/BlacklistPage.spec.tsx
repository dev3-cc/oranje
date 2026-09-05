import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it } from 'vitest'

import { BlacklistPage } from './BlacklistPage'

import { store } from '@/app/store'

const SLOW = { timeout: 4000 }

function renderBlacklist(): void {
  render(
    <Provider store={store}>
      <BlacklistPage />
    </Provider>,
  )
}

describe('BlacklistPage', () => {
  it('arranca en vigentes y el historial se pide a propósito', async () => {
    const user = userEvent.setup()
    renderBlacklist()

    expect(await screen.findByText('Carlos Beltrán')).toBeInTheDocument()
    expect(screen.getByText('Norma Estrada')).toBeInTheDocument()
    expect(screen.queryByText('Pedro Quiroz')).not.toBeInTheDocument()

    await user.click(screen.getByLabelText('Estado'))
    await user.click(await screen.findByRole('option', { name: 'Estado: historial completo' }))

    expect(await screen.findByText('Pedro Quiroz', undefined, SLOW)).toBeInTheDocument()
    expect(screen.getByText('Levantada')).toBeInTheDocument()
  })

  it('buscar por nombre filtra lo que ya llegó, sin acentos; «Quitar filtros» vuelve al arranque', async () => {
    const user = userEvent.setup()
    renderBlacklist()
    await screen.findByText('Carlos Beltrán')

    const search = screen.getByLabelText('Buscar colaborador')
    await user.type(search, 'beltran')
    expect(screen.getByText('Carlos Beltrán')).toBeInTheDocument()
    expect(screen.queryByText('Norma Estrada')).not.toBeInTheDocument()

    await user.type(search, 'x')
    expect(screen.getByText(/Ningún veto es de alguien llamado «beltranx»/)).toBeInTheDocument()

    // «Vigentes» es el arranque, no un filtro: solo cuenta la búsqueda, y
    // quitar filtros regresa a vigentes (el historial sigue pidiéndose a propósito).
    const reset = screen.getByRole('button', { name: /Quitar filtros/ })
    expect(reset).toHaveTextContent('1')
    await user.click(reset)
    expect(search).toHaveValue('')
    expect(await screen.findByText('Norma Estrada', undefined, SLOW)).toBeInTheDocument()
    expect(screen.getByText('Carlos Beltrán')).toBeInTheDocument()
    expect(screen.queryByText('Pedro Quiroz')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Quitar filtros/ })).not.toBeInTheDocument()
  })

  it('un veto no manual no exige evidencia: raya, no hueco', async () => {
    const user = userEvent.setup()
    renderBlacklist()

    await screen.findByText('Carlos Beltrán')
    await user.click(screen.getByLabelText('Estado'))
    await user.click(await screen.findByRole('option', { name: 'Estado: historial completo' }))

    const row = (await screen.findByText('Pedro Quiroz', undefined, SLOW)).closest('tr')
    const scoped = within(row as HTMLElement)
    expect(scoped.getByText('ABSENCES')).toBeInTheDocument()
    expect(scoped.getByText('—')).toBeInTheDocument()
  })

  it('vetar exige persona, motivo y evidencia, y explica las reglas del motor', async () => {
    const user = userEvent.setup()
    renderBlacklist()

    await user.click(await screen.findByRole('button', { name: 'Agregar a Blacklist' }))
    await user.click(await screen.findByRole('button', { name: 'Saltar' }))

    const dialog = await screen.findByRole('dialog')
    const scoped = within(dialog)
    const submit = scoped.getByRole('button', { name: 'Vetar colaborador' })
    expect(submit).toBeDisabled()

    await user.click(await scoped.findByLabelText('Colaborador'))
    await user.click(await screen.findByRole('option', { name: 'Rogelio Santos' }))
    expect(
      await scoped.findByText('El GRIS protege: un colaborador accidentado no se puede vetar.'),
    ).toBeInTheDocument()
    expect(submit).toBeDisabled()

    await user.click(scoped.getByLabelText('Colaborador'))
    await user.click(await screen.findByRole('option', { name: 'Ana Rivera Gómez' }))
    await user.type(scoped.getByPlaceholderText(/Abandonó el turno/), 'Faltas reiteradas')
    await user.type(scoped.getByPlaceholderText('evidencia-turnos.pdf'), 'acta.pdf')
    expect(submit).toBeEnabled()

    await user.click(submit)

    expect(await screen.findByText('Ana Rivera Gómez', undefined, SLOW)).toBeInTheDocument()
  })

  it('levantar exige motivo y deja la fila como levantada, no la borra', async () => {
    const user = userEvent.setup()
    renderBlacklist()

    const row = (await screen.findByText('Norma Estrada')).closest('tr')
    await user.click(within(row as HTMLElement).getByRole('button', { name: 'Levantar veto' }))
    await user.click(await screen.findByRole('button', { name: 'Saltar' }))

    const dialog = await screen.findByRole('dialog')
    const scoped = within(dialog)
    expect(scoped.getByText('Documentación falsificada en el alta')).toBeInTheDocument()
    expect(scoped.getByText(/vuelve a/)).toBeInTheDocument()

    const lift = scoped.getByRole('button', { name: 'Levantar el veto' })
    expect(lift).toBeDisabled()

    await user.type(scoped.getByRole('textbox'), 'Acuerdo con el hotel')
    await user.click(lift)

    await waitFor(() => {
      expect(screen.queryByText('Norma Estrada')).not.toBeInTheDocument()
    }, SLOW)

    await user.click(screen.getByLabelText('Estado'))
    await user.click(await screen.findByRole('option', { name: 'Estado: historial completo' }))
    expect(await screen.findByText('Norma Estrada', undefined, SLOW)).toBeInTheDocument()
  })
})
