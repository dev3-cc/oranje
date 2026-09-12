import { describe, expect, it } from 'vitest'

import { buildPunchQrLink, readPunchQrCode } from './punchQrLink'

describe('el QR del acceso es una liga a Ponchar con el código adentro', () => {
  it('arma la liga con el dominio del ambiente y el código escapado', () => {
    expect(buildPunchQrLink('hotel-1|s3cr3t/+=', 'https://staging.oranjepeople.com')).toBe(
      'https://staging.oranjepeople.com/colaborador/ponchar?qr=hotel-1%7Cs3cr3t%2F%2B%3D',
    )
  })

  it('el lector saca el código de la liga, y una hoja vieja con el código pelón sigue valiendo', () => {
    expect(
      readPunchQrCode('https://staging.oranjepeople.com/colaborador/ponchar?qr=hotel-1%7Cs3cr3t'),
    ).toBe('hotel-1|s3cr3t')
    expect(readPunchQrCode('hotel-1|s3cr3t')).toBe('hotel-1|s3cr3t')
    expect(readPunchQrCode('https://otro.sitio/sin-parametro')).toBe(
      'https://otro.sitio/sin-parametro',
    )
  })
})
