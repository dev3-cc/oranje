import config from '@oranje/config/eslint'

/**
 * Config de la raíz. Existe para que lint-staged pueda correr `eslint` sobre
 * cualquier archivo staged sin importar en qué paquete viva.
 * Los paquetes tienen su propio eslint.config.mjs, que reexporta esta misma.
 */
export default config
