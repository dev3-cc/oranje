import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Une clases resolviendo conflictos de Tailwind. Lo espera todo componente de shadcn. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
