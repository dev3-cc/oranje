/**
 * Quién tiene la sesión abierta.
 *
 * Firebase Auth es la autoridad de identidad (D-05), pero el rol y su nombre
 * visible viven en Postgres: el token dice quién eres, no qué puedes hacer.
 */
export interface SessionUser {
  id: string
  /** Nombre completo: `Ana Ruiz`. */
  name: string
  /** Forma corta para espacios estrechos: `A. Ruiz`. */
  shortName: string
  /** Siglas del rol, como se muestran junto al nombre: `BD`. */
  roleCode: string
  /** Nombre largo del rol: `Business Developer`. */
  roleTitle: string
}
