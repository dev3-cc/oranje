import { describe, expect, it, vi } from 'vitest'

import { fetchAllPages } from './fetchAllPages'

/**
 * Trae TODAS las páginas de un endpoint paginado — no solo la primera
 * (mismo patrón que hizo mentir a "Usuarios del sistema").
 */
describe('fetchAllPages', () => {
  it('con una sola página, no pide una segunda', async () => {
    const fetchWithBQ = vi.fn().mockResolvedValue({
      data: {
        data: [{ id: 'a' }, { id: 'b' }],
        meta: { page: 1, limit: 100, total: 2, totalPages: 1 },
      },
    })

    const result = await fetchAllPages(fetchWithBQ, '/hotels', { onlyClients: true })

    expect('data' in result && result.data).toEqual([{ id: 'a' }, { id: 'b' }])
    expect(fetchWithBQ).toHaveBeenCalledTimes(1)
    expect(fetchWithBQ).toHaveBeenCalledWith({
      url: '/hotels',
      params: { onlyClients: true, page: 1, limit: 100 },
    })
  })

  it('con varias páginas, las junta todas', async () => {
    const fetchWithBQ = vi.fn().mockImplementation(({ params }: { params: { page: number } }) => ({
      data: {
        data: [{ id: `p${String(params.page)}` }],
        meta: { page: params.page, limit: 100, total: 3, totalPages: 3 },
      },
    }))

    const result = await fetchAllPages(fetchWithBQ, '/requisitions')

    expect('data' in result && result.data).toEqual([{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }])
    expect(fetchWithBQ).toHaveBeenCalledTimes(3)
  })

  it('si la primera página falla, no pide más', async () => {
    const fetchWithBQ = vi.fn().mockResolvedValue({ error: { status: 500 } })

    const result = await fetchAllPages(fetchWithBQ, '/prospects')

    expect('error' in result).toBe(true)
    expect(fetchWithBQ).toHaveBeenCalledTimes(1)
  })

  it('si una página posterior falla, el resultado es error', async () => {
    const fetchWithBQ = vi.fn().mockImplementation(({ params }: { params: { page: number } }) => {
      if (params.page === 1) {
        return {
          data: { data: [{ id: 'p1' }], meta: { page: 1, limit: 100, total: 2, totalPages: 2 } },
        }
      }
      return { error: { status: 500 } }
    })

    const result = await fetchAllPages(fetchWithBQ, '/prospects')

    expect('error' in result).toBe(true)
  })
})
