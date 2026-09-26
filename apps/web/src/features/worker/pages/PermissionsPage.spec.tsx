import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PermissionsPage } from './PermissionsPage'

/**
 * jsdom no trae `navigator.permissions`/`mediaDevices`/`geolocation`: se
 * definen a mano por prueba y se limpian después, para no filtrar un mock
 * de cámara «otorgada» a la prueba de ubicación.
 */
afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'permissions')
  Reflect.deleteProperty(navigator, 'mediaDevices')
  Reflect.deleteProperty(navigator, 'geolocation')
})

describe('PermissionsPage', () => {
  it('sin navigator.permissions (jsdom) igual muestra las dos filas, sin tronar', async () => {
    render(<PermissionsPage />)

    expect(await screen.findByText('Cámara')).toBeInTheDocument()
    expect(screen.getByText('Ubicación')).toBeInTheDocument()
    expect(await screen.findAllByRole('button', { name: 'Dar acceso' })).toHaveLength(2)
  })

  it('dar acceso a la cámara y que el navegador la otorgue la marca como Activo', async () => {
    const stop = vi.fn()
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) },
    })

    const user = userEvent.setup()
    render(<PermissionsPage />)

    const [cameraButton] = await screen.findAllByRole('button', { name: 'Dar acceso' })
    await user.click(cameraButton!)

    expect(await screen.findByText('Activo')).toBeInTheDocument()
    expect(stop).toHaveBeenCalled()
  })

  it('si el navegador ya la bloqueó, el botón invita a comprobar de nuevo en vez de pedirla', async () => {
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: { query: vi.fn().mockResolvedValue({ state: 'denied' }) },
    })

    render(<PermissionsPage />)

    // Las dos filas se bloquearon (mismo mock para cámara y ubicación): el aviso sale por duplicado.
    expect(await screen.findAllByText(/ya no vuelve a preguntar/)).toHaveLength(2)
    expect(
      screen.getAllByRole('button', { name: 'Ya lo cambié: comprobar de nuevo' }),
    ).toHaveLength(2)
  })
})
