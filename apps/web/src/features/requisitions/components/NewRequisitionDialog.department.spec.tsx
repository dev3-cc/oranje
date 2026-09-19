import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it, vi } from 'vitest'

import { NewRequisitionDialog } from './NewRequisitionDialog'

import { store } from '@/app/store'

/* Referencia estable, como la que devuelve RTK Query: un objeto nuevo por
   render dispararía el reset del diálogo en cada pintado. */
const SUPERVISOR_SESSION = {
  data: {
    id: 'u-sup',
    email: 'sup@casacurtidor.com',
    name: 'Supervisora',
    shortName: 'Supervisora',
    roleId: 'ROL-H-03',
    photoUrl: null,
    roleCode: 'SUP',
    roleTitle: 'Supervisor',
    hotel: { id: 'hotel-1', name: 'Hotel Puerto Real' },
    department: { id: 'dep-hk', name: 'Housekeeping' },
    locale: 'es',
    permissions: [],
  },
}

vi.mock('@/app/sessionApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/sessionApi')>()
  return { ...actual, useGetSessionQuery: () => SUPERVISOR_SESSION }
})

/** El calendario abre en el mes en curso (septiembre de 2026 en las pruebas). */
async function pickDay(
  user: ReturnType<typeof userEvent.setup>,
  triggerLabel: string,
  dayName: RegExp,
): Promise<void> {
  await user.click(screen.getByRole('button', { name: triggerLabel }))
  await user.click(await screen.findByRole('button', { name: dayName }))
}

async function pick(
  user: ReturnType<typeof userEvent.setup>,
  triggerLabel: string,
  optionName: string,
): Promise<void> {
  await user.click(screen.getByLabelText(triggerLabel))
  await user.click(await screen.findByRole('option', { name: optionName }))
}

describe('NewRequisitionDialog con el departamento fijado por la sesión', () => {
  it('el departamento del paso 1 baja a las posiciones, también al reabrir', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <Provider store={store}>
        <NewRequisitionDialog isOpen onClose={vi.fn()} />
      </Provider>,
    )
    await user.click(await screen.findByRole('button', { name: 'Saltar' }))

    // Se cierra y se vuelve a abrir: el segundo pedido del día.
    rerender(
      <Provider store={store}>
        <NewRequisitionDialog isOpen={false} onClose={vi.fn()} />
      </Provider>,
    )
    rerender(
      <Provider store={store}>
        <NewRequisitionDialog isOpen onClose={vi.fn()} />
      </Provider>,
    )

    expect(await screen.findByDisplayValue('Housekeeping')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await screen.findByText('Posiciones solicitadas')

    await pick(user, 'Posición 1', 'Housekeeper')
    await pick(user, 'Modalidad 1', 'Tiempo completo')
    await pickDay(user, 'Inicio 1', /18 de septiembre/)
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(await screen.findByText(/Nace en Borrador/)).toBeInTheDocument()
    expect(screen.queryByText('Falta el departamento')).not.toBeInTheDocument()
    /* Dos aperturas completas del diálogo: con la suite entera corriendo se
       acerca al tope de 5 s por prueba. */
  }, 15_000)
})
