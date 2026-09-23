/**
 * Los sonidos de la app, sintetizados con Web Audio — sin un solo archivo que
 * descargar (el mismo mecanismo que ya confirmaba el ponche desde el
 * 2026-09-12).
 *
 * Tres reglas que los hacen soportables ocho horas seguidas:
 *
 * 1. **Cortos y bajos.** Navegar suena a un toque de 70 ms, no a una campana.
 *    Lo único que se permite dos notas es la notificación, que sí quiere que
 *    levantes la vista.
 * 2. **Se pueden apagar.** La preferencia vive en el navegador de cada quien
 *    (`localStorage`), no en la persona: es del aparato donde molesta.
 * 3. **Fallan en silencio.** Sin permiso, en una pestaña que nunca recibió un
 *    clic o con el audio bloqueado, no pasa nada — nunca rompen la pantalla.
 */

export type SoundName = 'navigate' | 'back' | 'notify'

const STORAGE_KEY = 'oranje.sound'

/** El evento con el que el interruptor avisa a quien lo pinte en otra parte. */
export const SOUND_CHANGED = 'oranje:sound-changed'

/** Cada sonido es una lista de [frecuencia en Hz, retraso en s, volumen]. */
const TONES: Record<SoundName, Array<[number, number, number]>> = {
  /* Avanzar: una nota clara y corta. */
  navigate: [[620, 0, 0.05]],
  /* Volver: la misma idea una quinta abajo — se distingue sin pensarlo. */
  back: [[420, 0, 0.045]],
  /* Aviso: dos notas ascendentes, el timbre del ponche, algo más suave. */
  notify: [
    [660, 0, 0.12],
    [880, 0.13, 0.12],
  ],
}

/** Duración de cada toque; la notificación se deja respirar un poco más. */
const DURATION: Record<SoundName, number> = { navigate: 0.07, back: 0.07, notify: 0.2 }

let context: AudioContext | null = null

function audioContext(): AudioContext | null {
  try {
    const AudioCtor = window.AudioContext
    if (typeof AudioCtor !== 'function') return null
    context ??= new AudioCtor()
    return context
  } catch {
    return null
  }
}

/** ¿El sonido está encendido en este navegador? Por defecto, sí. */
export function isSoundOn(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    /* Ventana privada o almacenamiento bloqueado: suena, que es el default. */
    return true
  }
}

export function setSoundOn(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off')
  } catch {
    /* Si no se puede recordar, al menos vale para esta sesión. */
  }
  window.dispatchEvent(new CustomEvent(SOUND_CHANGED))
}

/**
 * Suena, si está encendido. Nunca lanza: un sonido no puede tumbar una
 * pantalla.
 */
export function playSound(name: SoundName): void {
  if (!isSoundOn()) return

  const ctx = audioContext()
  if (!ctx) return

  try {
    /* Una pestaña que aún no recibe un clic deja el contexto suspendido; se
       intenta reanudar y, si el navegador no quiere, no pasa nada. */
    if (ctx.state === 'suspended') void ctx.resume()

    const length = DURATION[name]
    for (const [frequency, at, volume] of TONES[name]) {
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      const start = ctx.currentTime + at
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + length)
      oscillator.connect(gain).connect(ctx.destination)
      oscillator.start(start)
      oscillator.stop(start + length + 0.02)
    }
  } catch {
    /* Sin audio, la app sigue igual de completa. */
  }
}
