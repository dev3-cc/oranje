/**
 * `true` SOLO en `vite dev` (local). Cualquier build —staging, producción—
 * lo apaga: Vite fija `import.meta.env.DEV` en build-time.
 *
 * Controla las anotaciones de esquema de la UI (chips NOT NULL, nombres de
 * columna bajo los inputs, sufijos `· commercial.hotel`): son documentación
 * viva para desarrollar contra la base, no parte del producto que ve un BD.
 */
export const IS_DEV_UI = import.meta.env.DEV
