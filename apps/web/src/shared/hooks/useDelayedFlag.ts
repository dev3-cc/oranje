import { useEffect, useState } from 'react'

/** `true` solo cuando `flag` lleva más de `delayMs` encendida; se apaga al
    instante. Evita el parpadeo de un loader en respuestas casi inmediatas
    (regla de la skill de UX: indicador solo si la espera pasa de 300 ms). */
export function useDelayedFlag(flag: boolean, delayMs: number): boolean {
  const [delayed, setDelayed] = useState(false)
  useEffect(() => {
    if (!flag) {
      setDelayed(false)
      return
    }
    const timer = setTimeout(() => {
      setDelayed(true)
    }, delayMs)
    return () => {
      clearTimeout(timer)
    }
  }, [flag, delayMs])
  return delayed
}
