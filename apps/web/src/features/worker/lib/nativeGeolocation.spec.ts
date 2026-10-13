import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  hasNativeGeolocation,
  nativeCurrentPosition,
  requestNativeLocationPermission,
} from './nativeGeolocation'

function installBridge(nativePromise: ReturnType<typeof vi.fn>): void {
  ;(window as { Capacitor?: unknown }).Capacitor = {
    isNativePlatform: () => true,
    isPluginAvailable: (name: string) => name === 'Geolocation',
    nativePromise,
  }
}

afterEach(() => {
  delete (window as { Capacitor?: unknown }).Capacitor
})

describe('ubicación nativa', () => {
  it('en el navegador no existe: el web sigue con navigator.geolocation', async () => {
    expect(hasNativeGeolocation()).toBe(false)
    await expect(requestNativeLocationPermission()).resolves.toBe('unsupported')
  })

  it('en la app pide la posición al plugin', async () => {
    const nativePromise = vi
      .fn()
      .mockResolvedValue({ coords: { latitude: 21.1, longitude: -86.8 } })
    installBridge(nativePromise)

    await expect(nativeCurrentPosition()).resolves.toEqual({ latitude: 21.1, longitude: -86.8 })
    expect(nativePromise).toHaveBeenCalledWith(
      'Geolocation',
      'getCurrentPosition',
      expect.objectContaining({ enableHighAccuracy: true }),
    )
  })

  it('el permiso negado se llama igual que en el web', async () => {
    installBridge(vi.fn().mockRejectedValue({ code: 'OS-PLUG-GLOC-0003' }))
    await expect(nativeCurrentPosition()).rejects.toThrow('GEOLOCATION_DENIED')

    installBridge(vi.fn().mockRejectedValue({ code: 'OS-PLUG-GLOC-0002' }))
    await expect(nativeCurrentPosition()).rejects.toThrow('GEOLOCATION_FAILED')
  })

  it('el permiso de la app, en los términos de la pantalla', async () => {
    installBridge(vi.fn().mockResolvedValue({ location: 'granted' }))
    await expect(requestNativeLocationPermission()).resolves.toBe('granted')
  })
})
