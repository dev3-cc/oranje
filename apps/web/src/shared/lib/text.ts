/**
 * Minúsculas y sin acentos, para comparar lo que la persona teclea con lo que
 * hay en la lista: «bahia» encuentra «Bahía» y «beltran», «Beltrán».
 *
 * Vivía copiado en tres APIs (clientes, territorio, contratos); aquí es uno.
 */
export function normalizeText(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * `true` si alguno de los campos contiene el término; sin término, todo pasa.
 * Es el criterio de los buscadores EN MEMORIA (catálogos, plantel, equipo,
 * cola de conversión, tablero de requisiciones) y de los mocks que imitan al
 * `?search=` del back.
 */
export function matchesSearch(term: string, ...fields: Array<string | null | undefined>): boolean {
  const needle = normalizeText(term).trim()
  if (needle === '') return true
  return fields.some((field) => field != null && normalizeText(field).includes(needle))
}
