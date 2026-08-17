# Probar el API con Postman

Dos archivos para importar, los dos de esta carpeta:

| Archivo                          | Qué es                                 |
| -------------------------------- | -------------------------------------- |
| `oranje.postman_collection.json` | Los 19 endpoints, agrupados por módulo |
| `local.postman_environment.json` | Las variables para tu máquina          |

En Postman: **Import** → arrastra los dos → arriba a la derecha elige el ambiente
**Oranje · local**.

---

## La forma rápida: sin token

Mientras no exista el proyecto de Firebase, arranca el API con la autenticación
apagada y no necesitas iniciar sesión para nada:

```bash
pnpm db:proxy                       # en otra terminal

cd apps/api
APP_ENV=local AUTH_DISABLED=true AUTH_DEV_USER_EMAIL=dev@oranje.local pnpm dev
```

Todo request entra como ese usuario, **que tiene que existir en `identity.user`**
— así el rol y el alcance son los mismos que tendrías en la nube. Si no existe,
la respuesta lo dice.

> Esto solo funciona con `APP_ENV=local`. En staging o producción la app **no
> arranca** con `AUTH_DISABLED=true`.

## La forma completa: con token

1. Consigue un ID token de Firebase (el SDK del front lo devuelve al hacer login).
2. Pégalo en la variable `firebaseIdToken`.
3. Corre **Auth › Crear sesión**.

El script de la petición guarda el `accessToken` en la colección, y de ahí en
adelante todas las demás lo mandan solas. El refresh viaja en cookie `httpOnly`
y Postman la administra sin que hagas nada.

---

## Por dónde empezar

Las peticiones están en orden y **se encadenan solas**: crear un hotel guarda
`hotelId`, abrir un ciclo guarda `prospectId`, y así. Solo hay una variable que
tienes que llenar a mano la primera vez.

**1. `zoneId`** — sale de los catálogos sembrados:

```bash
pnpm db:studio     # abre catalogs.zone y copia el id de una
```

**2. El recorrido completo**, en este orden:

| #   | Petición                           | Qué deja                     |
| --- | ---------------------------------- | ---------------------------- |
| 1   | Hoteles › Crear                    | `hotelId`                    |
| 2   | Contactos › Agregar                | `contactId`                  |
| 3   | Prospectos › Abrir ciclo comercial | `prospectId`, en GRIS        |
| 4   | Intentos › Registrar               | El primer intento            |
| 5   | Semáforo › Qué puedo hacer ahora   | Los pasos que tu rol permite |
| 6   | Semáforo › Cambiar de estado       | Avanza el ciclo              |
| 7   | Semáforo › Historia                | La timeline completa         |

---

## Los errores que vale la pena provocar

No son fallas: son las reglas del negocio contestando. Todas devuelven la misma
forma, `{ error: { code, message, traceId } }`.

| Qué haces                                | Qué responde                                                  |
| ---------------------------------------- | ------------------------------------------------------------- |
| Abrir un segundo ciclo en el mismo hotel | `409 PROSPECT_ALREADY_OPEN`, con el id del ciclo vivo         |
| Saltar de GRIS a NARANJA                 | `409 TRANSITION_NOT_ALLOWED`, con los destinos que sí existen |
| Pasar a NARANJA siendo BD                | `403 TRANSITION_FORBIDDEN` — solo el BDC convierte (RR-V-01)  |
| Pasar a NARANJA sin Usuario del Hotel    | `422 HOTEL_USER_REQUIRED` (RR-V-02)                           |
| Pasar a ROJO sin motivo                  | `422 REASON_REQUIRED`                                         |
| Borrar un contacto con intentos          | `409 CONTACT_HAS_ATTEMPTS` — desactívalo                      |
| Un contacto sin teléfono ni correo       | `400 VALIDATION_ERROR`                                        |
| `attemptType: "WHATSAPP"`                | `400`, con la lista de canales válidos                        |

Para ver el guard de permisos negando, cámbiale el rol al usuario de desarrollo a
uno sin filas en la Matriz — por ejemplo `ROL-Q-01`, Operador de QA — y vuelve a
intentar cualquier cosa: responde `403 FORBIDDEN`.

---

## Contra staging

Cambia `baseUrl` a `https://oranje-api-endngsd2ra-uc.a.run.app/api/v1`.

Ahí **no hay atajo**: la autenticación es obligatoria. Y mientras el proyecto de
Firebase no esté conectado a ese ambiente, `Crear sesión` responde
`503 LOGIN_NOT_CONFIGURED`, así que por ahora solo los endpoints de salud
responden sin token.
