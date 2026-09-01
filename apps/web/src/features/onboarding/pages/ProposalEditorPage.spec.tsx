import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { ProposalEditorPage } from './ProposalEditorPage'

import { store } from '@/app/store'

async function renderEditor(prospectId: string): Promise<void> {
  const router = createMemoryRouter(
    [{ path: '/pipeline/:prospectId/propuesta', element: <ProposalEditorPage /> }],
    { initialEntries: [`/pipeline/${prospectId}/propuesta`] },
  )

  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
  /* Sin storage en jsdom el intro es fail-open: sale siempre y se salta. */
  await userEvent.click(await screen.findByRole('button', { name: 'Saltar' }))
}

describe('ProposalEditorPage', () => {
  it('carga el borrador abierto y su historial de versiones', async () => {
    await renderEditor('psp-0008')

    expect(await screen.findByText('Propuesta · Hotel Mirador')).toBeInTheDocument()
    expect(
      screen.getByText(/Versión 3 · borrador · sent_at es NULL hasta enviarla/),
    ).toBeInTheDocument()

    // Las tarifas del borrador llegan al formulario.
    expect(screen.getByLabelText('Pay rate')).toHaveValue(185)
    expect(screen.getByLabelText('Bill rate')).toHaveValue(265)

    // El historial conserva las tres versiones; las enviadas no se borran.
    expect(screen.getByText('Propuesta v3')).toBeInTheDocument()
    expect(screen.getByText('Propuesta v2')).toBeInTheDocument()
    expect(screen.getByText('Propuesta v1')).toBeInTheDocument()
    expect(screen.getByText('Borrador')).toBeInTheDocument()
  })

  it('sin borrador abierto no deja editar y ofrece abrir una versión nueva', async () => {
    await renderEditor('psp-0007')

    // Sin borrador, el panel enseña la última ENVIADA en solo lectura.
    expect(await screen.findByText(/Última enviada · v/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Pay rate')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Enviar propuesta/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir versión nueva' })).toBeInTheDocument()
  })

  it('no deja facturar por debajo de lo que se paga', async () => {
    await renderEditor('psp-0008')

    const billRate = await screen.findByLabelText('Bill rate')
    await userEvent.clear(billRate)
    await userEvent.type(billRate, '100')

    expect(await screen.findByText(/mayor que el pay rate/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar propuesta' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Guardar borrador' })).toBeDisabled()
  })

  it('el icono de PDF abre el contrato con las tarifas de ESA versión', async () => {
    await renderEditor('psp-0008')

    await userEvent.click(
      await screen.findByRole('button', { name: 'Vista previa del contrato de la Propuesta v1' }),
    )

    const dialog = await screen.findByRole('dialog')
    // v1 se envió con pay 170 / bill 250: margen de 80, el 32 % del bill.
    expect(within(dialog).getByText('$170.00')).toBeInTheDocument()
    expect(within(dialog).getByText('$250.00')).toBeInTheDocument()
    expect(within(dialog).getByText('$80.00 · 32.0%')).toBeInTheDocument()

    // El aviso viaja dentro del documento, así que también se imprime.
    expect(within(dialog).getByText(/SIN VALIDEZ LEGAL/)).toBeInTheDocument()
  })

  it('la versión nueva arranca con las tarifas de la anterior', async () => {
    await renderEditor('psp-0011')

    await userEvent.click(await screen.findByRole('button', { name: 'Abrir versión nueva' }))

    // Villas Coral tenía v1 enviada con pay 172 / bill 250.
    expect(await screen.findByLabelText('Pay rate')).toHaveValue(172)
    expect(screen.getByLabelText('Bill rate')).toHaveValue(250)
    expect(
      screen.getByText(/Versión 2 · borrador · sent_at es NULL hasta enviarla/),
    ).toBeInTheDocument()
  })
})
