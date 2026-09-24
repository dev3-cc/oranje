# @oranje/mobile — la app del Colaborador

Android e iOS. **No hay UI propia aquí**: la app es el apartado del Colaborador
de `@oranje/web` (`features/worker`, las rutas `/collaborator/*`) empaquetado
con Capacitor. Un cambio en esas pantallas llega a la app con un `sync`, sin
tocar nada de esta carpeta.

Se eligió Capacitor sobre React Native —que es lo que decía el README de la
raíz— porque el Colaborador ya estaba escrito y probado como web responsive:
[`MobileShell`](../web/src/features/worker/components/MobileShell.tsx) ya era
una columna de 420 px con pestañas y deslizamiento. Reescribirlo en RN era
tirar 27 archivos para quedar con dos interfaces que mantener a la par — la web
no se puede apagar, porque los QR impresos en los hoteles apuntan a ella.

## Compilar

```bash
pnpm -F @oranje/mobile sync    # build del bundle + copiar a android/ e ios/
pnpm -F @oranje/mobile apk     # APK de debug (Android)
```

El APK sale en `android/app/build/outputs/apk/debug/app-debug.apk`.

`scripts/gradle.mjs` resuelve solo el JDK y el SDK: en Windows el `java` del
PATH suele ser un JRE viejo, y el plugin de Android pide 17+. Usa el JDK que
trae Android Studio (`jbr`) y el SDK donde Studio lo deja.

### iOS

**El `.ipa` no se puede generar en Windows.** El proyecto de Xcode está
completo y configurado en `ios/`, pero compilarlo exige macOS. En un Mac:

```bash
pnpm -F @oranje/mobile sync
cd apps/mobile/ios/App && pod install
pnpm -F @oranje/mobile open:ios          # y Archive desde Xcode
```

Falta ahí lo que solo se puede hacer con una cuenta de Apple Developer: el
equipo de firma y el perfil de aprovisionamiento.

## Qué se empaqueta

El bundle sale de [`vite.config.mobile.ts`](../web/vite.config.mobile.ts), que
entra por [`src/mobile/main.tsx`](../web/src/mobile/main.tsx) y monta
[`src/mobile/router.tsx`](../web/src/mobile/router.tsx) — solo las rutas del
Colaborador. El staff no entra: sin `AppShell`, sin sidebar, sin los 25 módulos.

|                  | web (`dist/`) | app (`dist-mobile/`) |
| ---------------- | ------------- | -------------------- |
| Peso del bundle  | 34.4 MB       | **5.0 MB**           |
| three.js, globo  | sí            | no                   |
| recharts         | sí            | no                   |
| APK resultante   | —             | 7.7 MB               |

`app/providers.tsx` **no** se reusa: importa el router del staff en el tope, y
un import estático entra al bundle aunque la ruta sea inalcanzable. Por eso el
entry móvil compone sus tres providers a mano.

## Permisos

Declarados en [`AndroidManifest.xml`](android/app/src/main/AndroidManifest.xml)
y en [`Info.plist`](ios/App/App/Info.plist):

| Permiso   | Para qué                                                       |
| --------- | -------------------------------------------------------------- |
| Cámara    | La selfie de Entrada/Salida y el lector del QR del acceso       |
| Ubicación | La geocerca del ponche — el servidor decide, el teléfono ubica  |
| Vibración | La confirmación de la marca (Android)                          |

La cámara y el GPS entran por las APIs web de siempre (`getUserMedia`,
`navigator.geolocation`): el WebView de Capacitor las atiende y pide el permiso
en tiempo de ejecución. **No hizo falta ningún plugin ni cambiar el código del
worker.**

---

## El origen de la app y el CORS

La app se sirve desde `https://mi.oranjepeople.com` — **el mismo host que la
web**, configurado en `capacitor.config.ts`. Eso no es casual: ese origen ya
está en la lista blanca del API, verificado contra producción:

| Origen probado                         | Preflight a `/auth/session`        |
| -------------------------------------- | ---------------------------------- |
| `https://mi.oranjepeople.com`          | `Allow-Origin` presente ✅          |
| `https://colaborador.oranjepeople.com` | sin `Allow-Origin` ❌               |
| `https://localhost` (el de fábrica)    | sin `Allow-Origin` ❌               |

**No hay que tocar `CORS_ORIGINS`**, que se inyecta al desplegar desde una
variable de GitHub Actions ([`deploy.yml`](../../.github/workflows/deploy.yml))
y habría exigido un redespliegue del API.

Los dos esquemas son `https` (iOS no usa su `capacitor://` de fábrica) para que
Android e iOS compartan un único origen.

> **Efecto secundario a tener presente:** dentro de la app ese host queda
> sombreado — un `fetch` a `https://mi.oranjepeople.com/…` lo atiende el bundle
> empaquetado, no la red. Hoy es inofensivo (el API vive en `run.app` y el
> webmail en otro subdominio), pero implica que desde la app no se alcanza la
> web real, y que el API no distingue el tráfico de la app del del navegador:
> ambos llegan con el mismo `Origin`. Si hiciera falta separarlos, se cambia el
> `hostname` por un subdominio propio y se añade a `CORS_ORIGINS`.

### Si hace falta en Firebase

El login usa Firebase Auth con correo y contraseña, que pega contra la API REST
de Identity Toolkit y **no** depende de los dominios autorizados. Si aun así el
login devolviera `auth/unauthorized-domain`, añadir el host en la consola de
Firebase → Authentication → Settings → Authorized domains.

## ⚠️ Pendiente antes de publicar: el refresh de 15 minutos

**Esto no está resuelto y hay que probarlo en dispositivo.**

El access token vive 15 minutos y se renueva con la cookie `oranje_refresh`
(`httpOnly`, `SameSite=None; Secure`) contra `POST /auth/refresh`. En el
navegador funciona. Dentro de la app el origen pasa a ser `https://localhost`,
así que esa cookie es **de tercero** — y WKWebView (iOS) la bloquea por ITP
aunque venga con `SameSite=None`.

Si se confirma, el síntoma es:

1. El login entra bien — el access token viaja en el **body**, no en la cookie.
2. Quince minutos después, el refresh falla y `RequireSession` manda al login.
3. Vuelve a entrar… y a los quince minutos, otra vez.

Un bucle de expulsión con la contraseña de por medio, en plena jornada.

**Por qué no se arregló aquí:** las dos salidas caen fuera del worker.

- Activar `CapacitorHttp` (peticiones por el HTTP nativo, con su propio cookie
  jar) se probó y **se descartó**: su parche de `fetch` no maneja
  `multipart/form-data`, y la foto del ponche se sube justo así
  ([`filesApi.ts`](../web/src/app/filesApi.ts)). Rompería el ponche entero.
  Queda apagado explícitamente en `capacitor.config.ts`.
- Aceptar el refresh por body y guardarlo en Keychain/Keystore toca `apps/api`
  y `app/baseApi.ts`, que son del staff tanto como del Colaborador.

**Siguiente paso:** instalar el APK, entrar y esperar 16 minutos. Si la sesión
sobrevive, no hay nada que hacer. Si expulsa, hay que decidir una de las dos
salidas de arriba — y esa decisión cruza la frontera del worker.

## Lo demás que falta para tienda

- **Iconos y splash** — hoy son los de Capacitor por defecto.
- **Deep links de los QR impresos.** Los códigos pegados en los hoteles apuntan
  a `/colaborador/ponchar?qr=…`. El router móvil ya los redirige conservando el
  `?qr=`, pero para que el QR abra la **app** y no el navegador faltan el
  `apple-app-site-association` y el `assetlinks.json` en el Hosting, más
  `@capacitor/app` escuchando `appUrlOpen`. Sin esto el QR sigue funcionando en
  el navegador: degrada limpio, no se rompe.
- **Push.** El FCM web no existe en WKWebView; hace falta el plugin nativo.
- **Firma de release** — keystore de Android y perfil de Apple.
