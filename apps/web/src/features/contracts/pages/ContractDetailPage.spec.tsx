import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { ContractDetailPage } from './ContractDetailPage'

import { store } from '@/app/store'

function renderDetail(contractId = 'ct-0184'): void {
  const router = createMemoryRouter(
    [{ path: '/contracts/:contractId', element: <ContractDetailPage /> }],
    { initialEntries: [`/contracts/${contractId}`] },
  )

  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
}

describe('ContractDetailPage', () => {
  it('encabeza con el contrato, su estado y quién lo firmó', async () => {
    renderDetail()

    expect(
      await screen.findByRole('heading', { name: 'Contrato CT-2026-0184' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('commercial.contract · Hotel Puerto Real · firmado el 20 jun 2026'),
    ).toBeInTheDocument()
  })

  it('traduce la semana de nómina y enseña los números que la guardan', async () => {
    renderDetail()

    // Domingo es 0, así que la semana termina en un número menor que el que la
    // empieza: por eso se muestran también los crudos.
    expect(await screen.findByText('Lunes → Domingo')).toBeInTheDocument()
    expect(screen.getByText('week_start_day 1 · week_end_day 0')).toBeInTheDocument()
  })

  it('el margen se calcula: es una resta dentro de la misma respuesta', async () => {
    renderDetail()

    // 2.00 − 1.50 y 2.50 − 2.00, ambos +0.50.
    expect(await screen.findAllByText('+0.50')).toHaveLength(2)

    // 250 − 170 = 80, y así con las cuatro posiciones. Se acota a la tarjeta
    // «Tarifas por posición»: el documento de la derecha también dice
    // «Housekeeper» (ahora en vivo, con solo el bill rate — el margen no es
    // texto suyo, así que $80.00 solo puede salir de la tabla). */
    const rateCard = screen
      .getByRole('heading', { name: 'Tarifas por posición' })
      .closest('section')
    const housekeeper = within(rateCard as HTMLElement)
      .getByText('Housekeeper')
      .closest('tr')
    expect(within(housekeeper as HTMLElement).getByText('$80.00')).toBeInTheDocument()
    expect(within(rateCard as HTMLElement).getByText('$120.00')).toBeInTheDocument()
  })

  it('un contrato sin fin dice indefinido, no una fecha vacía', async () => {
    renderDetail('ct-0203')

    expect(await screen.findByText('Indefinido')).toBeInTheDocument()
    expect(screen.getByText(/Todavía no se cotiza ninguna posición/)).toBeInTheDocument()
  })

  // Hugo, 2026-10-16: editar deja de ser solo de Borrador — un contrato
  // ACTIVO también se sigue cotizando y ajustando.
  it('un contrato ACTIVO también se puede editar: «Editar tarifas» ya no es solo de Borrador', async () => {
    renderDetail('ct-0184')

    await screen.findByRole('heading', { name: 'Contrato CT-2026-0184' })
    expect(screen.getByRole('button', { name: 'Editar tarifas' })).toBeInTheDocument()
  })

  // Hugo, 2026-10-20: el modal «Editar contrato» se retiró — cada tarjeta
  // tiene su propio lápiz y alterna entre mostrar el dato y mostrar su input
  // en el mismo espacio, sin diálogo.
  it('el lápiz de «Datos del documento» abre sus inputs en el mismo espacio, sin modal', async () => {
    renderDetail('ct-0184')
    const user = userEvent.setup()

    await screen.findByRole('heading', { name: 'Contrato CT-2026-0184' })
    expect(screen.queryByLabelText('Nombre de la propiedad')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Editar datos del documento' }))

    expect(screen.getByLabelText('Nombre de la propiedad')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Cancelar edición de datos del documento' }),
    )
    expect(screen.queryByLabelText('Nombre de la propiedad')).not.toBeInTheDocument()
  })

  it('el lápiz de «Vigencia» solo vuelve editable la fecha de fin, no todo el bloque', async () => {
    renderDetail('ct-0184')
    const user = userEvent.setup()

    await screen.findByRole('heading', { name: 'Contrato CT-2026-0184' })
    expect(screen.queryByLabelText('Hasta')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Editar vigencia' }))

    expect(screen.getByLabelText('Hasta')).toBeInTheDocument()
    // Desde, Semana y Número no se editan aquí: siguen de solo lectura.
    expect(screen.getByText('Lunes → Domingo')).toBeInTheDocument()
  })

  it('editar multiplicadores enseña los inputs y las condiciones, y guarda', async () => {
    renderDetail('ct-0184')
    const user = userEvent.setup()

    await screen.findByRole('heading', { name: 'Contrato CT-2026-0184' })
    const multiplierCard = screen
      .getByRole('heading', { name: 'Multiplicadores' })
      .closest('section') as HTMLElement
    expect(within(multiplierCard).getByText('No se descuenta')).toBeInTheDocument()

    await user.click(within(multiplierCard).getByRole('button', { name: 'Editar multiplicadores' }))

    const overtimeBill = screen.getByLabelText('Multiplicador de overtime facturado')
    await user.clear(overtimeBill)
    await user.type(overtimeBill, '2.25')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await within(multiplierCard).findByText('2.25 ×')).toBeInTheDocument()
    expect(screen.queryByLabelText('Multiplicador de overtime facturado')).not.toBeInTheDocument()
  })

  // Hugo, 2026-10-21: "te pedi que fuera input ese campo y ya no un check"
  // — el monto de comida es editable de verdad, ya no un sí/no con "3 USD"
  // fijo en el texto. Luego pidió regresar la casilla PERO junto al input:
  // la casilla prende/apaga, el input es el monto mientras está prendida.
  it('comida: la casilla prende el input, y arranca en 3.00 si no había monto', async () => {
    renderDetail('ct-0184')
    const user = userEvent.setup()

    await screen.findByRole('heading', { name: 'Contrato CT-2026-0184' })
    const multiplierCard = screen
      .getByRole('heading', { name: 'Multiplicadores' })
      .closest('section') as HTMLElement
    expect(within(multiplierCard).getByText('No se descuenta')).toBeInTheDocument()

    await user.click(within(multiplierCard).getByRole('button', { name: 'Editar multiplicadores' }))

    const mealAmount = screen.getByLabelText('Monto de comida por día laborado')
    expect(mealAmount).toBeDisabled()

    await user.click(screen.getByRole('checkbox', { name: 'Deduce comida' }))

    expect(mealAmount).toBeEnabled()
    expect(mealAmount).toHaveValue('3.00')

    await user.clear(mealAmount)
    await user.type(mealAmount, '3.50')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(
      await within(multiplierCard).findByText('Se descuenta, 3.50 USD por día laborado'),
    ).toBeInTheDocument()
  })

  // Hugo, 2026-10-21: el candado se cuelga del status — un ACTIVO nace
  // bloqueado. ct-0151 es el fixture que se queda así (ct-0184 se desbloqueó
  // a propósito, es el que usan las pruebas de arriba).
  describe('el candado del contrato ACTIVO', () => {
    it('nace bloqueado: sin lápices, sin «Editar tarifas», con «Desbloquear»', async () => {
      renderDetail('ct-0151')

      await screen.findByRole('heading', { name: 'Contrato CT-2026-0151' })
      expect(screen.getByText('Bloqueado')).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Editar datos del documento' }),
      ).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Editar vigencia' })).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Editar multiplicadores' }),
      ).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Editar tarifas' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Desbloquear' })).toBeInTheDocument()
    })

    it('desbloquear pide motivo y, ya desbloqueado, vuelven los lápices', async () => {
      const user = userEvent.setup()
      renderDetail('ct-0151')

      await screen.findByRole('heading', { name: 'Contrato CT-2026-0151' })
      await user.click(screen.getByRole('button', { name: 'Desbloquear' }))

      expect(
        await screen.findByRole('heading', { name: 'Desbloquear contrato' }),
      ).toBeInTheDocument()
      // Radix oculta el resto de la página (aria-hidden) mientras el diálogo
      // está abierto: el botón del encabezado deja de contar, y este query
      // ve solo el del diálogo.
      expect(screen.getByRole('button', { name: 'Desbloquear' })).toBeDisabled()
      await user.type(screen.getByLabelText('Motivo'), 'El hotel pidió corregir su dirección')
      await user.click(screen.getByRole('button', { name: 'Desbloquear' }))

      expect(await screen.findByText('Desbloqueado')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Editar datos del documento' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Bloquear' })).toBeInTheDocument()
    })
  })

  // Hugo, 2026-10-21: "no puede haber contrato sin propuesta" — el
  // hipervínculo a la versión exacta de la que nació. ct-0098 es el único
  // fixture con propuesta (los demás prueban el estado sin ella).
  describe('la propuesta de origen', () => {
    it('con propuesta: hipervínculo a su versión exacta', async () => {
      renderDetail('ct-0098')

      await screen.findByRole('heading', { name: 'Contrato CT-2026-0098' })
      const link = screen.getByRole('link', { name: 'Propuesta v3' })
      expect(link).toHaveAttribute('href', '/proposals/prospect-0098/3')
    })

    it('sin propuesta: texto plano, no un enlace roto', async () => {
      renderDetail('ct-0184')

      await screen.findByRole('heading', { name: 'Contrato CT-2026-0184' })
      expect(screen.getByText(/sin propuesta de origen/)).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /Propuesta v/ })).not.toBeInTheDocument()
    })
  })
})
