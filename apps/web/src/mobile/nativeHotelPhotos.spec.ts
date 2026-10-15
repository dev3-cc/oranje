import { describe, expect, it, vi } from 'vitest'

import { createPhotoLoader, isHotelPhoto } from './nativeHotelPhotos'

const PHOTO = 'https://places.googleapis.com/v1/places/abc/photos/xyz/media?maxWidthPx=640&key=k'

function bridge(response: { status: number; headers?: Record<string, unknown>; data: unknown }) {
  return {
    nativePromise: vi.fn().mockResolvedValue({ headers: {}, ...response }),
  }
}

describe('fotos de hotel por HTTP nativo', () => {
  it('solo intercepta las fotos de Google', () => {
    expect(isHotelPhoto(PHOTO)).toBe(true)
    expect(isHotelPhoto('https://storage.googleapis.com/oranje/worker.jpg')).toBe(false)
    expect(isHotelPhoto(undefined)).toBe(false)
  })

  it('pide la foto con el referrer de la web y la entrega como blob', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:foto-1')
    const cap = bridge({
      status: 200,
      headers: { 'content-type': 'image/jpeg' },
      data: 'YWJj\nZGVm',
    })
    const load = createPhotoLoader(cap, 'https://mi.oranjepeople.com/')

    await expect(load(PHOTO)).resolves.toBe('blob:foto-1')
    expect(cap.nativePromise).toHaveBeenCalledWith('CapacitorHttp', 'request', {
      url: PHOTO,
      method: 'GET',
      headers: { Referer: 'https://mi.oranjepeople.com/' },
      responseType: 'blob',
    })
  })

  it('la misma foto se baja una sola vez', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:foto-2')
    const cap = bridge({ status: 200, data: 'YWJj' })
    const load = createPhotoLoader(cap, 'https://mi.oranjepeople.com/')

    await Promise.all([load(PHOTO), load(PHOTO)])
    expect(cap.nativePromise).toHaveBeenCalledTimes(1)
  })

  it('si Google la rechaza, falla y no se queda en caché', async () => {
    const cap = bridge({ status: 403, data: '{}' })
    const load = createPhotoLoader(cap, 'https://mi.oranjepeople.com/')

    await expect(load(PHOTO)).rejects.toThrow('foto 403')
    await expect(load(PHOTO)).rejects.toThrow('foto 403')
    expect(cap.nativePromise).toHaveBeenCalledTimes(2)
  })
})
