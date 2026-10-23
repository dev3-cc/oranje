import { i18n } from '@lingui/core'
import { describe, expect, it } from 'vitest'

import { punchErrorMessage } from './PunchPage'

/**
 * El día marcado (Descanso, OFF...) tiene que decir SU motivo real, no
 * "descansas" para cualquier cosa (Hugo, 2026-10-23: "que diga el estado
 * correcto cuando es por otra cosa"). REST tiene su propio texto, igual al
 * de Inicio sin turno; cualquier otro código usa el nombre que mandó el
 * servidor.
 */
function apiError(code: string, message: string, detailValue: string): unknown {
  return {
    data: {
      error: {
        code,
        message,
        details: [{ field: 'dayStatus', value: detailValue }],
      },
    },
  }
}

describe('punchErrorMessage · día marcado con un estado', () => {
  it('REST dice que descansa, como la pantalla de Inicio', () => {
    const message = punchErrorMessage(
      apiError('DAY_MARKED_STATUS', 'Hoy no ponchas: Descanso', 'REST'),
      i18n,
    )

    expect(message).toBe('Hoy descansas. No tienes turno programado hoy.')
  })

  it('OFF (o cualquier otro del catálogo) usa el nombre real que mandó el servidor', () => {
    const message = punchErrorMessage(
      apiError('DAY_MARKED_STATUS', 'Hoy no ponchas: OFF', 'OFF'),
      i18n,
    )

    expect(message).toBe('Hoy no ponchas: OFF')
  })
})
