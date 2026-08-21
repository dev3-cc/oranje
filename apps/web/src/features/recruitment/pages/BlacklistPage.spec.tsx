import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it } from 'vitest'

import { BlacklistPage } from './BlacklistPage'

import { store } from '@/app/store'

/** Latencia del mock: el margen por omisión se queda corto al filtrar. */
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
    // El levantado no está: el filtro por omisión es «vigentes».
    expect(screen.queryByText('Pedro Quiroz')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Estado'), 'ALL')

    expect(await screen.findByText('Pedro Quiroz', undefined, SLOW)).toBeInTheDocument()
    expect(screen.getByText('Levantada')).toBeInTheDocument()
  })

  it('un veto no manual no exige evidencia: raya, no hueco', async () => {
    const user = userEvent.setup()
    renderBlacklist()

    await screen.findByText('Carlos Beltrán')
    await user.selectOptions(screen.getByLabelText('Estado'), 'ALL')

    const row = (await screen.findByText('Pedro Quiroz', undefined, SLOW)).closest('tr')
    const scoped = within(row as HTMLElement)
    expect(scoped.getByText('ABSENCES')).toBeInTheDocument()
    expect(scoped.getByText('—')).toBeInTheDocument()
  })

  it('vetar exige persona, motivo y evidencia, y explica las reglas del motor', async () => {
    const user = userEvent.setup()
    renderBlacklist()

    await user.click(await screen.findByRole('button', { name: '+ Agregar a Blacklist' }))

    const dialog = await screen.findByRole('dialog')
    const scoped = within(dialog)
    const submit = scoped.getByRole('button', { name: 'Vetar colaborador' })
    expect(submit).toBeDisabled()

    // Elegir a alguien pinta su situación; el GRIS protege.
    await user.selectOptions(
      await scoped.findByRole('combobox'),
      scoped.getByRole('option', { name: 'Rogelio Santos' }),
    )
    expect(
      await scoped.findByText('El GRIS protege: un colaborador accidentado no se puede vetar.'),
    ).toBeInTheDocument()
    expect(submit).toBeDisabled()

    // Con alguien vetable, motivo y evidencia lo habilitan.
    await user.selectOptions(
      scoped.getByRole('combobox'),
      scoped.getByRole('option', { name: 'Ana Rivera Gómez' }),
    )
    await user.type(scoped.getByPlaceholderText(/Abandonó el turno/), 'Faltas reiteradas')
    await user.type(scoped.getByPlaceholderText('evidencia-turnos.pdf'), 'acta.pdf')
    expect(submit).toBeEnabled()

    await user.click(submit)

    // El veto entra vigente y aparece en el listado.
    expect(await screen.findByText('Ana Rivera Gómez', undefined, SLOW)).toBeInTheDocument()
  })

  it('levantar exige motivo y deja la fila como levantada, no la borra', async () => {
    const user = userEvent.setup()
    renderBlacklist()

    const row = (await screen.findByText('Norma Estrada')).closest('tr')
    await user.click(within(row as HTMLElement).getByRole('button', { name: 'Levantar' }))

    const dialog = await screen.findByRole('dialog')
    const scoped = within(dialog)
    expect(scoped.getByText('Documentación falsificada en el alta')).toBeInTheDocument()
    expect(scoped.getByText(/vuelve a/)).toBeInTheDocument()

    const lift = scoped.getByRole('button', { name: 'Levantar el veto' })
    expect(lift).toBeDisabled()

    await user.type(scoped.getByRole('textbox'), 'Acuerdo con el hotel')
    await user.click(lift)

    // Sale de vigentes…
    await waitFor(() => {
      expect(screen.queryByText('Norma Estrada')).not.toBeInTheDocument()
    }, SLOW)

    // …pero la fila sigue en el historial, marcada como levantada.
    await user.selectOptions(screen.getByLabelText('Estado'), 'ALL')
    expect(await screen.findByText('Norma Estrada', undefined, SLOW)).toBeInTheDocument()
  })
})
