import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  checkNativePermissions,
  hasNativePermissions,
  onNativePermissionsChange,
  openNativePermissions,
} from './nativePermissions'

const READY = { location: 'granted', camera: 'granted', gps: true, ready: true }

function installBridge(options: { native?: boolean; plugin?: boolean } = {}) {
  const nativePromise = vi.fn().mockResolvedValue(READY)
  const nativeCallback = vi.fn().mockReturnValue('cb-1')
  Object.assign(window, {
    Capacitor: {
      isNativePlatform: () => options.native ?? true,
      isPluginAvailable: (name: string) => (options.plugin ?? true) && name === 'OranjePermissions',
      nativePromise,
      nativeCallback,
    },
  })
  return { nativePromise, nativeCallback }
}

afterEach(() => {
  delete (window as { Capacitor?: unknown }).Capacitor
})

describe('nativePermissions', () => {
  it('en el navegador no existe y no toca nada', async () => {
    expect(hasNativePermissions()).toBe(false)
    await expect(checkNativePermissions()).resolves.toBeNull()
    await expect(openNativePermissions({ firstName: 'Ana', locale: 'es' })).resolves.toBeNull()
    expect(() => onNativePermissionsChange(() => undefined)()).not.toThrow()
  })

  it('con Capacitor pero sin el plugin (una app vieja) tampoco', () => {
    installBridge({ plugin: false })
    expect(hasNativePermissions()).toBe(false)
  })

  it('en la app consulta y abre la pantalla por el plugin', async () => {
    const { nativePromise } = installBridge()
    expect(hasNativePermissions()).toBe(true)

    await expect(checkNativePermissions()).resolves.toEqual(READY)
    expect(nativePromise).toHaveBeenCalledWith('OranjePermissions', 'check')

    await openNativePermissions({ firstName: 'Ana', locale: 'en' })
    expect(nativePromise).toHaveBeenCalledWith('OranjePermissions', 'open', {
      firstName: 'Ana',
      locale: 'en',
    })
  })

  it('escucha los cambios y deja de escuchar con el mismo id', () => {
    const { nativePromise, nativeCallback } = installBridge()
    const listener = vi.fn()

    const stop = onNativePermissionsChange(listener)
    const callback = nativeCallback.mock.calls[0]?.[3] as (data: unknown) => void
    callback(READY)
    expect(listener).toHaveBeenCalledWith(READY)

    stop()
    expect(nativePromise).toHaveBeenCalledWith('OranjePermissions', 'removeListener', {
      eventName: 'permissionsChanged',
      callbackId: 'cb-1',
    })
  })
})
