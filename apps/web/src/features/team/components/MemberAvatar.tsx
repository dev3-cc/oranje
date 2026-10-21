import { cn } from '@oranje/ui'
import type { ReactNode } from 'react'

function initialsOf(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase()
}

/** La foto de la persona o, sin foto, sus iniciales. Decorativo: el nombre siempre va al lado. */
export function MemberAvatar({
  fullName,
  photoUrl,
  size,
}: {
  fullName: string
  photoUrl: string | null
  size: 'sm' | 'lg'
}): ReactNode {
  const box = size === 'lg' ? 'size-16 text-xl' : 'size-11 text-sm'
  return photoUrl ? (
    <img
      src={photoUrl}
      alt=""
      aria-hidden
      className={cn(box, 'shrink-0 rounded-full object-cover')}
    />
  ) : (
    <span
      aria-hidden
      className={cn(
        box,
        'flex shrink-0 items-center justify-center rounded-full bg-o-500/15 font-bold text-o-700',
      )}
    >
      {initialsOf(fullName)}
    </span>
  )
}
