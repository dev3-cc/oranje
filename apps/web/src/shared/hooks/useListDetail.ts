import { useState } from 'react'

/**
 * Lista-detalle en dos columnas desde `lg` (300-360px + el resto): abajo de
 * `lg` la rejilla cae a una sola columna y lista+detalle se apilan, así que
 * elegir una fila mandaba el detalle al fondo de la página, después de
 * potencialmente cientos de filas (Hugo, 2026-09-22, reportado en el Pool).
 *
 * Mismo patrón que ya usan los modales anchos en móvil: elegir una fila pasa
 * a la vista del detalle a pantalla completa, con una flecha para volver —
 * la lista y el detalle NUNCA conviven en una sola columna. Desde `lg` las
 * dos clases (`ROSTER_LIST_CLASS`/`ROSTER_DETAIL_CLASS`) fuerzan que ambas se
 * vean siempre, lado a lado, sin importar el estado de selección.
 */
export function useListDetail(): {
  showDetailOnMobile: boolean
  select: () => void
  backToList: () => void
} {
  const [showDetailOnMobile, setShowDetailOnMobile] = useState(false)

  return {
    showDetailOnMobile,
    select: () => {
      setShowDetailOnMobile(true)
    },
    backToList: () => {
      setShowDetailOnMobile(false)
    },
  }
}

/**
 * El breakpoint donde lista y detalle pasan a verse lado a lado — varía por
 * pantalla según cuánto pida la rejilla (`lg` la mayoría, `xl` donde el
 * detalle necesita 2 columnas propias, como Autorización). Las clases van
 * escritas COMPLETAS en cada rama, nunca armadas con `${breakpoint}` — eso
 * fue justo el bug del ancho de modales (2026-09-22): una clase que Tailwind
 * no ve como texto literal no genera CSS y no hace nada.
 */
export type ListDetailBreakpoint = 'lg' | 'xl'
/** `flex` para paneles ya armados como flexbox; `block` para no cambiarle el layout a uno que no lo era. */
export type ListDetailDisplay = 'flex' | 'block'

/** La lista: visible siempre en el breakpoint; abajo, solo si el detalle no la tapa. */
export function rosterListClass(
  showDetailOnMobile: boolean,
  breakpoint: ListDetailBreakpoint = 'lg',
  display: ListDetailDisplay = 'flex',
): string {
  if (showDetailOnMobile) {
    if (breakpoint === 'xl') return display === 'block' ? 'hidden xl:block' : 'hidden xl:flex'
    return display === 'block' ? 'hidden lg:block' : 'hidden lg:flex'
  }
  return display === 'block' ? 'block' : 'flex'
}

/** El panel de detalle: visible siempre en el breakpoint; abajo, solo tras elegir una fila. */
export function rosterDetailClass(
  showDetailOnMobile: boolean,
  breakpoint: ListDetailBreakpoint = 'lg',
  display: ListDetailDisplay = 'flex',
): string {
  if (showDetailOnMobile) {
    return display === 'block' ? 'block' : 'flex'
  }
  if (breakpoint === 'xl') return display === 'block' ? 'hidden xl:block' : 'hidden xl:flex'
  return display === 'block' ? 'hidden lg:block' : 'hidden lg:flex'
}
