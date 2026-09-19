import type { ReactNode } from 'react'

import logoBlanco from '@/assets/logo/Logo_ORANJE_White.png'

/**
 * El fondo de toda tarjeta o hero de hotel: la foto de Places (D-34) a todo
 * lo ancho o, SOLO cuando el hotel no tiene foto, un placeholder de marca que
 * no se confunde con una foto — degradado Oranje y un edificio como marca de
 * agua. Si la URL guardada murió, el `onError` esconde la imagen y queda el
 * placeholder debajo. Va dentro de un contenedor `relative`; el velo oscuro
 * lo pone quien lo usa, porque cada superficie lo necesita distinto.
 */
export function HotelPhotoBackdrop({
  photoUrl,
}: {
  photoUrl: string | null | undefined
}): ReactNode {
  return (
    <div
      aria-hidden
      className="absolute inset-0 overflow-hidden bg-gradient-to-br from-o-500 to-o-700"
    >
      {/* Arriba a la derecha (la parte que ningún panel de vidrio tapa): el logo
          de Oranje en blanco como marca de agua — es de la casa, no es una foto. */}
      <img src={logoBlanco} alt="" className="absolute top-4 right-4 w-56 max-w-[70%] opacity-50" />
      {photoUrl && (
        <img
          src={photoUrl}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
          onError={(event) => {
            event.currentTarget.style.display = 'none'
          }}
        />
      )}
    </div>
  )
}
