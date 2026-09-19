/**
 * La última ruta visitada, POR USUARIO: si la sesión muere y la persona vuelve
 * a entrar, se le devuelve a donde estaba — pero solo a ELLA. Sin el `userId`
 * guardado, un BD heredaría la ruta de la Reclutadora anterior y aterrizaría
 * en un 403 (el bug que ya tuvimos con `from`).
 */
const STORAGE_KEY = 'oranje-last-route'

export function saveLastRoute(userId: string, path: string): void {
  /* /login no es un lugar al que "volver". */
  if (path.startsWith('/login')) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ userId, path }))
  } catch {
    /* Sin storage simplemente no hay reanudación. */
  }
}

export function readLastRoute(): { userId: string; path: string } | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { userId?: unknown; path?: unknown }
    if (typeof parsed.userId !== 'string' || typeof parsed.path !== 'string') return null
    if (!parsed.path.startsWith('/')) return null
    return { userId: parsed.userId, path: parsed.path }
  } catch {
    return null
  }
}
