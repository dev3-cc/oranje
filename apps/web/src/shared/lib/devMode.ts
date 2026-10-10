/**
 * `true` SOLO en `vite dev` (local). Cualquier build —staging, producción—
 * lo apaga: Vite fija `import.meta.env.DEV` en build-time.
 *
 * Controla las anotaciones de esquema de la UI (chips NOT NULL, nombres de
 * columna bajo los inputs, sufijos `· commercial.hotel`): son documentación
 * viva para desarrollar contra la base, no parte del producto que ve un BD.
 */
export const IS_DEV_UI = import.meta.env.DEV

/**
 * `true` en `vite dev` local Y en el build de staging (`--mode staging`);
 * `false` en el de producción (Hugo, 2026-10-09: una vista previa de
 * dinero —cuánto se le paga a una posición— se enseña mientras se prueba,
 * pero no al cliente final en producción). `import.meta.env.MODE` es el
 * nombre que Vite fija según `--mode`, sin variable propia que mantener.
 */
export const IS_DEV_OR_STAGING_UI = import.meta.env.DEV || import.meta.env.MODE === 'staging'
