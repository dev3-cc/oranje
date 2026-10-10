import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { NativePermissionsRoute } from './NativePermissionsRoute'

import { store } from '@/app/store'

const native = vi.hoisted(() => ({ available: true, open: vi.fn() }))

vi.mock('@/features/worker', () => ({
  hasNativePermissions: () => native.available,
  openNativePermissions: native.open,
}))

function renderAt(path: string): ReturnType<typeof createMemoryRouter> {
  const router = createMemoryRouter(
    [
      { path: '/collaborator', element: <p>Inicio</p> },
      { path: '/collaborator/punch', element: <p>Ponchar</p> },
      { path: '/collaborator/permissions', element: <NativePermissionsRoute /> },
    ],
    { initialEntries: [path] },
  )
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
  return router
}

beforeEach(() => {
  native.available = true
  native.open.mockReset()
})

describe('Permisos en la app', () => {
  it('«Ir a Inicio» lleva al Inicio y no vuelve a abrir la pantalla', async () => {
    native.open.mockResolvedValue({ action: 'home' })
    const router = renderAt('/collaborator/permissions')
    expect(await screen.findByText('Inicio')).toBeTruthy()
    expect(router.state.location.pathname).toBe('/collaborator')
    expect(native.open).toHaveBeenCalledTimes(1)
  })

  it('«Ponchar» lleva a Ponchar', async () => {
    native.open.mockResolvedValue({ action: 'punch' })
    renderAt('/collaborator/permissions')
    expect(await screen.findByText('Ponchar')).toBeTruthy()
  })

  it('Atrás, sin historial, regresa al apartado del Colaborador', async () => {
    native.open.mockResolvedValue({ action: 'back' })
    renderAt('/collaborator/permissions')
    expect(await screen.findByText('Inicio')).toBeTruthy()
  })

  it('sin pantalla nativa regresa sin abrir nada', async () => {
    native.available = false
    renderAt('/collaborator/permissions')
    expect(await screen.findByText('Inicio')).toBeTruthy()
    expect(native.open).not.toHaveBeenCalled()
  })
})
