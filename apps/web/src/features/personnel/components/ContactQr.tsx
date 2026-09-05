import { toDataURL } from 'qrcode'
import { useEffect, useState, type ReactNode } from 'react'

/**
 * El puente escritorio → celular: un QR con la tarjeta de contacto (vCard).
 * Se escanea con la cámara del teléfono y ahí sí se marca o se guarda — el
 * botón «Llamar» en una computadora no marcaba nada.
 */
export function ContactQr({ name, phone }: { name: string; phone: string }): ReactNode {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL;TYPE=CELL:${phone}\nEND:VCARD`
    toDataURL(vcard, { margin: 1, width: 240, color: { dark: '#1A1108', light: '#FFFFFF' } })
      .then(setDataUrl)
      .catch(() => {
        setDataUrl(null)
      })
  }, [name, phone])

  if (dataUrl === null) return null

  return (
    <figure className="flex flex-col items-center gap-2 rounded-lg border border-line bg-surface p-4">
      <img src={dataUrl} alt={`Contacto de ${name} en QR`} className="size-28 rounded-md" />
      <figcaption className="max-w-40 text-center text-xs leading-relaxed text-ink-3">
        Escanéalo con tu celular para llamarle o guardar su contacto
      </figcaption>
    </figure>
  )
}
