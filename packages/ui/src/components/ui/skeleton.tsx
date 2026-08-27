import { cn } from '@ui/lib/utils'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        /* Base con contraste real (surface-3): --accent (o-50) se perdía en el fondo. */
        'relative overflow-hidden rounded-md bg-surface-3/80',
        /* Shimmer: franja de luz en barrido; sin movimiento si el sistema lo pide. */
        'before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent motion-safe:before:animate-[skeleton-shimmer_1.6s_ease-in-out_infinite]',
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
