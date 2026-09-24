import type { CapacitorConfig } from '@capacitor/cli'

/**
 * La app del Colaborador: Capacitor envolviendo el bundle de `@oranje/web`
 * construido con `vite.config.mobile.ts` — solo las rutas `/collaborator/*`.
 * No hay código de UI propio: la app ES la web del Colaborador empaquetada.
 */
const config: CapacitorConfig = {
  appId: 'com.oranjepeople.colaborador',
  appName: 'Oranje Colaborador',

  /* El `dist-mobile` de @oranje/web. Es una referencia a un ARTEFACTO de build,
     no un import de código: la regla «apps/* nunca importa de otro apps/*»
     (README) sigue intacta — aquí no se resuelve ningún módulo. */
  webDir: '../web/dist-mobile',

  server: {
    /*
     * El origen de la app. Capacitor sirve los archivos empaquetados desde
     * aquí —no sale a la red por ellos—, pero ESTE es el `Origin` que el API
     * ve en cada petición, y por tanto lo que hay que autorizar en CORS.
     *
     * Se usa el MISMO host desde el que se sirve la web (`mi.oranjepeople.com`)
     * y no el `localhost` que trae Capacitor de fábrica, por dos razones:
     *
     *   1. Ese origen YA está en la lista blanca del API —se verificó contra
     *      producción: el preflight responde con su `Allow-Origin`—, así que
     *      la app funciona sin tocar la configuración de un servicio en vivo.
     *   2. Autorizar `https://localhost` habría abierto producción a cualquier
     *      página servida desde localhost en la máquina de cualquiera, y con
     *      la cookie en `SameSite=None` esa cookie viajaría.
     *
     * OJO: el nombre queda SOMBREADO dentro de la app — un `fetch` a
     * `https://mi.oranjepeople.com/...` lo atiende el bundle empaquetado, no
     * la red. Hoy no molesta (el API vive en `run.app` y el webmail en otro
     * subdominio), pero implica que desde la app no se puede alcanzar la web
     * real, y que el API no distingue tráfico de app del de navegador: ambos
     * llegan con este mismo `Origin`. Si algún día hace falta separarlos, se
     * cambia este renglón por un subdominio propio y se añade a CORS_ORIGINS.
     */
    hostname: 'mi.oranjepeople.com',

    /*
     * `https` en ambas plataformas, y no el `capacitor://` que iOS usa por
     * defecto, por dos razones: deja UN solo origen —el mismo de la web, ya
     * autorizado— en vez de uno por plataforma, y la cookie del refresh sale
     * del API con `Secure` —obligatorio fuera de local, ver
     * `env.validation.ts`—, que un origen no-https no puede guardar.
     */
    androidScheme: 'https',
    iosScheme: 'https',
  },

  android: {
    /*
     * Android 15 (targetSdk 35, ver `variables.gradle`) fuerza el modo
     * edge-to-edge: sin esto el WebView se dibuja DEBAJO de la barra de estado
     * y de la de gestos, y el encabezado del Colaborador queda tapado por el
     * reloj. Con "auto" Capacitor detecta ese caso y mete los márgenes.
     *
     * Es el valor por defecto; se escribe para que quede constancia de que la
     * barra de estado está considerada y no se llegue a "force" por descarte
     * —"force" añadiría márgenes también en Android viejo, donde el WebView ya
     * nace debajo de la barra, y dejaría una franja vacía—.
     */
    adjustMarginsForEdgeToEdge: 'auto',
  },

  plugins: {
    /*
     * CapacitorHttp queda APAGADO a propósito.
     *
     * Encendido parchea `window.fetch` para salir por el HTTP nativo, lo que
     * resolvería de un golpe el CORS y la cookie de tercero del refresh. Pero
     * el parche no maneja bien `multipart/form-data`, y la foto del ponche se
     * sube justo así (`app/filesApi.ts` arma un `FormData`). Entre romper el
     * refresh —que expulsa cada 15 min, molesto— y romper la subida de la foto
     * —que impide ponchar, que es la razón de ser de la app— se elige lo
     * primero. Ver la nota del README sobre el refresh.
     */
    CapacitorHttp: { enabled: false },
  },
}

export default config
