import { describe, expect, it, vi } from 'vitest'

import { sameOriginPath, saveFileNatively } from './nativeDownloads'

const ORIGIN = 'capacitor://mi.oranjepeople.com'

describe('descargas en la app', () => {
  it('abre en la app solo las ligas del mismo origen', () => {
    expect(sameOriginPath('/hotels/h1/punch-qr', ORIGIN)).toBe('/hotels/h1/punch-qr')
    expect(sameOriginPath(`${ORIGIN}/hotels/h1/punch-qr?v=2#hoja`, ORIGIN)).toBe(
      '/hotels/h1/punch-qr?v=2#hoja',
    )
    expect(sameOriginPath('https://www.google.com/maps', ORIGIN)).toBeNull()
    expect(sameOriginPath('/collaborator', 'https://mi.oranjepeople.com/hotels')).toBe(
      '/collaborator',
    )
  })

  it('escribe el PDF en la caché y lo manda a la hoja de compartir', async () => {
    const nativePromise = vi.fn().mockResolvedValue({ uri: 'file:///cache/qr-ponche-villa.pdf' })
    const blob = new Blob(['abc'], { type: 'application/pdf' })

    await saveFileNatively({ nativePromise }, blob, 'qr-ponche-villa.pdf')

    expect(nativePromise).toHaveBeenNthCalledWith(1, 'Filesystem', 'writeFile', {
      path: 'qr-ponche-villa.pdf',
      data: 'YWJj',
      directory: 'CACHE',
    })
    expect(nativePromise).toHaveBeenNthCalledWith(2, 'Share', 'share', {
      title: 'qr-ponche-villa.pdf',
      files: ['file:///cache/qr-ponche-villa.pdf'],
    })
  })

  it('cerrar la hoja de compartir no es un error; otra falla sí', async () => {
    const blob = new Blob(['abc'])
    const canceled = vi
      .fn()
      .mockResolvedValueOnce({ uri: 'file:///a.pdf' })
      .mockRejectedValueOnce(new Error('Share canceled'))
    await expect(saveFileNatively({ nativePromise: canceled }, blob, 'a.pdf')).resolves.toBe(
      undefined,
    )

    const broken = vi.fn().mockRejectedValueOnce(new Error('disk full'))
    await expect(saveFileNatively({ nativePromise: broken }, blob, 'a.pdf')).rejects.toThrow(
      'disk full',
    )
  })
})
