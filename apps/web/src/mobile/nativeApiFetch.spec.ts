import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { installNativeApiFetch, MULTIPART, toNativeFormData } from './nativeApiFetch'
import { homePathFor } from './roles'

const API = 'https://api.example.test/api/v1'

let webFetch: ReturnType<typeof vi.fn>
let nativePromise: ReturnType<typeof vi.fn>
let originalFetch: typeof window.fetch

function installBridge(platform: string): void {
  Object.assign(window, {
    Capacitor: {
      isNativePlatform: () => true,
      getPlatform: () => platform,
      isPluginAvailable: (name: string) => name === 'CapacitorHttp',
      nativePromise,
    },
  })
}

beforeEach(() => {
  originalFetch = Reflect.get(window, 'fetch')
  webFetch = vi.fn().mockResolvedValue(new Response('web'))
  window.fetch = webFetch as unknown as typeof window.fetch
  nativePromise = vi.fn().mockResolvedValue({
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    data: { data: { ok: true } },
  })
})

afterEach(() => {
  window.fetch = originalFetch
  delete (window as { Capacitor?: unknown }).Capacitor
})

describe('homePathFor', () => {
  it('reparte por rol: Colaborador, hotel y el resto', () => {
    expect(homePathFor('ROL-C-01')).toBe('/collaborator')
    expect(homePathFor('ROL-H-01')).toBe('/dashboard')
    expect(homePathFor('ROL-H-02')).toBe('/dashboard')
    expect(homePathFor('ROL-H-03')).toBe('/dashboard')
    expect(homePathFor('ROL-V-01')).toBe('/unsupported')
    expect(homePathFor(undefined)).toBe('/unsupported')
  })
})

describe('installNativeApiFetch', () => {
  it('fuera de la app no reemplaza nada', () => {
    installNativeApiFetch(API)
    expect(Reflect.get(window, 'fetch')).toBe(webFetch)
  })

  it('en Android no reemplaza nada (allá la cookie sí funciona)', () => {
    installBridge('android')
    installNativeApiFetch(API)
    expect(Reflect.get(window, 'fetch')).toBe(webFetch)
  })

  it('en iOS manda el API por el HTTP nativo, con su cuerpo JSON', async () => {
    installBridge('ios')
    installNativeApiFetch(API)

    const response = await window.fetch(
      new Request(`${API}/auth/session`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idToken: 'x' }),
      }),
    )

    expect(webFetch).not.toHaveBeenCalled()
    expect(nativePromise).toHaveBeenCalledWith(
      'CapacitorHttp',
      'request',
      expect.objectContaining({
        url: `${API}/auth/session`,
        method: 'POST',
        data: '{"idToken":"x"}',
      }),
    )
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: { ok: true } })
  })

  it('en iOS lo que no es el API sigue por el WebView', async () => {
    installBridge('ios')
    installNativeApiFetch(API)

    await window.fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword')

    expect(webFetch).toHaveBeenCalledTimes(1)
    expect(nativePromise).not.toHaveBeenCalled()
  })

  it('rearma el multipart: la foto viaja como archivo en base64, el resto como texto', async () => {
    /*
     * Se prueba la conversión y no el `fetch` completo: en jsdom, `File` es el
     * de jsdom y `Request` el de Node (undici), y no se aceptan entre sí. En la
     * app los dos son del WebView. La subida de punta a punta se verifica en
     * el dispositivo.
     */
    const body = new FormData()
    body.append('file', new File(['abc'], 'ponche.jpg', { type: 'image/jpeg' }))
    body.append('purpose', 'PUNCH_PHOTO')

    await expect(toNativeFormData(body)).resolves.toEqual([
      {
        key: 'file',
        value: btoa('abc'),
        type: 'base64File',
        contentType: 'image/jpeg',
        fileName: 'ponche.jpg',
      },
      { key: 'purpose', value: 'PUNCH_PHOTO', type: 'string' },
    ])
  })

  it('una subida conserva el Content-Type multipart: sin él iOS mandaba el cuerpo vacío', async () => {
    installBridge('ios')
    nativePromise.mockResolvedValueOnce({ status: 201, headers: {}, data: '{"data":{}}' })
    installNativeApiFetch(API)

    /* Cuerpo multipart armado a mano: `File` de jsdom y `Request` de Node no se mezclan. */
    const boundary = 'xYz'
    await window.fetch(`${API}/files`, {
      method: 'POST',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      body: `--${boundary}\r\nContent-Disposition: form-data; name="purpose"\r\n\r\nWORKER_PHOTO\r\n--${boundary}--\r\n`,
    })

    const [plugin, method, options] = nativePromise.mock.calls[0] as [
      string,
      string,
      { dataType: string; headers: Record<string, string>; data: unknown },
    ]
    expect([plugin, method]).toEqual(['CapacitorHttp', 'request'])
    expect(options.dataType).toBe('formData')
    expect(options.headers['content-type']).toBe(MULTIPART)
    expect(options.data).toEqual([{ key: 'purpose', value: 'WORKER_PHOTO', type: 'string' }])
  })

  it('sin respuesta nativa falla como fetch (TypeError)', async () => {
    installBridge('ios')
    nativePromise.mockRejectedValueOnce(new Error('offline'))
    installNativeApiFetch(API)

    await expect(window.fetch(`${API}/me`)).rejects.toBeInstanceOf(TypeError)
  })
})
