import type { ReactNode } from 'react'

/**
 * La hoja: el contrato como documento dentro de la ficha.
 *
 * Tenía una barra de zoom encima, copiada de los visores de documento. Se
 * retiró: aquí no hay un PDF que acercar, sino datos que ya se leen bien, y el
 * control ocupaba una banda entera sin resolver nada. El acuerdo completo, ese
 * sí como documento, sale de «Ver PDF».
 */
export function ContractPaper({ children }: { children: ReactNode }): ReactNode {
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface-2 p-4 sm:p-6">
      <div className="mx-auto w-full max-w-3xl rounded-md bg-surface p-6 shadow-md sm:p-8">
        {children}
      </div>
    </section>
  )
}
