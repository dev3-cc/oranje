---
tags:
  - arquitectura
  - global
  - ingenieria
aliases:
  - Estándares de Desarrollo
  - Convenciones de Ingeniería
  - Guía del Equipo Técnico
---

# Estándares de Desarrollo

Reglas de proceso del equipo técnico de Oranje: Git, revisión de código, API, base de datos, seguridad, testing, herramientas y criterios de terminado. Complementa a [[Estructura de Proyecto y Nomenclatura]], que cubre la organización física del código.

> [!info]
> Este documento describe **cómo trabajamos**. Es de cumplimiento obligatorio y se hace cumplir por automatización (linters, hooks, CI) siempre que sea posible: una regla que solo vive en un documento se rompe sola.

---

## 1. Git y ramas

### Modelo de ramas

**Dos ramas principales, y cada una lleva el nombre del ambiente al que despliega.**

| Rama                                                        | Propósito                                                           | Protegida |
| ----------------------------------------------------------- | ------------------------------------------------------------------- | --------- |
| `main`                                                      | Producción. Siempre desplegable                                     | Sí        |
| `staging`                                                   | Integración de la iteración en curso. Despliega a `oranje-staging`  | Sí        |
| `feature/…` · `fix/…` · `refactor/…` · `chore/…` · `docs/…` | Trabajo individual, sale de `staging`                               | No        |
| `hotfix/…`                                                  | Corrección urgente, sale de `main` y se mergea a `main` y `staging` | No        |

Nadie hace push directo a `main` ni a `staging`. Todo entra por Pull Request.

> [!note] Por qué `staging` y no `develop`
> La rama se llama como el ambiente al que despliega. Antes se llamaba `develop`
> y la §11 tenía que explicar que _"`develop` despliega a staging"_ — una
> indirección que no compraba nada y que obligaba a traducir cada vez.
>
> Con dos ramas y dos ambientes con pipeline, la correspondencia es 1 a 1:
> `staging → oranje-staging`, `main → oranje-prod`. El tercer ambiente,
> `oranje-dev`, no tiene rama porque **no tiene disparador**: es el local.
>
> Lo que no cambia: `staging` sigue siendo la rama de integración. Que se llame
> como el ambiente no la convierte en un ambiente.

### Nombre de rama

```
tipo/RF-X-NN-descripcion-corta
```

```
feat/RF-H-05-authorize-requisition
fix/RF-R-12-worker-pool-filter
chore/config-eslint-monorepo
```

El identificador del requerimiento (`RF-H-05`) va en el nombre siempre que exista. Es lo que permite rastrear una línea de código hasta la regla de negocio que la originó.

### Commits — Conventional Commits

```
tipo(alcance): descripción en imperativo

[cuerpo opcional]

Refs: RF-H-05
```

| Tipo           | Uso                                       |
| -------------- | ----------------------------------------- |
| `feat`         | Nueva funcionalidad                       |
| `fix`          | Corrección de defecto                     |
| `refactor`     | Cambio interno sin alterar comportamiento |
| `perf`         | Mejora de rendimiento                     |
| `test`         | Solo pruebas                              |
| `docs`         | Solo documentación                        |
| `chore`        | Configuración, dependencias, tooling      |
| `build` / `ci` | Empaquetado o pipelines                   |

El **alcance** es el módulo: `feat(requisitions):`, `fix(timesheet):`, `chore(web):`.

```
feat(requisitions): autorizar requisición y calcular semáforo de urgencia

Al autorizar se dispara requisition.authorized, que reserva las
posiciones en el Schedule del hotel.

Refs: RF-H-05, RF-H-08, RF-H-10
```

Reglas: descripción en minúscula, imperativo (`agrega`, no `agregado`), sin punto final, máximo 72 caracteres en el asunto. Lo valida `commitlint`; un commit mal formado no entra.

---

## 2. Pull Requests

### Requisitos para abrir

- Título con el mismo formato del commit convencional.
- Descripción con: qué cambia, qué RF implementa, cómo probarlo y capturas si toca UI.
- CI en verde (lint + typecheck + tests + build).
- Sin conflictos con `staging`.

### Requisitos para mergear

| Regla                | Valor                                                        |
| -------------------- | ------------------------------------------------------------ |
| Aprobaciones mínimas | 1 (2 si toca semáforos, permisos, migraciones o liquidación) |
| Tamaño recomendado   | Menos de 400 líneas modificadas                              |
| Estrategia de merge  | **Squash and merge** — un commit por PR en `staging`         |
| Rama tras el merge   | Se borra                                                     |

### Plantilla de PR

```markdown
## Qué cambia

<!-- 2-3 líneas -->

## Requerimientos

Refs: RF-H-05, RR-H-02

## Cómo probar

1.
2.

## Checklist

- [ ] Reglas de negocio verificadas contra el vault
- [ ] Sin transiciones de semáforo no documentadas
- [ ] Tests agregados o actualizados
- [ ] Migración incluida y reversible (si aplica)
- [ ] Matriz de Permisos respetada
```

> [!important] Cómo se hace cumplir de verdad, y qué no puede
> `main` y `staging` están protegidas en GitHub desde el 2026-08-07: PR
> obligatorio, 1 aprobación, CI en verde (`verificar`), sin force push, sin
> borrado, historial lineal y conversaciones resueltas.
>
> **Lo que GitHub no puede hacer:** exigir _"2 aprobaciones solo si el PR toca
> semáforos"_. El contador de aprobaciones es **global por rama**, no por ruta.
> Lo más cercano es `.github/CODEOWNERS`, que fuerza la revisión de un dueño
> específico en esas rutas y suma un revisor encima del mínimo. Está configurado
> para semáforos, permisos, `prisma/`, `settlement/` y la propia herramienta.
>
> **`enforce_admins` quedó en `false` a propósito.** GitHub no deja aprobar tu
> propio PR: con un solo colaborador, activarlo dejaría el repositorio sin forma
> de mergear nada. Se enciende cuando haya un segundo revisor — y hasta entonces
> _"nadie hace push directo"_ es disciplina, no una barrera técnica.

### Revisión de código

Quien revisa comenta sobre el código, no sobre la persona. Se distingue lo bloqueante de lo opcional con prefijos: `bloqueante:`, `sugerencia:`, `pregunta:`, `nit:`. Un `nit:` nunca detiene un merge.

---

## 3. Trazabilidad requerimiento ↔ código

Es el estándar más específico de este proyecto y el que más valor da a largo plazo: `Arquitecturas/` ya define ~300 requerimientos con ID. Esos IDs deben sobrevivir hasta el código.

| Artefacto                      | Dónde va el ID                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| Rama                           | En el nombre                                                                        |
| Commit                         | Línea `Refs:`                                                                       |
| PR                             | Sección Requerimientos                                                              |
| Endpoint                       | Decorador `@ApiOperation({ summary: 'RF-H-05 · Autorizar requisición' })`           |
| Regla de negocio en el service | Comentario `// RR-H-02: …` sobre la validación que la implementa                    |
| Test                           | Nombre del caso: `it('RF-H-05 · rechaza autorizar una requisición sin posiciones')` |

```ts
// RR-H-02: solo el Manager de Área autoriza, y únicamente
// requisiciones en Verde manzana con al menos una posición.
if (requisition.statusLight !== RequisitionStatusLight.APPLE_GREEN) {
  throw new ConflictException('REQUISITION_INVALID_STATE')
}
```

> [!important]
> Es la única categoría de comentario que se exige. El resto del código se explica por sus nombres; un comentario que repite lo que hace la línea siguiente se elimina en review.

---

## 4. API REST

### Convenciones

| Tema             | Regla                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| Prefijo          | `/api/v1` — versión en la ruta                                                                          |
| Recursos         | Sustantivo plural en `kebab-case`: `/requisitions`, `/work-accidents`                                   |
| Anidamiento      | Máximo un nivel: `/requisitions/:id/positions`                                                          |
| Acciones no CRUD | Subrecurso con verbo: `POST /requisitions/:id/authorize`                                                |
| Filtros          | Query params: `?statusLight=YELLOW&zoneId=…&page=1&limit=20`                                            |
| Formato          | JSON, `camelCase` en las llaves                                                                         |
| Fechas           | ISO 8601 en UTC: `2026-07-29T14:30:00Z`                                                                 |
| IDs              | UUID v7                                                                                                 |
| Idioma           | **Recursos, campos y códigos de error en inglés** (D-11 y [[Estructura de Proyecto y Nomenclatura]] §8) |

> [!important] Identificadores en inglés, textos en español
> La frontera no es "el código en inglés" sino **qué lo lee**:
>
> | Va en inglés                                                       | Va en español                                                |
> | ------------------------------------------------------------------ | ------------------------------------------------------------ |
> | Rutas, campos JSON, códigos de error (`REQUISITION_INVALID_STATE`) | `summary` de OpenAPI, mensajes de error visibles al usuario  |
> | Clases, métodos, variables, ramas de Git                           | Descripciones de test, comentarios, asunto del commit        |
> | Esquemas, tablas y columnas de Postgres                            | Los IDs de requerimiento (`RF-H-05`) y los nombres del vault |
>
> Un `it('RF-H-05 · rechaza autorizar una requisición sin posiciones')` se queda tal cual: es la regla del vault citada, y traducirla rompe el puente que hace útil el nombre del test cuando falla.

### Códigos de estado

| Código | Cuándo                                                    |
| ------ | --------------------------------------------------------- |
| `200`  | GET, PATCH, acción con respuesta                          |
| `201`  | POST que crea recurso                                     |
| `204`  | DELETE exitoso                                            |
| `400`  | Body o params inválidos                                   |
| `401`  | Sin autenticar                                            |
| `403`  | Autenticado pero sin permiso (Matriz de Permisos)         |
| `404`  | Recurso inexistente                                       |
| `409`  | Conflicto de estado (transición de semáforo no permitida) |
| `422`  | Válido sintácticamente pero viola una regla de negocio    |

### Formato de respuesta

Éxito, colección paginada:

```json
{
  "data": [ … ],
  "meta": { "page": 1, "limit": 20, "total": 137, "totalPages": 7 }
}
```

Error, siempre la misma forma:

```json
{
  "error": {
    "code": "REQUISITION_INVALID_STATE",
    "message": "La requisición no está en estado Verde manzana",
    "details": [{ "field": "statusLight", "value": "YELLOW" }],
    "traceId": "01J8X…"
  }
}
```

`code` es `UPPER_SNAKE_CASE`, estable y catalogado; el frontend decide qué mostrar a partir de él, nunca del `message`. Los mensajes al usuario se escriben en español.

---

## 5. Base de datos

Las convenciones de esquema —nomenclatura, tipos canónicos, restricciones, índices, migraciones, crecimiento y seguridad de los datos— viven en **[[Estándares de Base de Datos]]**. No se duplican aquí.

Lo que sí es proceso de este documento:

- Una migración por PR, generada con `prisma migrate dev` y commiteada. **Nunca** se edita el esquema de producción a mano.
- Toda migración es reversible, o el PR explica por qué no.
- Los cambios destructivos van por **expandir y contraer**, nunca en un solo despliegue.
- Los datos semilla de catálogos ([[Posiciones]], [[Zonas]], [[Niveles de Inglés]]) viven en `prisma/seed.ts`, versionado.
- Un PR que toca el esquema pasa el checklist de [[Estándares de Base de Datos]] §14.

> [!warning]
> Un cambio en un estado de semáforo toca `catalogs.status_light_state`, `packages/domain`, la validación de transiciones y la UI. Se hace **en un solo PR** y requiere dos aprobaciones.

---

## 6. Autenticación, permisos y seguridad

| Tema             | Regla                                                                                |
| ---------------- | ------------------------------------------------------------------------------------ |
| Autenticación    | JWT de acceso (15 min) + refresh token (7 días) en cookie `httpOnly`                 |
| Contraseñas      | `argon2id`. Nunca en logs, nunca en respuestas                                       |
| Autorización     | Guard de Nest que lee la Matriz de Permisos de `packages/domain`                     |
| Validación       | Zod en el pipe global. Ningún body llega a un controller sin validar                 |
| Secretos         | Solo por variables de entorno. Ningún `.env` en el repositorio                       |
| Rate limiting    | Global, y estricto en login y en el ponche del Timesheet                             |
| CORS             | Lista blanca explícita de orígenes                                                   |
| Datos personales | Los del Colaborador son datos personales: acceso registrado en bitácora de auditoría |

```ts
@Post(':id/authorize')
@Roles(Rol.MANAGER_AREA)      // RF-H-05 · Matriz de Permisos Hotel
authorize(@Param('id') id: string) { … }
```

> [!important]
> El frontend oculta lo que el rol no puede hacer, pero **ocultar no es autorizar**. Toda acción se valida también en el backend. Un botón escondido no es un control de seguridad.

---

## 7. Manejo de errores y logging

- Excepciones tipadas del dominio (`RequisitionInvalidStateException`), capturadas por un filtro global que las traduce al formato de error de la sección 4.
- **Logging estructurado en JSON** con `pino`. Nada de `console.log` en código que se mergea.
- `traceId` por request, propagado en el header de respuesta y presente en todo log de esa petición.
- Niveles: `error` (requiere acción), `warn` (anómalo pero manejado), `info` (evento de negocio: requisición autorizada, colaborador asignado), `debug` (solo local).
- **Nunca se loguean** contraseñas, tokens, ni datos personales completos del Colaborador.

---

## 8. Testing

| Nivel        | Herramienta           | Qué cubre                                    | Mínimo                       |
| ------------ | --------------------- | -------------------------------------------- | ---------------------------- |
| Unitarias    | Jest / Vitest         | Services, transiciones de semáforo, cálculos | Cobertura de services ≥ 70 % |
| Integración  | Jest + Testcontainers | Repositorios contra Postgres real            | Flujos críticos              |
| E2E API      | Supertest             | Endpoints con auth y permisos                | Todo endpoint de escritura   |
| Concurrencia | Jest + Testcontainers | Invariantes bajo peticiones simultáneas      | Self-Pick y asignación       |
| Componentes  | Testing Library       | Componentes con lógica                       | Los que tienen estado        |

### Los dos tests que sostienen el sistema

Ambos cubren lógica que **falla en silencio**: no lanzan excepción, no aparecen en los logs de error y solo se descubren cuando alguien reclama.

**Concurrencia del Self-Pick.** [[Decisiones de Arquitectura]] D-02 resuelve el bloqueo con `SELECT ... FOR UPDATE SKIP LOCKED`. Esa garantía necesita un test que dispare N peticiones de asignación en paralelo sobre la misma posición y afirme que **exactamente una** gana y el resto recibe `409`. Un test secuencial no prueba nada aquí: el caso que importa solo existe con peticiones simultáneas.

```ts
it('RR-15 · con 10 asignaciones simultáneas a la misma posición, solo una gana', async () => {
  const intentos = await Promise.allSettled(
    Array.from({ length: 10 }, () => assignWorker(positionId, workerId)),
  )
  expect(intentos.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
})
```

**Cálculo de nómina (golden test).** Una semana fija de ponches de referencia —con lunch, turnos partidos y cambio de horario— contra un monto exacto esperado. Es la única defensa real contra lo que advierte D-07: un error de cálculo de nómina no lanza excepción, paga mal y nadie se entera. El set de referencia se versiona y **no se ajusta para que pase el test**: si el monto cambia, se justifica en el PR contra la regla de negocio que lo cambió.

### Datos de prueba

- Los seeds de catálogos ([[Posiciones]], [[Zonas]], [[Niveles de Inglés]]) viven en `prisma/seed.ts` (sección 5).
- **Ningún ambiente que no sea producción contiene SSN, ITIN ni datos personales reales del [[Colaborador/Colaborador|Colaborador]].** Staging se puebla con un seed anonimizado, generado, nunca con un dump de producción.
- Si se necesita reproducir un caso real en staging, se replica la **forma** de los datos, no los datos.

> [!warning]
> Copiar la base de producción a staging es la vía más rápida a una fuga de datos fiscales. Está prohibido, incluso para depurar.

### Reglas

- **Toda transición de semáforo tiene test.** Es la lógica más crítica del sistema y la que más cara sale si se rompe.
- **Toda regla de la Matriz de Permisos tiene test negativo**: un rol sin permiso recibe `403`.
- Un `fix` no se mergea sin un test que falle antes del arreglo y pase después.
- Nombres descriptivos con el ID: `it('RF-H-05 · rechaza autorizar si el rol no es Manager de Área')`.
- Sin `sleep` ni esperas por tiempo; sin tests que dependan del orden de ejecución.

---

## 9. Herramientas y calidad

| Herramienta                   | Función                                                    |
| ----------------------------- | ---------------------------------------------------------- |
| **TypeScript** `strict: true` | Obligatorio. `any` prohibido salvo justificación comentada |
| **ESLint**                    | Config compartida en `packages/config`                     |
| **Prettier**                  | Formato. No se discute formato en review                   |
| **Husky** + **lint-staged**   | Pre-commit: lint y format sobre lo staged                  |
| **commitlint**                | Valida el mensaje de commit                                |
| **CI (GitHub Actions)**       | `lint → typecheck → test → build` en cada PR               |

Reglas de ESLint que sí bloquean: sin imports relativos que suban de nivel, sin variables sin usar, sin `console.log`, orden de imports, sin dependencias circulares.

### Configuración por entorno

Toda variable de entorno se declara y valida al arranque con Zod. Si falta una, la app **no levanta** — falla en el arranque, no a media operación.

```
.env.example      # commiteado, con todas las claves y valores de ejemplo
.env.local        # ignorado por git
```

---

## 10. Documentación técnica

| Qué                        | Dónde                                           | Cuándo                                                             |
| -------------------------- | ----------------------------------------------- | ------------------------------------------------------------------ |
| API                        | **Swagger/OpenAPI** autogenerado en `/api/docs` | Todo endpoint con `@ApiOperation` y su RF                          |
| Decisiones de arquitectura | **ADR** en `docs/adr/NNNN-titulo.md`            | Toda decisión con consecuencias difíciles de revertir              |
| Componentes UI             | **Storybook** en `packages/ui`                  | Todo componente compartido                                         |
| Arranque del proyecto      | `README.md` de la raíz                          | Se actualiza si cambia un paso de setup                            |
| Negocio                    | Este vault                                      | La documentación de negocio **no se duplica en el repo de código** |

Formato de ADR: contexto, decisión, alternativas consideradas, consecuencias. Un ADR nunca se borra ni se reescribe: si se revierte una decisión, se escribe uno nuevo que reemplaza al anterior.

---

## 11. Versionado y despliegue

### Ambientes

[[Decisiones de Arquitectura]] D-06 define un proyecto de GCP por ambiente. Cada uno con su disparador:

| Ambiente   | Proyecto GCP     | Qué lo despliega  | Para qué                            |
| ---------- | ---------------- | ----------------- | ----------------------------------- |
| Desarrollo | `oranje-dev`     | Nada automático   | Desarrollo local y pruebas manuales |
| Staging    | `oranje-staging` | Merge a `staging` | Validación previa a producción      |
| Producción | `oranje-prod`    | Merge a `main`    | Operación real                      |

`oranje-dev` **no tiene pipeline de CI** y es correcto que no lo tenga: no todo ambiente necesita un disparador.

### Un solo artefacto

La imagen se construye **una vez**, al mergear a `staging`. El despliegue a producción **reutiliza ese mismo digest**; no vuelve a construir desde `main`.

> [!important]
> Reconstruir la imagen al desplegar a producción invalida la validación de staging: distinta resolución de dependencias, distinto momento de build, distinto artefacto. Lo que se validó deja de ser lo que se despliega. La promoción mueve un digest, no dispara un build.

### Versionado

- **SemVer** en `apps/api` y `apps/web`, con changelog generado desde los commits convencionales.
- Cada despliegue a producción **taggea `main`** (`v1.2.0`). El tag es un **registro**, no un disparador: da puntos de rollback concretos (_"despliega `v1.1.3`"_) y ancla el changelog.
- Todo despliegue debe poder revertirse. Las migraciones destructivas se separan del despliegue de código (sección 5).

### Paridad de staging

Staging es un **espejo de producción**, no un ambiente desechable: misma configuración, mismo tipo de infraestructura, volumen de datos realista —anonimizado, ver sección 8. Es lo que permite validar un **cierre de nómina de una semana completa** antes de que toque producción; con datos de juguete esa validación no prueba nada.

### Cuándo pasar a candidatos de release

El modelo actual promueve por rama, y mientras la validación en staging dure poco es suficiente. Cuando validar el cierre de nómina empiece a **chocar con los merges a `staging`** —alguien mergea a media validación, staging se redespliega y la validación se reinicia— es la señal para congelar candidatos con un tag `vX.Y.Z-rc.N` desplegado a staging, y promover ese digest a producción.

Esa migración se hace **cuando aparezca el conflicto**, no por calendario. Añade un paso al proceso y solo se justifica cuando la validación larga lo exige.

---

## 12. Definition of Done

Una tarea está terminada cuando:

1. El código cumple [[Estructura de Proyecto y Nomenclatura]].
2. Implementa el RF **completo**, incluidos sus criterios de aceptación (`08 - Criterios de Aceptación` del departamento).
3. Respeta la Matriz de Permisos del departamento, validado en backend.
4. Ninguna transición de semáforo contradice la nota del semáforo en el vault.
5. Tiene tests y CI en verde.
6. Está documentado en OpenAPI si expone endpoints.
7. Fue revisado y aprobado en PR.
8. Está desplegado en staging y verificado.
9. Si el trabajo reveló una regla de negocio no documentada o contradictoria, **se reportó al vault** en lugar de resolverla por criterio propio.

> [!warning]
> El punto 9 es el que sostiene el sistema. Este vault es la fuente de verdad del negocio; cuando el código necesita una regla que la documentación no tiene, la respuesta no es inventarla en un `if`, sino documentarla primero. Ver [[Reglas de Negocio]].

---

## Relacionado

- [[Estructura de Proyecto y Nomenclatura]]
- [[Estándares de Base de Datos]]
- [[Decisiones de Arquitectura]]
- [[Modelo de Datos]]
- [[Reglas de Negocio]]
- [[Convenciones de Diseño]]
- [[Estructura General App]]
- [[_GUIA - Plantilla de Arquitectura de Departamento]]
- [[Árbol de Reglas de Negocio]]
