import { Trans } from '@lingui/react/macro'
import { MaterialIcon, cn } from '@oranje/ui'
import { useEffect, useState, type ReactNode } from 'react'

import { activateLocale, LOCALE_LABEL, LOCALES, readStoredLocale, type Locale } from '@/app/i18n'
import { Modal } from '@/shared/components/Modal'

/**
 * ¿Se puede recordar la respuesta?
 *
 * Preguntar el idioma sin poder guardar la respuesta sería preguntarlo en cada
 * visita, que es peor que no preguntar. En una ventana privada o con los datos
 * del sitio bloqueados, el modal no aparece y queda el interruptor de siempre,
 * abajo del formulario. Misma prudencia que el recorrido guiado.
 */
function puedeRecordar(): boolean {
  try {
    const sonda = 'oranje-idioma-probe'
    window.localStorage.setItem(sonda, '1')
    window.localStorage.removeItem(sonda)
    return true
  } catch {
    return false
  }
}

/**
 * «¿En qué idioma?», una sola vez.
 *
 * Hasta hoy el idioma se adivinaba —lo guardado, si no el del navegador, si no
 * español— y el único modo de corregirlo era un interruptor pequeño al pie del
 * login, que casi nadie ve. Para la gente de Georgia eso significa entrar a una
 * aplicación en español y tener que buscar cómo cambiarla.
 *
 * Así que se pregunta de frente, pero **solo la primera vez**: quien ya eligió
 * —o quien ya entró alguna vez— no lo vuelve a ver. Elegir aquí es exactamente
 * lo mismo que tocar el interruptor; no hay un ajuste nuevo que mantener.
 *
 * Sin banderas, y cada idioma escrito en sí mismo (D-36): una bandera es un
 * país, no un idioma — el inglés de Georgia no es el de ninguna bandera que
 * alguien de Cancún reconozca al vuelo.
 */
export function LanguagePrompt(): ReactNode {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    /* Solo si NUNCA se ha elegido. `readStoredLocale` devuelve null tanto
       cuando no hay preferencia como cuando no se puede leer, por eso la sonda
       aparte: sin ella, un navegador con datos bloqueados vería el modal en
       cada carga. */
    if (readStoredLocale() === null && puedeRecordar()) setIsOpen(true)
  }, [])

  function elegir(locale: Locale): void {
    activateLocale(locale)
    setIsOpen(false)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        /* Cerrar sin elegir deja lo que ya estaba puesto, pero lo FIJA: si no
           se guardara, el modal volvería en la siguiente carga y la persona
           que decidió ignorarlo tendría que ignorarlo para siempre. */
        elegir(readStoredLocale() ?? 'es')
      }}
      title="Elige tu idioma · Choose your language"
      className="max-w-md"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {LOCALES.map((locale) => (
          <button
            key={locale}
            type="button"
            lang={locale}
            onClick={() => {
              elegir(locale)
            }}
            className={cn(
              'flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-transparent bg-surface-2 px-4 py-6',
              'transition-colors hover:border-o-300 hover:bg-o-50',
              'focus-visible:border-o-500 focus-visible:outline-none',
            )}
          >
            <MaterialIcon name="translate" className="size-7 text-o-700" />
            <span className="text-lg font-semibold text-ink">{LOCALE_LABEL[locale]}</span>
          </button>
        ))}
      </div>

      {/* En los dos idiomas: quien lee esto todavía no eligió el suyo. */}
      <p className="mt-4 text-center text-xs text-ink-3">
        <Trans>Puedes cambiarlo después desde tu perfil · You can change this later</Trans>
      </p>
    </Modal>
  )
}
