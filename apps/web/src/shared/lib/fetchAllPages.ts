import type { PaginatedEnvelope } from '@/shared/types/apiContract.types'

/** Firma de `fetchWithBQ` dentro de un `queryFn` — idéntica en cada `*Api.ts`. */
type FetchWithBQ = (
  args: string | { url: string; params?: Record<string, unknown> },
) => Promise<{ data?: unknown; error?: unknown }>

/**
 * Tope duro de páginas: 2000 filas (20 × 100, el máximo real del back por
 * página). Si algún día se alcanza, el conteo vuelve a quedar corto — pero
 * para entonces la pantalla necesita un agregado real del back, no más
 * páginas por aquí.
 */
const MAX_PAGES = 20

/**
 * Trae TODAS las filas de un endpoint paginado, no solo la primera página.
 *
 * Varias pantallas (Cartera de Clientes, Mi Territorio, Mi Equipo, el
 * tablero de Requisiciones, Self-Pick, candidatos de propuesta) calculan
 * contadores y sumas EN MEMORIA a partir de una sola página con `limit: 100`
 * — el mismo patrón que hizo mentir a "Usuarios del sistema" (880 filas
 * reales contra un tope de 20). El back no tiene un endpoint de agregados
 * para estos casos todavía, así que mientras tanto se trae el dataset
 * completo (paginado en paralelo) y se calcula sobre eso.
 */
export async function fetchAllPages<T>(
  fetchWithBQ: FetchWithBQ,
  url: string,
  params: Record<string, unknown> = {},
): Promise<{ data: T[] } | { error: unknown }> {
  const first = await fetchWithBQ({ url, params: { ...params, page: 1, limit: 100 } })
  if (first.error) return { error: first.error }

  const firstPage = first.data as PaginatedEnvelope<T>
  const rows: T[] = [...firstPage.data]
  const totalPages = Math.min(firstPage.meta.totalPages, MAX_PAGES)

  if (totalPages > 1) {
    const rest = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, index) =>
        fetchWithBQ({ url, params: { ...params, page: index + 2, limit: 100 } }),
      ),
    )
    for (const res of rest) {
      if (res.error) return { error: res.error }
      rows.push(...(res.data as PaginatedEnvelope<T>).data)
    }
  }

  return { data: rows }
}
