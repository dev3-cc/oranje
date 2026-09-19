import { useEffect, useState } from 'react'

/**
 * Retrasa la propagación de un valor que cambia en cada tecla.
 *
 * Sin esto, escribir en el buscador dispara una consulta por carácter. Con
 * fixtures no se nota; contra la API sería una petición por tecla.
 */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value)
    }, delayMs)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delayMs])

  return debounced
}
