/**
 * La cuenta con la que firma el propio sistema.
 *
 * Lo que ocurre sin que nadie lo pida —cerrar una asignación temporal cuando
 * vencen sus días— también deja rastro en el journal, y el journal exige un
 * actor. Esta cuenta existe para eso: nace inactiva y sin Firebase, así que no
 * entra a la app; solo firma.
 *
 * Vive aquí y no en el seed para que el servicio que la usa y el seed que la
 * crea no puedan separarse por una errata.
 */
export const SYSTEM_USER_EMAIL = 'sistema@oranjepeople.com'
