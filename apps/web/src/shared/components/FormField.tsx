import type { ReactNode } from 'react'

/**
 * Etiqueta + control + pie de ayuda, que es la forma que repite cada campo del
 * diseño.
 *
 * El pie tiene un solo hueco a propósito: cuando hay error, el error SUSTITUYE
 * a la ayuda en vez de apilarse debajo. Así el campo no cambia de alto al
 * validar y no se mueve el resto del formulario.
 *
 * `htmlFor` es opcional porque un grupo de botones (el tipo de intento) no es
 * un control único al que apuntar; ahí la etiqueta es solo texto.
 */
export function FormField({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  error?: string | undefined
  children: ReactNode
}): ReactNode {
  const labelClass = 'text-sm font-semibold text-ink'

  return (
    <div className="flex flex-col gap-2">
      {htmlFor === undefined ? (
        <span className={labelClass}>{label}</span>
      ) : (
        <label htmlFor={htmlFor} className={labelClass}>
          {label}
        </label>
      )}

      {children}

      {error !== undefined ? (
        <p className="text-xs text-red">{error}</p>
      ) : (
        hint !== undefined && <p className="text-xs text-ink-3">{hint}</p>
      )}
    </div>
  )
}
