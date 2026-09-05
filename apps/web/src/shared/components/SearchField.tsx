import { cn, Input, MaterialIcon, Spinner } from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'

/**
 * El buscador de la casa. Una sola forma para todo el sistema (auditoría de
 * Hugo, 2026-09-04) con las reglas de las Web Interface Guidelines: la lupa
 * DENTRO del campo como afordancia, `type="search"` (Escape limpia, el
 * teclado móvil pone «Buscar»), `aria-label` porque no lleva etiqueta
 * visible, placeholder que enseña el patrón con «…», `autoComplete="off"`
 * para que el gestor de contraseñas no se meta, y un botón para limpiar
 * cuando hay texto (con su `aria-label`: es un botón de solo icono).
 *
 * Filtra EN VIVO al teclear: por eso no lleva botón de buscar. El botón es
 * para búsquedas que disparan una consulta cara; aquí la lista ya está.
 *
 * `isSearching` es para los buscadores que SÍ consultan al servidor: la lupa
 * se vuelve el Spinner de shadcn — pero solo si la espera pasa de 300 ms
 * (regla de la skill: nada de parpadeos por respuestas instantáneas).
 */
export function SearchField({
  value,
  onChange,
  label,
  placeholder,
  className,
  isSearching = false,
}: {
  value: string
  onChange: (value: string) => void
  /** Qué se busca, para el lector de pantalla: «Buscar colaborador». */
  label: string
  /** Enseña el patrón: «Nombre del colaborador, p. ej. Ana Rivera…». */
  placeholder: string
  className?: string
  /** `true` mientras la consulta al servidor está en vuelo. */
  isSearching?: boolean
}): ReactNode {
  const showSpinner = useDelayedFlag(isSearching, 300)

  return (
    <div className={cn('relative min-w-60', className)}>
      {showSpinner ? (
        <Spinner
          aria-label="Buscando"
          className="absolute top-1/2 left-3 -translate-y-1/2 text-o-500"
        />
      ) : (
        <MaterialIcon
          name="search"
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-lg text-ink-4"
        />
      )}
      <Input
        type="search"
        name="search"
        autoComplete="off"
        aria-label={label}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
        }}
        placeholder={placeholder}
        className="pr-9 pl-10 [&::-webkit-search-cancel-button]:hidden"
      />
      {value !== '' && (
        <button
          type="button"
          aria-label="Limpiar la búsqueda"
          title="Limpiar"
          onClick={() => {
            onChange('')
          }}
          className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <MaterialIcon name="close" className="text-base" aria-hidden />
        </button>
      )}
    </div>
  )
}

/** `true` solo cuando `flag` lleva más de `delayMs` encendida; se apaga al instante. */
function useDelayedFlag(flag: boolean, delayMs: number): boolean {
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
