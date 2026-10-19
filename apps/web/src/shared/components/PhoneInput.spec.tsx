import { I18nProvider } from '@lingui/react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'

import { isCompletePhone, PhoneInput } from './PhoneInput'

import { i18n } from '@/app/i18n'

const SLOW = { timeout: 4000 }

/**
 * Lo que este campo tiene que impedir está medido en producción: de 317
 * colaboradores, **273 quedaron sin lada** y uno se guardó como
 * `+1 +1 (943) 265-1530` — alguien pegó un número que ya la traía y la volvió
 * a escribir.
 *
 * Por eso la lada no se teclea: se elige. Y lo que se guarda es **E.164**
 * (`+16785551234`), que es el único formato que dice de qué país es el número
 * sin tener que adivinarlo después.
 */
function Anfitriona({
  inicial = '',
  defaultCountry,
}: {
  inicial?: string
  defaultCountry?: 'US' | 'MX'
}): ReactNode {
  const [valor, setValor] = useState(inicial)

  return (
    <I18nProvider i18n={i18n}>
      <PhoneInput
        value={valor}
        onChange={setValor}
        ariaLabel="Teléfono"
        {...(defaultCountry ? { defaultCountry } : {})}
      />
      <output data-testid="guardado">{valor}</output>
    </I18nProvider>
  )
}

const guardado = (): string => screen.getByTestId('guardado').textContent ?? ''

describe('el teléfono con selector de país', () => {
  it('guarda en E.164 aunque la persona solo escriba sus dígitos', async () => {
    render(<Anfitriona />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Teléfono'), '6785551234')

    /* La lada la puso el selector, no la persona. */
    expect(guardado()).toBe('+16785551234')
  })

  it('no repite la lada en el campo: esa ya está en el selector', async () => {
    render(<Anfitriona inicial="+16785551234" />)

    /* El selector enseña +1; el campo, el número nacional y nada más. */
    expect(await screen.findByText('+1', undefined, SLOW)).toBeVisible()
    expect(screen.getByLabelText('Teléfono')).toHaveValue('(678) 555-1234')
  })

  it('un número que ya trae otro país abre en ese país, no en el propuesto', async () => {
    /* El hotel es de Georgia, pero el expediente dice +52: manda el dato. */
    render(<Anfitriona inicial="+529981234567" defaultCountry="US" />)

    expect(await screen.findByText('+52', undefined, SLOW)).toBeVisible()
  })

  /* Abrir la lista monta 245 países; en jsdom eso pasa de los 5 s por
     defecto. En el navegador es instantáneo — lo lento es el DOM simulado. */
  it('cambiar de país reinterpreta lo escrito, no lo borra', { timeout: 20_000 }, async () => {
    render(<Anfitriona />)
    const user = userEvent.setup()

    /* Un número válido en los DOS países: el campo no puede deducirlo solo,
       así que se queda con Estados Unidos y elegir a mano es lo único que lo
       cambia. */
    await user.type(screen.getByLabelText('Teléfono'), '4709065411')
    expect(guardado()).toBe('+14709065411')

    await user.click(screen.getByLabelText('País'))
    await user.click(await screen.findByRole('button', { name: /México/i }, SLOW))

    /* Los mismos dígitos, ahora leídos como mexicanos. */
    expect(guardado()).toBe('+524709065411')
  })

  it('el buscador encuentra por nombre, sin acentos y por lada', { timeout: 20_000 }, async () => {
    render(<Anfitriona />)
    const user = userEvent.setup()

    await user.click(screen.getByLabelText('País'))
    const buscador = await screen.findByLabelText('Busca el país', undefined, SLOW)

    /* Sin tilde: nadie escribe «Perú» con acento en un buscador. */
    await user.type(buscador, 'peru')
    expect(await screen.findByRole('button', { name: /Perú/i }, SLOW)).toBeVisible()
    expect(screen.queryByRole('button', { name: /Albania/i })).not.toBeInTheDocument()

    /* Y por lada, para quien se sabe el +52 de memoria. */
    await user.clear(buscador)
    await user.type(buscador, '+52')
    expect(await screen.findByRole('button', { name: /México/i }, SLOW)).toBeVisible()
  })

  it('con Enter se queda el primero de la búsqueda', { timeout: 20_000 }, async () => {
    render(<Anfitriona />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Teléfono'), '9981234567')
    await user.click(screen.getByLabelText('País'))
    await user.type(await screen.findByLabelText('Busca el país', undefined, SLOW), 'mexico{Enter}')

    expect(guardado()).toBe('+529981234567')
  })

  it('un número a medias no se guarda como E.164', async () => {
    render(<Anfitriona />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Teléfono'), '678')

    /* Guardar `+1678` sería guardar un número que no existe. */
    expect(guardado()).not.toMatch(/^\+1\d{3}$/)
    expect(isCompletePhone(guardado())).toBe(false)
  })

  it('isCompletePhone exige un número real, no una cantidad de dígitos', () => {
    expect(isCompletePhone('+16785551234')).toBe(true)
    /* 9 dígitos donde Estados Unidos usa 10: exactamente el `+1 678922332`
       que hoy está guardado en producción. */
    expect(isCompletePhone('+1678922332')).toBe(false)
    expect(isCompletePhone('')).toBe(false)
  })
})

describe('el país se deduce cuando el número lo dice', () => {
  it('un número de Cancún escrito sin lada se reconoce como mexicano', async () => {
    render(<Anfitriona defaultCountry="US" />)
    const user = userEvent.setup()

    /* 998 no es una lada asignada en Estados Unidos, así que este número no
       puede ser de ahí: la deducción no adivina, descarta. */
    await user.type(screen.getByLabelText('Teléfono'), '9983004532')

    expect(guardado()).toBe('+529983004532')
    expect(await screen.findByText('+52', undefined, SLOW)).toBeVisible()
  })

  it('pegar con lada manda: el país sale del propio número', async () => {
    render(<Anfitriona defaultCountry="US" />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Teléfono'), '+529983004532')

    expect(guardado()).toBe('+529983004532')
  })

  it('un número válido en los dos países NO cambia el país solo', async () => {
    render(<Anfitriona defaultCountry="US" />)
    const user = userEvent.setup()

    /* 470 es lada de Atlanta y el número también es válido como mexicano.
       Ahí cambiar el país sería inventarlo: se respeta el elegido. */
    await user.type(screen.getByLabelText('Teléfono'), '4709065411')

    expect(guardado()).toBe('+14709065411')
    expect(await screen.findByText('+1', undefined, SLOW)).toBeVisible()
  })
})

describe('la deducción no se acumula', () => {
  it('después de un número de Cancún, uno de Atlanta vuelve a +1', async () => {
    render(<Anfitriona defaultCountry="US" />)
    const user = userEvent.setup()
    const campo = screen.getByLabelText('Teléfono')

    await user.type(campo, '9983004532')
    expect(guardado()).toBe('+529983004532')

    /* Se corrige el número. El de Atlanta es válido en los DOS países, así
       que si la deducción partiera del México anterior se quedaría ahí y
       guardaría +52 — que es exactamente lo que pasaba. */
    await user.clear(campo)
    await user.type(campo, '6785551234')

    expect(guardado()).toBe('+16785551234')
  })

  it('corregir un dígito no cambia el país de golpe', async () => {
    render(<Anfitriona defaultCountry="US" />)
    const user = userEvent.setup()
    const campo = screen.getByLabelText('Teléfono')

    await user.type(campo, '6785551234')
    expect(guardado()).toBe('+16785551234')

    /* Borrar el último y volver a escribirlo deja todo igual. */
    await user.type(campo, '{Backspace}4')
    expect(guardado()).toBe('+16785551234')
  })

  it('lo elegido a mano sobrevive a seguir escribiendo', async () => {
    render(<Anfitriona defaultCountry="US" />)
    const user = userEvent.setup()

    await user.click(screen.getByLabelText('País'))
    await user.click(await screen.findByRole('button', { name: /México/i }, SLOW))
    await user.type(screen.getByLabelText('Teléfono'), '6785551234')

    /* Es válido en Estados Unidos, pero la persona dijo México. Manda ella. */
    expect(guardado()).toBe('+526785551234')
  })
})
