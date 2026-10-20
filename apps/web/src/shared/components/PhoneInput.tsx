import { Trans, useLingui } from '@lingui/react/macro'
import { Input, MaterialIcon, Popover, PopoverContent, PopoverTrigger, cn } from '@oranje/ui'
import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

/**
 * Teléfono con selector de país.
 *
 * Antes era un campo de texto suelto donde la persona tenía que escribir su
 * lada, y los datos lo enseñan: de 317 colaboradores en producción, **273
 * quedaron sin lada** y uno llegó a guardarse como `+1 +1 (943) 265-1530`,
 * porque alguien pegó un número que ya la traía y la volvió a teclear.
 *
 * El arreglo es el mismo que usan Amazon y los demás: **la lada no se
 * escribe, se elige**. Lo que la persona teclea son solo los dígitos de su
 * número, y el país viene preseleccionado por el contexto —el hotel donde va
 * a trabajar— así que en la mayoría de los casos no se toca.
 *
 * Tres decisiones que vale la pena conocer:
 *
 * 1. **Guarda E.164** (`+16785551234`), la norma de la ITU: `+`, lada de país
 *    y número, sin espacios ni guiones. En pantalla se formatea al estilo del
 *    país elegido mientras se escribe; lo que viaja al servidor es la norma.
 * 2. **El nombre del país sale de `Intl.DisplayNames`**, no de una lista fija:
 *    así sigue el idioma de la sesión solo, y no hay que mantener 240 nombres
 *    en dos idiomas.
 * 3. **La bandera nunca va sola.** Windows no dibuja las banderas emoji —
 *    muestra las dos letras— así que al lado siempre va la lada (`+1`), que
 *    es el dato que de verdad importa.
 */

/** Dónde opera Oranje: arriba y separados, para no buscar entre 245. */
const FRECUENTES: CountryCode[] = ['US', 'MX']

/* Entre estos —y SOLO estos— se deduce el país de un número sin `+`.
   Son dos a propósito, y la lista larga que se probó primero enseñó por qué:
   con Centroamérica y el Caribe dentro, `998 300 4532` valía como mexicano Y
   como puertorriqueño (dos opciones: deducción cancelada), y peor, al teclear
   `4709065411` el parcial `47090654` coincidía con Guatemala y el país se
   cambiaba solo a media escritura.
   Dejar fuera a los países de +1 no pierde nada: comparten lada, así que el
   E.164 que se guarda es el mismo se elija el que se elija. */
const CANDIDATOS: CountryCode[] = ['US', 'MX']

/** La bandera se deriva de las dos letras del país: no hace falta ninguna imagen. */
function bandera(pais: CountryCode): string {
  return String.fromCodePoint(
    ...[...pais.toUpperCase()].map((letra) => 0x1f1e6 + letra.charCodeAt(0) - 65),
  )
}

/** ¿Alcanza para guardarse? Lo decide la librería, no un mínimo de dígitos inventado. */
export function isCompletePhone(value: string): boolean {
  return parsePhoneNumberFromString(value)?.isValid() ?? false
}

interface Props {
  /** El número en E.164 (`+16785551234`), o vacío. */
  value: string
  /** Devuelve E.164 mientras el número sea válido; si no, lo que se lleva escrito. */
  onChange: (value: string) => void
  ariaLabel?: string
  /**
   * País propuesto cuando el campo está vacío: el del hotel donde va a
   * trabajar la persona. Sin esto cae en `US`, que es donde están 35 de los
   * 37 hoteles.
   */
  defaultCountry?: CountryCode
  disabled?: boolean
}

export function PhoneInput({
  value,
  onChange,
  ariaLabel,
  defaultCountry = 'US',
  disabled = false,
}: Props): ReactNode {
  const { t, i18n } = useLingui()

  /* Desde dónde se deduce. El país del número ya guardado manda sobre el
     propuesto: si el expediente dice +52, el selector abre en México aunque
     el hotel sea de Georgia. Es una REFERENCIA, no el resultado: no se mueve
     al deducir, solo cuando llega un valor nuevo de fuera. */
  const base = useRef<CountryCode>(parsePhoneNumberFromString(value)?.country ?? defaultCountry)

  /** Solo si la persona lo eligió de la lista. Null mientras se deduzca. */
  const [paisManual, setPaisManual] = useState<CountryCode | null>(null)

  /* LA LISTA SOLO EXISTE MIENTRAS EL PANEL ESTÁ ABIERTO.
     Armarla cuesta 64 ms medidos —245 países, cada uno con su nombre de
     `Intl.DisplayNames` y su lada— y un formulario puede tener dos teléfonos.
     Casi nadie abre el selector: el país ya viene puesto. Así que se paga
     cuando se usa y no al dibujar la pantalla.
     Radix monta además un `<select>` nativo oculto con todas las opciones
     para que un formulario nativo pueda enviarlas; aquí el valor no viaja por
     ahí (lo maneja el estado o react-hook-form), así que no se pierde nada. */
  const [abierto, setAbierto] = useState(false)

  const paises = useMemo(() => (abierto ? listarPaises(i18n.locale) : []), [abierto, i18n.locale])

  /* Lo que se escribe para encontrar un país. Se vacía al cerrar: la próxima
     vez se abre en la lista completa, no en la búsqueda de la vez pasada. */
  const [busqueda, setBusqueda] = useState('')

  /* Busca por nombre Y por lada: quien sabe que México es +52 lo escribe así,
     y quien no, escribe «mex». Sin acentos, porque nadie escribe «Perú» con
     tilde en un buscador. */
  const encontrados = useMemo(() => {
    const q = sinAcentos(busqueda)
    if (q === '') return paises

    return paises
      .filter(({ nombre, lada }) => sinAcentos(nombre).includes(q) || `+${lada}`.includes(q))
      .map((p) => ({ ...p, separador: false }))
  }, [paises, busqueda])

  /* LO QUE SE VE ES ESTADO PROPIO, no se deriva de `value` en cada tecla.
     Derivarlo fue un defecto real: `value` alterna entre texto a medias y
     E.164 según se vuelva válido, así que reformatear desde ahí en cada
     pulsación reordenaba lo escrito — tecleando 9981234567 salía
     9293841234567. El campo guarda su propio texto y de él sale el E.164,
     nunca al revés. */
  const [texto, setTexto] = useState(() => mostrar(value, base.current))

  /* Lo último que este campo mandó hacia afuera. Sirve para distinguir un
     cambio que viene de aquí de uno que viene de fuera —cargar un expediente,
     limpiar el formulario— y resincronizar solo en el segundo caso. */
  const emitido = useRef(value)

  /* ¿Lo último que se escribió traía `+`? Entonces el número declara su
     lada y no hay que deducir nada. */
  const conMas = useRef(false)

  useEffect(() => {
    if (value !== emitido.current) {
      emitido.current = value
      /* Un valor que llega de fuera reinicia todo: es otro teléfono, no una
         edición del que estaba. */
      base.current = parsePhoneNumberFromString(value)?.country ?? defaultCountry
      conMas.current = false
      setPaisManual(null)
      setTexto(mostrar(value, base.current))
    }
  }, [value, defaultCountry])

  /* EL PAÍS SE CALCULA, NO SE ACUMULA.
     Guardar el país deducido y volver a deducir desde él fue un defecto real:
     se tecleaba un número de Cancún (pasaba a México, bien), se borraba y se
     escribía uno de Atlanta — que también es válido en México — y se quedaba
     en México, guardando +52 por inercia (Hugo lo vio, 2026-10-19). Ahora
     cada edición se evalúa desde `base`, que no se mueve. */
  const pais = paisManual ?? deducirPais(texto.replace(/\D/g, ''), base.current)

  /** Elegir un país reinterpreta lo ya escrito, no lo borra. */
  function elegirPais(nuevo: CountryCode): void {
    setPaisManual(nuevo)
    setAbierto(false)
    setBusqueda('')
    /* Elegirlo a mano manda sobre cualquier deducción: la persona ya decidió. */
    conMas.current = false
    emitir(texto.replace(/\D/g, ''), nuevo)
  }

  function emitir(digitos: string, paisForzado?: CountryCode): void {
    const efectivo = paisForzado ?? paisManual ?? deducirPais(digitos, base.current)

    setTexto(digitos === '' ? '' : new AsYouType(efectivo).input(digitos))

    const n = digitos === '' ? null : parsePhoneNumberFromString(digitos, efectivo)
    /* Mientras no sea un número completo se devuelven los dígitos tal cual:
       guardar un E.164 a medias sería guardar un número que no existe. */
    const nuevo = digitos === '' ? '' : n?.isValid() ? n.number : digitos

    emitido.current = nuevo
    onChange(nuevo)
  }

  /**
   * ¿El número dice de qué país es?
   *
   * Solo cambia el país cuando el número lo DICE, nunca por parecido:
   *
   * - **Con `+`** no hay nada que deducir: el número declara su lada y se
   *   respeta (alguien pega `+52 998…` desde WhatsApp).
   * - **Sin `+`**, solo si lo escrito es un número COMPLETO que no existe en
   *   el país seleccionado y sí existe en EXACTAMENTE uno de los otros. Por
   *   ejemplo `998 300 4532`: la lada 998 no está asignada en Estados Unidos,
   *   así que es de México y no hay duda.
   *
   * Lo que NO hace: adivinar con un número válido en los dos países. En los
   * datos de producción, 327 de 397 teléfonos servían como estadounidenses y
   * como mexicanos a la vez; cambiar el país ahí sería inventarlo.
   */
  function deducirPais(digitos: string, paisActual: CountryCode): CountryCode {
    if (digitos === '') return paisActual

    if (conMas.current) {
      const n = parsePhoneNumberFromString(`+${digitos}`)
      if (n?.isValid() && n.country) return n.country
      return paisActual
    }

    if (parsePhoneNumberFromString(digitos, paisActual)?.isValid() === true) return paisActual

    const otros = CANDIDATOS.filter(
      (c) => c !== paisActual && parsePhoneNumberFromString(digitos, c)?.isValid() === true,
    )

    return otros.length === 1 ? (otros[0] as CountryCode) : paisActual
  }

  /**
   * Los dígitos que deja una edición. Borrar un caracter de formato —el `)` de
   * `(678)`— no cambiaría ningún dígito y el campo se sentiría atorado, así
   * que ahí se quita el último dígito, que es lo que la persona quiso hacer.
   */
  function digitosTras(bruto: string): string {
    /* Un `+` al principio significa «aquí va la lada»: se recuerda para que
       el número se lea como internacional y no como local del país elegido.
       Pegar `+52 998 300 4532` desde WhatsApp tiene que caer en México. */
    conMas.current = bruto.trim().startsWith('+')

    const nuevos = bruto.replace(/\D/g, '')
    const previos = texto.replace(/\D/g, '')

    if (bruto.length < texto.length && nuevos === previos) return previos.slice(0, -1)

    return nuevos
  }

  return (
    <div className="flex gap-2">
      {/* Popover y no Select: con 245 países hace falta un buscador, y un
          Select de Radix se traga las teclas para su propia búsqueda letra a
          letra — un campo de texto dentro no recibe nada. */}
      <Popover
        open={abierto}
        onOpenChange={(v) => {
          setAbierto(v)
          if (!v) setBusqueda('')
        }}
      >
        {/* El selector se queda angosto y FIJO; todo lo que sobra es para el
            número, que es lo que de verdad se escribe. */}
        <PopoverTrigger
          type="button"
          disabled={disabled}
          aria-label={t`País`}
          className="flex h-9 w-[6.25rem] shrink-0 cursor-pointer items-center justify-between gap-1.5 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="flex items-center gap-1.5 truncate">
            <span aria-hidden="true">{bandera(pais)}</span>
            <span className="tabular-nums">+{getCountryCallingCode(pais)}</span>
          </span>
          <MaterialIcon name="expand_more" className="size-4 opacity-50" />
        </PopoverTrigger>

        {/* El scroll va en el PANEL, no en un div de adentro: el popover vive
            en un portal fuera del diálogo, y el bloqueo de scroll que Radix
            pone mientras un diálogo está abierto se come la rueda sobre
            cualquier otro contenedor. `overscroll-contain` evita además que
            al llegar al final se empiece a mover la pantalla de atrás. */}
        <PopoverContent
          align="start"
          className="flex max-h-[22rem] w-[20rem] flex-col overflow-hidden p-0"
        >
          <div className="shrink-0 border-b p-2">
            <Input
              autoFocus
              value={busqueda}
              onChange={(event) => {
                setBusqueda(event.target.value)
              }}
              onKeyDown={(event) => {
                /* Enter elige el primero: escribir «mex» y confirmar sin
                   soltar el teclado es más rápido que buscar con el ratón. */
                if (event.key === 'Enter' && encontrados[0]) {
                  event.preventDefault()
                  elegirPais(encontrados[0].codigo)
                }
              }}
              aria-label={t`Busca el país`}
              placeholder={t`País o lada: México, +52…`}
            />
          </div>

          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1"
            /* LA RUEDA SE MUEVE A MANO, a propósito.
               Mientras un diálogo de Radix está abierto, su bloqueo de scroll
               (`react-remove-scroll`) cancela la rueda en todo lo que no sea
               el propio diálogo. Este panel vive en OTRO portal, así que la
               lista quedaba inmóvil aunque tuviera `overflow-y-auto` — dos
               intentos de arreglarlo con CSS no sirvieron (Hugo, 2026-10-19).
               Se desplaza el contenedor directamente y se corta el evento
               ahí, para que el bloqueo no tenga nada que cancelar. */
            onWheel={(event) => {
              event.currentTarget.scrollTop += event.deltaY
              event.stopPropagation()
            }}
          >
            {encontrados.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-ink-3">
                <Trans>Ningún país se llama así</Trans>
              </p>
            ) : (
              encontrados.map(({ codigo, nombre, lada, separador }) => (
                <button
                  key={codigo}
                  type="button"
                  onClick={() => {
                    elegirPais(codigo)
                  }}
                  className={cn(
                    'flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent',
                    codigo === pais && 'bg-o-50 font-semibold',
                    separador && 'mt-1 border-t pt-2',
                  )}
                >
                  <span aria-hidden="true">{bandera(codigo)}</span>
                  <span className="flex-1 truncate">{nombre}</span>
                  <span className="text-ink-3 tabular-nums">+{lada}</span>
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Input
        value={texto}
        disabled={disabled}
        className="min-w-0 flex-1"
        onChange={(event) => {
          emitir(digitosTras(event.target.value))
        }}
        inputMode="tel"
        autoComplete="tel-national"
        aria-label={ariaLabel ?? t`Teléfono`}
        placeholder={ejemplo(pais)}
      />
    </div>
  )
}

/**
 * Los países, con los de Oranje arriba. El nombre lo pone el navegador en el
 * idioma de la sesión; si no lo conoce, se queda el código, que sigue siendo
 * útil.
 */
function listarPaises(
  locale: string,
): { codigo: CountryCode; nombre: string; lada: string; separador: boolean }[] {
  const nombres = new Intl.DisplayNames([locale], { type: 'region' })
  const describir = (
    codigo: CountryCode,
  ): { codigo: CountryCode; nombre: string; lada: string } => ({
    codigo,
    nombre: nombres.of(codigo) ?? codigo,
    lada: getCountryCallingCode(codigo),
  })

  const resto = getCountries()
    .filter((c) => !FRECUENTES.includes(c))
    .map(describir)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, locale))

  return [
    ...FRECUENTES.map((c) => ({ ...describir(c), separador: false })),
    ...resto.map((c, i) => ({ ...c, separador: i === 0 })),
  ]
}

/** Un número de ejemplo del país, para que el formato se vea antes de escribir. */
function ejemplo(pais: CountryCode): string {
  const muestra = { US: '(678) 555-1234', MX: '998 123 4567' }[pais as string]

  return muestra ?? new AsYouType(pais).input('5551234567')
}

/**
 * Cómo se ve un valor que llega de fuera: solo la parte nacional y con el
 * formato del país. La lada no se repite en el campo — ya está en el selector.
 */
function mostrar(valor: string, pais: CountryCode): string {
  if (valor.trim() === '') return ''

  const n = parsePhoneNumberFromString(valor)
  if (n?.isValid()) return n.formatNational()

  /* Un valor sin normalizar de los que hay hoy en la base: se enseña con el
     mismo formato, para que no se vea distinto de los demás. */
  return new AsYouType(pais).input(quitarLada(valor, pais).replace(/\D/g, ''))
}

/**
 * Un valor viejo sin normalizar puede traer su lada pegada (`+1 6785551234`).
 * Se le quita para no repetirla en pantalla junto a la del selector.
 */
function quitarLada(valor: string, pais: CountryCode): string {
  const lada = getCountryCallingCode(pais)
  const limpio = valor.trim()

  if (limpio.startsWith(`+${lada}`)) return limpio.slice(lada.length + 1)
  if (limpio.startsWith('+')) return limpio.replace(/^\+\d{1,3}/, '')

  return limpio
}

/** Para buscar: «peru» encuentra «Perú», y «mexico» encuentra «México». */
function sinAcentos(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Un teléfono a E.164, o tal cual si no se puede leer.
 *
 * Para los que NO se capturan a mano —el de Google Places, por ejemplo—, que
 * llegan con el formato del país y tienen que guardarse en la norma.
 * Devolver el original cuando no se entiende es deliberado: inventarle un
 * formato lo haría parecer correcto, y perderlo sería peor.
 */
export function aE164(valor: string, paisPorDefecto: CountryCode = 'US'): string {
  const n = parsePhoneNumberFromString(valor, paisPorDefecto)

  return n?.isValid() === true ? n.number : valor
}
