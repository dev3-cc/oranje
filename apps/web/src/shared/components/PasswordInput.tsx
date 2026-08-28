import { Input, MaterialIcon } from '@oranje/ui'
import { forwardRef, useState, type ComponentProps } from 'react'

/**
 * Campo de contraseña con el ojo para verla: escribir a ciegas una clave que
 * uno mismo define (el alta con contraseña del Administrador) es pedir
 * errores. `forwardRef` para que `register` de react-hook-form lo maneje
 * como a cualquier Input.
 */
export const PasswordInput = forwardRef<
  HTMLInputElement,
  Omit<ComponentProps<typeof Input>, 'type'>
>(function PasswordInput({ className, ...props }, ref) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div className="relative">
      <Input
        ref={ref}
        type={isVisible ? 'text' : 'password'}
        className={`pr-10 ${className ?? ''}`}
        {...props}
      />
      <button
        type="button"
        aria-label={isVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={isVisible}
        onClick={() => {
          setIsVisible((value) => !value)
        }}
        className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
      >
        <MaterialIcon name={isVisible ? 'visibility_off' : 'visibility'} className="text-lg" />
      </button>
    </div>
  )
})
