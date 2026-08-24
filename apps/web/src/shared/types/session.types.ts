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
  /** El código crudo del catálogo D-18 (`ROL-V-01`): la llave para filtrar por rol. */
  roleId: string
  /** Siglas del rol, como se muestran junto al nombre: `BD`. */
  roleCode: string
  /** Nombre largo del rol: `Business Developer`. */
  roleTitle: string
  /**
   * El hotel de la persona (`identity.user.hotel_id`); `null` en roles sin
   * hotel. Es el ALCANCE: un Supervisor solo crea requisiciones de SU hotel.
   */
  hotel: { id: string; name: string } | null
}
