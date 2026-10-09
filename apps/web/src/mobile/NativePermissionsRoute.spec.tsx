import { render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { NativePermissionsRoute } from './NativePermissionsRoute'

const native = vi.hoisted(() => ({ available: true, open: vi.fn() }))

vi.mock('@/features/worker', () => ({
  hasNativePermissions: () => native.available,
  usePermissionsScreen: () => native.open,
}))

function renderAt(path: string): ReturnType<typeof createMemoryRouter> {
  const router = createMemoryRouter(
    [
      { path: '/collaborator', element: <p>Inicio</p> },
      { path: '/collaborator/permissions', element: <NativePermissionsRoute /> },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

beforeEach(() => {
  native.available = true
  native.open.mockReset().mockResolvedValue(undefined)
})

describe('Permisos en la app', () => {
  it('abre la pantalla nativa en lugar de volver al Inicio sin hacer nada', async () => {
    renderAt('/collaborator/permissions')
    await waitFor(() => {
      expect(native.open).toHaveBeenCalledTimes(1)
    })
  })

  it('sin pantalla nativa regresa al apartado del Colaborador', async () => {
    native.available = false
    renderAt('/collaborator/permissions')
    expect(await screen.findByText('Inicio')).toBeTruthy()
    expect(native.open).not.toHaveBeenCalled()
  })
})
