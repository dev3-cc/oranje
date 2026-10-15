import type { CapacitorConfig } from '@capacitor/cli'

/**
 * La app del Colaborador: Capacitor envolviendo el bundle de `@oranje/web`
 * construido con `vite.config.mobile.ts` — solo las rutas `/collaborator/*`.
 * No hay código de UI propio: la app ES la web del Colaborador empaquetada.
 */
const config: CapacitorConfig = {
  appId: 'com.oranjepeople.colaborador',
  appName: 'Oranje People',

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
     * `https` en Android: el origen queda idéntico al de la web, ya autorizado,
     * y la cookie del refresh —sale del API con `Secure`, ver
     * `env.validation.ts`— se puede guardar.
     *
     * En iOS NO se puede: WKWebView no deja registrar `https` como esquema
     * propio, y Capacitor descarta en silencio un `iosScheme: 'https'` y vuelve
     * a `capacitor://` (`CAPInstanceDescriptor.normalize()`). Por eso no se
     * pone. El origen en iOS es `capacitor://mi.oranjepeople.com`, y está en
     * `CORS_ORIGINS` desde el 2026-09-29.
     */
    androidScheme: 'https',
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

  ios: {
    /*
     * El equivalente en iOS de `adjustMarginsForEdgeToEdge`. Con el valor de
     * fábrica ("never") el WebView ocupa toda la pantalla y el encabezado del
     * Colaborador queda debajo del notch / la Dynamic Island. "always" mete las
     * áreas seguras como inset del scroll nativo: arriba el notch, abajo la
     * barra de inicio.
     *
     * Se resuelve aquí y no con `viewport-fit=cover` + `env(safe-area-inset-*)`
     * por lo mismo que en Android (ver `index.mobile.html`): el HTML de la app
     * es idéntico al de la web y no se toca por una necesidad del móvil.
     */
    contentInset: 'always',
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

    /*
     * El teclado encoge la pantalla de la app (`@capacitor/keyboard`).
     *
     * Con edge-to-edge (Android 15, ver arriba) el sistema ya NO encoge el
     * WebView al abrir el teclado: lo dibuja encima. Un diálogo como el de
     * Nueva requisición dejaba sus campos de abajo y sus botones detrás del
     * teclado, sin forma de llegar a ellos. `resizeOnFullScreen` hace que el
     * plugin encoja el WebView en Android; `resize: 'native'` lo encoge en
     * iOS. Así el contenido se acomoda al espacio libre, como en el navegador.
     */
    Keyboard: { resize: 'native', resizeOnFullScreen: true },
  },
}

export default config
