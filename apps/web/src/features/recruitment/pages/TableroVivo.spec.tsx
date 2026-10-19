import { describe, expect, it } from 'vitest'

import { AL_ATERRIZAR, SONDEO_TABLERO_MS, TABLERO_VIVO } from '../api/selfPickApi'

/**
 * Dos Reclutadoras trabajando a la vez se quedaban cada una con su tablero de
 * hace diez minutos: una elegía un slot o un colaborador que la otra ya había
 * asignado, llenaba el formulario completo y el rechazo llegaba al guardar.
 *
 * El servidor nunca permitió la doble asignación —lo impide el índice
 * `ux_slot_active_assignment`— así que lo que se perdía era el trabajo, no el
 * dato. Pero perder cinco minutos de captura y enterarte al final es
 * exactamente la clase de defecto que el barrido del 2026-09-07 cerró en el
 * resto de las pantallas: precondiciones que solo se ven tras el intento.
 *
 * Lo que se prueba aquí es el CONTRATO de refresco. Que los avisos aparezcan
 * se verifica en el spec de la pantalla; que la consulta se mantenga viva no
 * se puede ver desde el DOM, y es lo que hace que el aviso llegue a tiempo.
 */
describe('el tablero se mantiene vivo mientras se mira', () => {
  it('vuelve a preguntar al entrar a la pantalla', () => {
    /* Entrar es el momento de decidir: nadie quiere empezar a llenar un
       formulario sobre un tablero de hace una hora. */
    expect(TABLERO_VIVO.refetchOnMountOrArgChange).toBe(true)
  })

  it('sondea mientras la pestaña está al frente, y para cuando no', () => {
    expect(SONDEO_TABLERO_MS).toBe(30_000)

    /* Sin esto, una pestaña olvidada en segundo plano consultaría toda la
       noche: son datos que solo importan mientras alguien los mira. */
    expect(TABLERO_VIVO.skipPollingIfUnfocused).toBe(true)
  })

  it('se comporta igual en pruebas que en producción', () => {
    /* Llegué a apagar el sondeo en pruebas creyendo que volvía inestable este
       archivo. La medición que lo justificaba resultó ser suerte: la versión
       SIN el sondeo flaqueaba igual. La causa real era el límite de 5 s por
       caso, que no alcanzaba con la máquina cargada (ver vitest.config.ts).
       Aquí queda escrito para que nadie vuelva a partir el comportamiento por
       entorno sin una medición repetida. */
    expect(TABLERO_VIVO.pollingInterval).toBe(SONDEO_TABLERO_MS)
    expect(TABLERO_VIVO.refetchOnFocus).toBe(true)
  })

  it('es más rápido que la campana, a propósito', () => {
    /* La campana avisa de algo que ya pasó; aquí dos personas compiten por la
       misma fila y medio minuto de tablero viejo ya es un formulario tirado. */
    expect(SONDEO_TABLERO_MS).toBeLessThan(45_000)
  })

  it('se pone al día al volver a la pestaña y al reconectar', () => {
    /* El caso real: te llaman, vuelves diez minutos después. Sin esto, el
       primer refresco tardaría hasta 30 s más. */
    expect(TABLERO_VIVO.refetchOnReconnect).toBe(true)
  })

  it('no pierde lo que ya hacía AL_ATERRIZAR', () => {
    /* `TABLERO_VIVO` se construye sobre él: si alguien cambia uno, el otro no
       se queda atrás en silencio. */
    for (const [clave, valor] of Object.entries(AL_ATERRIZAR)) {
      expect(TABLERO_VIVO).toHaveProperty(clave, valor)
    }
  })
})
