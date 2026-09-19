import { useEffect, useState } from 'react'

/**
 * `true` cuando el viewport cumple la media query. Arranca en `false` si
 * `matchMedia` no existe (jsdom en tests): lo condicionado simplemente no se
 * monta, que es el comportamiento que se quiere para el 3D.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
  )

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined
    const list = window.matchMedia(query)
    const onChange = (event: MediaQueryListEvent): void => {
      setMatches(event.matches)
    }
    setMatches(list.matches)
    list.addEventListener('change', onChange)
    return () => {
      list.removeEventListener('change', onChange)
    }
  }, [query])

  return matches
}
