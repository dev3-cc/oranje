import { useState, type ReactNode } from 'react'

/**
 * La foto del hotel con su plan B: si no hay `photoUrl` o la URL de Places
 * muere (la firma caduca), se pinta el icono del edificio — nunca una X rota.
 */
export function HotelPhoto({
  photoUrl,
  className,
}: {
  photoUrl: string | null
  className: string
}): ReactNode {
  const [isBroken, setIsBroken] = useState(false)

  if (photoUrl === null || isBroken) {
    return (
      <span className={`flex items-center justify-center bg-surface-3 ${className}`}>
        <span className="material-icons-outlined text-2xl text-o-500" aria-hidden>
          apartment
        </span>
      </span>
    )
  }

  return (
    <img
      src={photoUrl}
      alt=""
      loading="lazy"
      className={`object-cover ${className}`}
      onError={() => {
        setIsBroken(true)
      }}
    />
  )
}
