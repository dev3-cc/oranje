import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { ProposalEditorPage } from './ProposalEditorPage'

import { store } from '@/app/store'

async function renderEditor(prospectId: string): Promise<void> {
  const router = createMemoryRouter(
    [{ path: '/pipeline/:prospectId/proposal', element: <ProposalEditorPage /> }],
    { initialEntries: [`/pipeline/${prospectId}/proposal`] },
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

    /* Título y Descripción se retiraron (2026-10-19): el machote aprobado no
       los trae y el back nunca los exigió para enviar. El encabezado siempre
       es el genérico. */
    expect(await screen.findByText('Propuesta · Hotel Mirador')).toBeInTheDocument()
    expect(
      screen.getByText(/Versión 3 · borrador · sent_at es NULL hasta enviarla/),
    ).toBeInTheDocument()

    /* El cuadro por puesto llega al formulario: un renglón por puesto, con su
       pay y su bill. El fixture de Mirador trae Housekeeper y Cocinero. */
    expect(screen.getAllByLabelText('Pay rate')[0]).toHaveValue(185)
    expect(screen.getAllByLabelText('Bill rate')[0]).toHaveValue(265)
    expect(screen.getAllByLabelText('Pay rate')).toHaveLength(2)

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

    const billRate = (await screen.findAllByLabelText('Bill rate'))[0]
    await userEvent.clear(billRate!)
    await userEvent.type(billRate!, '100')

    /* Junto al campo y en la lista de faltantes. */
    expect(await screen.findAllByText(/por debajo del pay rate/)).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Enviar propuesta' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Guardar borrador' })).toBeDisabled()
  })

  /* Hugo, 2026-10-23: «ya llené los campos y no me deja enviar» — faltaba una
     tarifa y nada lo decía. Un botón apagado dice por qué, en rojo. */
  it('con algo faltante, dice qué falta en vez de solo apagar los botones', async () => {
    await renderEditor('psp-0008')

    const billRate = (await screen.findAllByLabelText('Bill rate'))[0]
    await userEvent.clear(billRate!)

    const aviso = (await screen.findByText('Antes de guardar o enviar:')).closest(
      '[role="status"]',
    ) as HTMLElement
    expect(within(aviso).getByText('Falta el bill rate de un puesto')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar propuesta' })).toBeDisabled()
  })

  it('nombra los campos que faltan y el aviso se va al llenarlos', async () => {
    await renderEditor('psp-0008')

    /* Mirador no trae ciudad ni contacto en el mock: justo el caso de Hugo. */
    const aviso = (await screen.findByText('Antes de guardar o enviar:')).closest(
      '[role="status"]',
    ) as HTMLElement
    expect(within(aviso).getByText('Dinos la ciudad y el estado del hotel')).toBeInTheDocument()
    expect(within(aviso).getByText('Dinos a quién va dirigida la propuesta')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Ciudad y estado'), 'Cancún, QR')
    await userEvent.type(screen.getByLabelText('Dirigida a'), 'Laura Pérez')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Enviar propuesta' })).toBeEnabled()
    })
    expect(screen.queryByText('Antes de guardar o enviar:')).not.toBeInTheDocument()
  })

  it('la tarjeta de una versión enviada abre su detalle, y de ahí el contrato con las tarifas de ESA versión', async () => {
    await renderEditor('psp-0008')

    await userEvent.click(
      await screen.findByRole('button', { name: 'Ver el detalle de la Propuesta v1, enviada' }),
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Contrato enviado' }))

    const dialog = await screen.findByRole('dialog', { name: 'Vista previa del contrato' })
    // v1 se envió con Housekeeper a 170 / 250 — solo el bill rate ($250) le
    // llega al hotel; el pay rate ($170) es margen interno de Oranje.
    expect(within(dialog).getByText('$250.00')).toBeInTheDocument()
    expect(within(dialog).queryByText('$170.00')).not.toBeInTheDocument()

    // El acuerdo completo, con su clausulado y su Exhibit «A».
    expect(within(dialog).getByText('Service Agreement')).toBeInTheDocument()
    expect(within(dialog).getByText('Exhibit “A” - Rates')).toBeInTheDocument()
  })

  it('la versión nueva arranca con las tarifas de la anterior', async () => {
    await renderEditor('psp-0011')

    await userEvent.click(await screen.findByRole('button', { name: 'Abrir versión nueva' }))

    // Villas Coral tenía v1 enviada con Housekeeper a 172 / 250.
    expect((await screen.findAllByLabelText('Pay rate'))[0]).toHaveValue(172)
    expect(screen.getAllByLabelText('Bill rate')[0]).toHaveValue(250)
    expect(
      screen.getByText(/Versión 2 · borrador · sent_at es NULL hasta enviarla/),
    ).toBeInTheDocument()
  })

  it('marcar como enviada guarda lo editado primero: no se pierde al congelar la versión', async () => {
    await renderEditor('psp-0008')

    const propertyNameInput = await screen.findByLabelText('Nombre de la propiedad')
    await userEvent.clear(propertyNameInput)
    await userEvent.type(propertyNameInput, 'Hotel Mirador Renovado')

    /* Mirador no trae dirección ni contacto en el workspace (mock): sin esto
       el formulario queda inválido y "Enviar propuesta" sigue deshabilitado,
       sin relación con lo que este test cubre. */
    await userEvent.type(screen.getByLabelText('Ciudad y estado'), 'Cancún, QR')
    await userEvent.type(screen.getByLabelText('Dirigida a'), 'Laura Pérez')

    await userEvent.click(await screen.findByRole('button', { name: 'Enviar propuesta' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Marcar como enviada' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Sí, marcar como enviada' }))

    // v3 (la que era borrador) ahora aparece enviada, con lo que se editó justo antes.
    // Dos mutaciones encadenadas (guardar + marcar) más el refetch: más margen que el resto.
    await userEvent.click(
      await screen.findByRole(
        'button',
        { name: 'Ver el detalle de la Propuesta v3, enviada' },
        { timeout: 10000 },
      ),
    )
    expect(await screen.findByDisplayValue('Hotel Mirador Renovado')).toBeInTheDocument()
  }, 15000)
})
