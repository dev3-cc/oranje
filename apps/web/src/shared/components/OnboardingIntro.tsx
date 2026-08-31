import { cn } from '@oranje/ui'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useState, type ReactNode } from 'react'

import { Button } from '@/shared/components/Button'
import { MOTION } from '@/shared/lib/motion'

export interface OnboardingSlide {
  image: string
  title: string
  text: string
}

export function OnboardingIntro({
  slides,
  onDone,
  startLabel,
}: {
  slides: readonly OnboardingSlide[]
  onDone: () => void
  startLabel: string
}): ReactNode {
  const [slide, setSlide] = useState(0)
  const reduceMotion = useReducedMotion() ?? false
  const isLast = slide >= slides.length - 1

  return (
    <div className="flex flex-col items-center gap-4 px-10 py-12 text-center">
      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-o-500 transition-all duration-300"
          style={{ width: `${String(((slide + 1) / slides.length) * 100)}%` }}
        />
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={slide}
          initial={{ opacity: 0, x: reduceMotion ? 0 : 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: reduceMotion ? 0 : -24 }}
          transition={{ duration: reduceMotion ? 0 : MOTION.enter, ease: MOTION.easeOut }}
          className="flex flex-col items-center gap-4"
        >
          <img src={slides[slide]?.image} alt="" aria-hidden className="h-44 w-auto" />
          <h2 className="text-xl font-bold text-ink">{slides[slide]?.title}</h2>
          <p className="max-w-sm text-sm leading-relaxed text-ink-2">{slides[slide]?.text}</p>
        </motion.div>
      </AnimatePresence>
      <div className="flex items-center gap-2" aria-hidden>
        {slides.map((item, index) => (
          <span
            key={item.title}
            className={cn(
              'size-2 rounded-full transition-colors',
              index === slide ? 'bg-o-500' : 'bg-surface-3',
            )}
          />
        ))}
      </div>
      <div className="mt-2 flex w-full max-w-xs flex-col gap-2">
        <Button
          variant="primary"
          className="w-full"
          onClick={() => {
            if (!isLast) {
              setSlide(slide + 1)
              return
            }
            onDone()
          }}
        >
          {isLast ? startLabel : 'Continuar'}
        </Button>
        {!isLast && (
          <Button className="w-full" onClick={onDone}>
            Saltar
          </Button>
        )}
      </div>
    </div>
  )
}
