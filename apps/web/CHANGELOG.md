# Bitácora de cambios — `apps/web`

Registro histórico de **todos** los cambios hechos en este paquete, sin excepción.
Entrada nueva = arriba del todo, justo debajo de este encabezado.

## Cómo se llena

Toda modificación a `apps/web` se anota aquí **en el mismo cambio que la produce**,
no después. Si se tocó un archivo, hay entrada. Aplica también a lo que no deja
rastro en git: instalar dependencias, cambiar configuración del entorno, borrar algo.

Formato de cada entrada:

```
### HH:MM — Título corto en imperativo
**Qué:** una línea con el cambio concreto.
**Por qué:** el motivo o la decisión que lo justifica.
**Archivos:** rutas tocadas, o `—` si no hubo archivos.
```

Las entradas se agrupan bajo un encabezado `## AAAA-MM-DD` por día. El día más
reciente va primero; dentro del día, la hora más reciente va primero.

Reglas:

- **Nada se edita ni se borra hacia atrás.** Si una entrada quedó mal, se agrega una
  nueva que la corrige y se enlaza a la anterior. La bitácora es append-only.
- **Un cambio, una entrada.** No se agrupan cambios distintos en una sola línea
  "varios ajustes".
- **El _por qué_ es obligatorio.** El _qué_ ya está en el diff; el motivo no.
- Solo se registra lo de `apps/web`. Lo de `apps/api` y demás no va aquí.

---

## 2026-08-13

### 13:10 — El alta de prospecto pasa a ser un modal

**Qué:** «Nuevo prospecto» abre `ProspectFormDialog` en vez de navegar. Se borran
`NewProspectPage`, `HotelForm`, `hotelForm.schema` y la ruta `/pipeline/nuevo`.
**Por qué:** abrir un ciclo son tres inserciones que no tienen sentido por separado
—el edificio, su primer contacto y el ciclo—, y en un modal se ven las tres a la vez
sin perder el tablero de fondo. ⚠ Quien tenga guardada la URL `/pipeline/nuevo` ahora
cae en `/pipeline/:prospectId` con id «nuevo» y ve el estado «no se encontró el
prospecto», con su enlace de vuelta.
**Archivos:** `src/features/onboarding/components/ProspectFormDialog.tsx`,
`src/features/onboarding/pages/PipelinePage.tsx`, `src/app/router.tsx`

### 13:10 — El lápiz de la ficha abre ese mismo modal

**Qué:** el encabezado de la ficha del prospecto gana un lápiz que abre el modal en
modo edición. `HotelDataCard` vuelve a ser solo lectura y muestra dirección y qué
necesita.
**Por qué:** un solo formulario para los mismos campos. Con dos —el de alta y el que
vivía dentro de la tarjeta— cualquier campo nuevo había que agregarlo dos veces, y
tarde o temprano divergen. En edición el modal oculta el selector de origen del
hotel: un ciclo abierto no cambia de edificio.
**Archivos:** `src/features/onboarding/pages/ProspectDetailPage.tsx`,
`src/features/onboarding/components/HotelDataCard.tsx`

### 13:10 — El contrato crece a las tres tablas del ciclo

**Qué:** `CreateProspectRequest` pasa de campos sueltos a `{ hotelSource, hotel,
contact, ownerUserId, needDescription }`, y aparece `UpdateProspectRequest` sobre
`PATCH /prospects/:id`. `HotelData` gana `address` y `ProspectDetail`,
`needDescription`. Endpoint nuevo `GET /hotels` para el modo «Hotel ya registrado».
**Por qué:** D-13 separa el edificio del ciclo, así que el alta tiene que poder
reusar un hotel ya registrado en vez de duplicarlo. La lista solo ofrece hoteles SIN
ciclo abierto, que es la regla que enuncia el propio modal: un solo ciclo por hotel.
**Archivos:** `src/features/onboarding/types/{prospect.types,prospectForm.schema}.ts`,
`src/features/onboarding/api/{onboardingApi,onboardingMocks}.ts`

### 01:20 — Alta de requisición

**Qué:** «Nueva requisición» deja de estar deshabilitado y abre el modal: cabecera,
tabla de posiciones con alta y baja de filas, total de slots y `POST /requisitions`.
Se suma `GET /requisitions/form-options`. 7 pruebas nuevas: 113 en total.
**Por qué:** el folio NO se pide en el formulario. Lo genera el backend al guardar
—`AAAAMMDDHHMM` más homoclave de dos caracteres— y uno propuesto por el navegador
chocaría con el de otra alta del mismo minuto. Por eso el subtítulo lo explica en vez
de dejar un campo vacío que nadie sabe llenar.
**Archivos:** `src/features/requisitions/components/NewRequisitionDialog.tsx`,
`src/features/requisitions/types/requisitionForm.schema.ts`,
`src/features/requisitions/api/requisitionsMocks.ts`

### 01:20 — El inspector se muestra bloqueado, no escondido

**Qué:** el campo va deshabilitado y se llena solo al elegir hotel: «R. Solís — zona
Centro».
**Por qué:** RR-13 dice que se asigna por la zona del hotel, así que no es del
formulario. Pero esconderlo obligaría a guardar sin saber a quién le va a tocar
revisar, y eso se descubre demasiado tarde.
**Archivos:** `src/features/requisitions/components/NewRequisitionDialog.tsx`

### 01:20 — Cada posición lleva su propio departamento

**Qué:** la columna Departamento es editable por fila y la cabecera solo propone el
valor de las filas nuevas.
**Por qué:** en la maqueta la cabecera dice «Ama de llaves» y la tercera posición
pide «Alimentos y Bebidas». Una requisición puede pedir gente para dos áreas del
mismo hotel, y con un solo departamento en la cabecera esa fila sería imposible.
**Archivos:** `src/features/requisitions/components/NewRequisitionDialog.tsx`,
`src/features/requisitions/types/requisitionForm.schema.ts`

### 01:20 — Los mensajes de error dejan de repetir al placeholder

**Qué:** «Falta el hotel» en vez de «Elige el hotel».
**Por qué:** la opción vacía del `<select>` ya dice «Elige el hotel»; el error con el
mismo texto dejaba dos frases idénticas en pantalla sin saber cuál era la queja.
**Archivos:** `src/features/requisitions/types/requisitionForm.schema.ts`

### 01:20 — Una requisición nueva nace con sus slots

**Qué:** el mock crea la requisición con un slot libre por unidad de cantidad, la
mete al tablero y sube «por autorizar».
**Por qué:** D-02 y RR-15: el slot es la unidad que se bloquea al ocupar, y existe
desde el alta aunque no haya nadie. Crear la requisición sin ellos obligaría a
inventarlos al asignar, que es justo donde se pierde la trazabilidad.
⚠ La cola de autorización vive en otro archivo de fixtures y NO se entera del alta.
Con backend real es una sola tabla; en mocks son dos módulos y prefiero la
duplicación visible a un import circular.
**Archivos:** `src/features/requisitions/api/requisitionsMocks.ts`

### 00:40 — Módulo de Timesheet

**Qué:** feature `timesheet` con la rejilla semanal: columna fija de colaboradores,
siete columnas de día, cuatro filtros, zoom de ancho y selección en bloque.
`GET /timesheets/week` con su fixture. Timesheet sale de los placeholders. 7 pruebas
nuevas: 106 en total.
**Por qué:** se arma con `grid-template-columns` y no con `<table>` porque el ancho
de la columna de día lo elige el usuario, y una tabla reparte el sobrante a su manera
en cuanto el contenido no cabe.
**Archivos:** `src/features/timesheet/**`, `src/app/router.tsx`

### 00:40 — El título de la semana sale de las columnas

**Qué:** «Semana 31 jul – 6 ago 2026» se calcula con el primer y el último día que
manda el backend.
**Por qué:** la maqueta dice «Semana 11–17 ago 2026» y debajo dibuja del 31 al 6.
Con el rango calculado, el título no puede hablar de una semana distinta de la que se
está viendo. `formatWeekRange` además no repite el mes cuando es el mismo.
**Archivos:** `src/shared/lib/formatters.ts`,
`src/features/timesheet/pages/TimesheetPage.tsx`

### 00:40 — Dos indicadores por día, porque son dos preguntas

**Qué:** el punto de la izquierda dice si hay checadas —completa, incompleta, sin
turno— y el chip de color, en qué punto va la revisión: Pendiente, Observado,
Revisado.
**Por qué:** un día puede tener entrada y salida marcadas y seguir sin revisar. Con
un solo indicador habría que elegir cuál de las dos cosas se pierde. El semáforo de
revisión ⚠ está DERIVADO DE LA CAPTURA: §5 declara `indicadorTimesheet.ts` pero no lo
transcribe, así que falta validarlo.
**Archivos:** `src/shared/constants/timesheetStatus.ts`,
`src/features/timesheet/components/TimesheetDayCell.tsx`

### 00:40 — Lo morado de la maqueta es la selección

**Qué:** la casilla de cada celda, el contorno del día elegido y la barra de resumen
comparten el color. Elegir días arma «N días elegidos · SR26-104».
**Por qué:** es la lectura que explica todo el morado de la captura junto —casillas,
recuadro punteado y el chip «Pagar N» de cada fila—: elegir días de varias personas
para actuar sobre todos a la vez. La acción queda deshabilitada porque falta su
maqueta.
**Archivos:** `src/features/timesheet/pages/TimesheetPage.tsx`

### 00:40 — Un día sin registro se deja vacío

**Qué:** las celdas sin entrada no pintan tarjeta, y una entrada sin horas dice `—`.
**Por qué:** nadie fichó; dibujar una tarjeta en cero diría que sí y que trabajó cero
horas, que es otra cosa. El turno del 5 de agosto cruza la medianoche —17:11 a
03:40— y por eso no tiene horas todavía: sirve de recordatorio de que un día de
timesheet no cabe siempre dentro de un día de calendario.
**Archivos:** `src/features/timesheet/components/TimesheetGrid.tsx`,
`src/features/timesheet/api/timesheetMocks.ts`

### 23:50 — Módulo de Reclutamiento: Pool de Colaboradores

**Qué:** feature `recruitment` con la tabla del pool —nueve columnas con los nombres
de la vista—, cinco filtros y `GET /pool` con su fixture. Entra al sidebar, que queda
en quince módulos. 5 pruebas nuevas: 99 en total.
**Por qué:** los encabezados van con el nombre de la columna (`full_name`,
`status_light_code`) porque quien usa esta pantalla arma coberturas contra `vw_pool`
y necesita saber por qué campo está mirando. Perfil e ITIN se escriben en palabras y
no con palomita: «no» tiene que leerse igual de rápido que «sí», y un hueco donde
debería ir un check se confunde con un dato que no cargó.
**Archivos:** `src/features/recruitment/**`, `src/app/router.tsx`,
`src/layouts/Sidebar.tsx`, `src/layouts/Sidebar.spec.tsx`

### 23:50 — Semáforo de Colaborador, derivado de la captura

**Qué:** `shared/constants/workerStatus.ts` con los seis estados y sus etiquetas. El
chip enseña el código Y su significado: `STRONG_GREEN · Disponible`.
**Por qué:** ⚠ §5 declara `semaforoColaborador.ts` en el vault pero solo transcribe
el ejemplo del de Requisición, así que esto sale de la maqueta, como el de Onboarding
y a diferencia del de Requisición. Las TRANSICIONES no se declaran: inventarlas sería
peor que no tenerlas, porque alguna capa acabaría usándolas.
⚠ Y los códigos vienen en INGLÉS —`STRONG_GREEN`, `PINK`, `BROWN`—, mientras los
otros dos semáforos y el propio ejemplo de §5 nombran el color en español
(`VERDE_MANZANA`). Uno de los dos idiomas está mal; conviene resolverlo antes de que
existan filas guardadas.
**Archivos:** `src/shared/constants/workerStatus.ts`

### 23:50 — Un solo catálogo de niveles de inglés

**Qué:** `shared/constants/catalogs.ts` reúne niveles de inglés, modalidades de
contratación y posiciones. Requisiciones deja de tener su lista propia.
**Por qué:** el Pool trae «Conversacional» y la lista de Requisiciones no lo tenía.
Es la MISMA lista —una requisición pide un nivel y un colaborador lo tiene—, y con
dos copias el emparejamiento habría fallado sin que nadie supiera por qué. La
modalidad sí se mantiene aparte: la de una posición dice cómo se paga ese puesto y la
de una persona, qué disponibilidad tiene.
**Archivos:** `src/shared/constants/catalogs.ts`,
`src/features/requisitions/types/requisition.types.ts`,
`src/features/requisitions/components/AuthorizationPositionsTable.tsx`

### 23:50 — El chip blanco lleva borde

**Qué:** `SemaforoSoftBadge` dibuja borde cuando el token es `st-blanco`.
**Por qué:** el blanco teñido al 15% sobre fondo blanco no se ve. Sin el borde,
«WHITE · Pre-asignación» quedaría como texto suelto y parecería que a esa fila le
falta el estado.
**Archivos:** `src/shared/components/SemaforoSoftBadge.tsx`

### 23:50 — Los filtros del pool arrancan abiertos

**Qué:** los cinco empiezan en «todos» en vez de con el valor que dibuja la maqueta.
**Por qué:** la captura los muestra en Posición: Housekeeper y Zona: Centro, pero
debajo enseña filas de Houseman, Laundry y Chef en cinco zonas distintas. Son valores
de ejemplo del control, no un filtro aplicado: arrancar filtrando escondería el pool
completo justo al abrir la pantalla.
**Archivos:** `src/features/recruitment/components/PoolFilters.tsx`

### 23:05 — Alta de contactos desde la ficha del hotel

**Qué:** «Contactos del hotel» gana un botón **Editar** que abre el modal de alta:
lista de registrados a la izquierda, formulario a la derecha, y los dos avisos del
diseño. `POST /prospects/:prospectId/contacts` con su fixture. 7 pruebas nuevas: 94
en total.
**Por qué:** los contactos se capturaban solo en el alta del prospecto, uno y a
ciegas. Un hotel tiene los que haga falta y aparecen con el tiempo.
**Archivos:** `src/features/onboarding/components/HotelContactsDialog.tsx`,
`src/features/onboarding/components/HotelContactList.tsx`,
`src/features/onboarding/pages/ProspectDetailPage.tsx`

### 23:05 — Los contactos se guardan en LOTE, no de uno en uno

**Qué:** un solo `POST` con todos los borradores; la lista de la izquierda los
acumula y el botón del pie los manda juntos.
**Por qué:** lo obliga `ux_hotel_contact_primary`, el índice único parcial sobre
`hotel_id WHERE is_primary`. Quitarle el principal al anterior y dárselo al nuevo
tiene que pasar en la MISMA transacción: partido en dos llamadas, el motor rechaza
la segunda. Es la nota ámbar del diseño convertida en forma del endpoint, no solo en
un texto que se lee.
**Archivos:** `src/features/onboarding/api/onboardingApi.ts`,
`src/features/onboarding/api/onboardingMocks.ts`

### 23:05 — Marcar un principal apaga a los demás en el formulario

**Qué:** el interruptor es excluyente entre borradores, y el pie dice quién tiene hoy
el principal.
**Por qué:** dejar que alguien marque dos para que el servidor le diga que no es
hacerle perder el viaje. La restricción se explica ANTES de chocar con ella.
**Archivos:** `src/features/onboarding/components/HotelContactsDialog.tsx`

### 23:05 — Solo `full_name` es obligatorio

**Qué:** el esquema exige el nombre; puesto, teléfono y correo van vacíos si hace
falta. El correo solo se valida si se escribió algo.
**Por qué:** `hotel_contact` solo pide `full_name` y `hotel_id`. Exigir más en el
front obligaría a inventar un teléfono para poder guardar, que es como se llenan las
bases de datos de teléfonos falsos. El correo se valida con `refine` y no con
`z.email()` para que el tipo de entrada y el de salida sigan siendo el mismo
`string`, que es lo que espera React Hook Form.
**Archivos:** `src/features/onboarding/types/hotelContactsForm.schema.ts`

### 23:05 — `email` entra a `HotelContact`

**Qué:** el tipo gana `email`, y los fixtures de Puerto Real pasan a tres contactos
con sus correos.
**Por qué:** el modal lo captura y la ficha lo guardaba en ningún lado. Tres es lo
que dice la maqueta —«3 registrados»—, así que el conteo del modal cuadra con lo que
se ve.
**Archivos:** `src/features/onboarding/types/prospect.types.ts`,
`src/features/onboarding/api/onboardingMocks.ts`

### 22:20 — El cliente abre la ficha del hotel, en naranja

**Qué:** «Ver detalle» de una tarjeta de cartera lleva a `/pipeline/:prospectId`, la
misma ficha del Pipeline. El folio se queda con el enlace al contrato.
**Por qué:** un cliente NO es otra entidad: es un prospecto que llegó a `NARANJA`,
que el propio semáforo describe como «Cliente activo» y deja fuera del tablero por
terminal. Su ficha ya existía; hacer una pantalla paralela habría duplicado
contactos, intentos e historial para contar lo mismo.
**Archivos:** `src/features/clients/components/ClientCardItem.tsx`,
`src/features/clients/types/client.types.ts`,
`src/features/clients/api/clientsMocks.ts`

### 22:20 — El historial de un convertido recorre el camino completo

**Qué:** el detalle derivado de un prospecto en `NARANJA` trae los seis asientos
—Gris, Azul claro, Verde, Amarillo, Rosa, Naranja— y su `activated_at`. Antes
cualquier prospecto sin captura propia mostraba un historial que decía «Gris» sin
importar en qué estado estuviera.
**Por qué:** `ONBOARDING_TRANSITIONS` no permite saltar de Gris a Naranja. Un
historial con ese salto es uno que el backend jamás podría escribir, y se acabaría
diseñando la pantalla contra un caso imposible. Es la misma regla que ya aplican
los fixtures de Requisiciones.
**Archivos:** `src/features/onboarding/api/onboardingMocks.ts`

### 22:20 — «Cambiar estado» se apaga en un estado terminal

**Qué:** el botón queda deshabilitado con `isTerminalStatus`, explicando por qué.
**Por qué:** `NARANJA` y `ROJO` no declaran transiciones. Abrir el diálogo para
enseñar una lista vacía es peor que no ofrecerlo. La función existía desde el
andamiaje y no la usaba nadie.
**Archivos:** `src/features/onboarding/pages/ProspectDetailPage.tsx`

### 22:20 — Cinco prospectos convertidos en los fixtures

**Qué:** `psp-0012`…`psp-0016` en `NARANJA`, uno por hotel de la cartera. No se
pintan en el tablero, que excluye los terminales, pero sostienen la ficha y las
propuestas.
**Por qué:** ⚠ repiten el nombre de cinco prospectos abiertos. Es artefacto de
fixture —en la base hay UNA fila por hotel y este par sería la misma—, asumido a
propósito: convertir a Puerto Real dejaría sin transiciones al prospecto de las
capturas del Pipeline, con sus propuestas y su contrato, que es la pantalla que ya
se revisó. Se colapsa en una sola cuando el backend exista.
**Archivos:** `src/features/onboarding/api/onboardingMocks.ts`

### 21:55 — El mapa medía cero de alto en Clientes Activos

**Qué:** el `<Map>` pasa de `size-full` a `absolute inset-0` dentro de su sección,
que ya era `relative`.
**Por qué:** `height: 100%` necesita que el padre tenga altura DEFINIDA. En Mi
Territorio la tiene, porque el mapa es un renglón de grid estirado; en Clientes la
columna es `items-start` —hace falta para que el mapa se quede pegado al hacer
scroll— y ahí la sección solo tiene `min-height`. Contra eso, el 100% se resuelve
como `auto` y el mapa mide cero: se carga, pide los tiles y no se ve. Posicionándolo
contra la sección llena el hueco venga la altura de donde venga, así que la próxima
pantalla que lo use no vuelve a pisar la misma piedra.
**Archivos:** `src/shared/components/HotelPointsMap.tsx`

### 21:35 — La ficha del mapa ya no tapa los pines

**Qué:** la tarjeta del hotel seleccionado pasa del centro del mapa a la esquina
superior izquierda, y deja de atrapar el puntero.
**Por qué:** `fitBounds` deja a los hoteles justo en medio del encuadre, que es
exactamente donde estaba la ficha: con cinco hoteles en Cancún, tapaba casi todos
los marcadores. Es la misma esquina que usa Mi Territorio, así que además las dos
pantallas se comportan igual.
**Archivos:** `src/features/clients/components/ClientMapCard.tsx`

### 21:35 — La geocerca del hotel elegido se dibuja en el mapa

**Qué:** `HotelMapPoint` acepta `radiusM` opcional y el mapa pinta el círculo, pero
SOLO del punto seleccionado.
**Por qué:** «dónde se encuentra» un hotel es su coordenada y su radio de checada;
el círculo lo enseña de un vistazo y reusa lo que ya hacía el modal de alta.
Dibujarlos todos a la vez llenaría el mapa de círculos superpuestos y taparía
justo lo que se quería ver. Territorio no manda radio, así que no pinta ninguno.
**Archivos:** `src/shared/components/HotelPointsMap.tsx`,
`src/features/clients/pages/ClientPortfolioPage.tsx`

### 21:10 — Clientes Activos deja de ser un placeholder

**Qué:** feature `clients` con la cartera: tarjetas a la izquierda, mapa a la
derecha, cinco controles y `GET /clients` con filtros y orden. 6 pruebas nuevas: 85
en total.
**Por qué:** lista y mapa comparten selección en los DOS sentidos —elegir una tarjeta
mueve el mapa y elegir un pin resalta su tarjeta—. Son dos vistas de lo mismo; que
cada una llevara su propio foco obligaría a buscar el hotel dos veces.
**Archivos:** `src/features/clients/**`, `src/app/router.tsx`

### 21:10 — El mapa de hoteles sube a `shared`

**Qué:** `HotelPointsMap` sale de `features/territory` a `shared/components`, con
puntos genéricos —id, título, coordenada y color ya resuelto— y lo superpuesto como
`children`. `TerritoryMap` pasa a ser una capa de treinta líneas sobre él.
**Por qué:** Clientes necesitaba el mismo mapa y §4 no deja que una feature importe
de otra. La alternativa era copiar ochenta líneas de encuadre y marcadores, que es
justo lo que §4 existe para evitar. El color entra por prop porque en Territorio
significa el semáforo de Onboarding y aquí el estado del contrato.
**Archivos:** `src/shared/components/HotelPointsMap.tsx`,
`src/features/territory/components/TerritoryMap.tsx`

### 21:10 — La vista no trae contrato: la tarjeta lo une

**Qué:** `contract` es un objeto aparte dentro de `ClientCard` y puede ser `null`.
**Por qué:** es la nota de la maqueta. `vw_client` no trae contrato ni zona; el
número, su estado, las posiciones y el rango de tarifas salen de unir con
`commercial.contract` y `contract_rate`. Modelarlo anidado y anulable deja escrito
que un hotel puede estar activado y quedarse sin contrato vigente — hay un fixture
así, y la tarjeta dice «sin contrato» en vez de fingir uno.
**Archivos:** `src/features/clients/types/client.types.ts`,
`src/features/clients/api/clientsMocks.ts`

### 21:10 — Los folios son los mismos que en Documentos T&C

**Qué:** los cuatro contratos de la cartera usan los ids y números de los fixtures
de contratos, y «Ver detalle» abre esa misma ficha.
**Por qué:** es la misma tabla vista desde otro lado. Si aquí dijeran otra cosa, el
primero que compare las dos pantallas encontraría un fantasma.
**Archivos:** `src/features/clients/api/clientsMocks.ts`,
`src/features/clients/components/ClientCardItem.tsx`

### 21:10 — «Editar hotel» queda pendiente, con motivo

**Qué:** el botón está en la tarjeta pero deshabilitado.
**Por qué:** la maqueta pide que el edificio se edite desde la cartera, y estoy de
acuerdo. Pero el formulario de hotel son 617 líneas dentro de `onboarding`, atado a
cuatro hooks de su API, su esquema y tres componentes hermanos. Sacarlo a `shared`
es un refactor de verdad y no lo hago sin que se pida: cablearlo mal es peor que
dejarlo apagado y a la vista.
**Archivos:** `src/features/clients/components/ClientCardItem.tsx`

### 20:05 — El folio del contrato abre su ficha

**Qué:** en la tabla de Documentos T&C el número es enlace, además del botón «Abrir»
del final del renglón. Los dos van a `/documentos-tc/:contractId`.
**Por qué:** el folio es lo que la gente intenta pulsar —es el nombre del documento—,
y hasta ahora solo respondía el botón del extremo opuesto de la fila. Es la misma
decisión que en Requisiciones, donde el folio ya llevaba al detalle.
**Archivos:** `src/features/contracts/components/ContractTable.tsx`

### 19:40 — Documentos T&C deja de ser un placeholder

**Qué:** feature `contracts` con la lista de contratos y la ficha de cada uno:
vigencia con barra, multiplicadores, tarifas por posición y las restricciones del
motor. `GET /contracts` con filtros y `GET /contracts/:id`. 10 pruebas nuevas: 78 en
total.
**Por qué:** el filtro viaja al servidor y no se aplica sobre lo descargado. La lista
crece con cada hotel, y filtrar en el cliente daría resultados incompletos en cuanto
haya más de una página — el clásico «no aparece y sí existe».
**Archivos:** `src/features/contracts/**`, `src/app/router.tsx`

### 19:40 — «Vence en» avisa, no filtra

**Qué:** el cuarto control decide a partir de cuántos días un contrato se marca como
próximo a vencer. No quita filas.
**Por qué:** en la maqueta conviven «Vence en: 90 días» y un contrato a 10 meses. Si
filtrara, esa fila no podría estar ahí: la única lectura que no se contradice es que
es una ventana de aviso. Con 180 días, «3 meses restantes» pasa a «vence en 94 días»
y no desaparece nadie. **Confírmalo** — si querías un filtro de verdad, cambia.
**Archivos:** `src/features/contracts/components/ContractFilters.tsx`,
`src/features/contracts/lib/validity.ts`

### 19:40 — Un solo chip por renglón

**Qué:** en la tabla, el estado es lo único con chip. La vigencia va con barra y los
multiplicadores en texto plano.
**Por qué:** es la nota de la maqueta y se respeta. La vigencia es una magnitud
—cuánto se consumió del periodo—, no una etiqueta; si compitiera en color con el
estado, el verde significaría «activo» y «recién empezado» en el mismo renglón. La
nota no se pinta en pantalla: es razón de diseño y vive en el comentario del
componente, no delante del usuario.
**Archivos:** `src/features/contracts/components/ContractTable.tsx`,
`src/features/contracts/components/ValidityCell.tsx`

### 19:40 — El margen sí se calcula en el front

**Qué:** margen de multiplicadores y de tarifas = factura − pago, redondeado a dos
decimales.
**Por qué:** rompe la regla que vengo aplicando —los agregados los manda el backend—
y hay motivo: aquí los dos sumandos viajan en la MISMA respuesta, sin reloj ni
paginación de por medio, así que el resultado no puede desviarse de nada. El
redondeo es porque `2.5 − 2.0` en coma flotante no siempre cae redondo y esto es
dinero.
**Archivos:** `src/features/contracts/lib/validity.ts`

### 19:40 — La semana de nómina se enseña en los dos idiomas

**Qué:** «Lunes → Domingo» y debajo `week_start_day 1 · week_end_day 0`.
**Por qué:** domingo es 0, así que una semana normal termina en un número MENOR que
el que la empieza. Sin los crudos a la vista, el primero que abra la base va a creer
que hay un dato invertido.
**Archivos:** `src/features/contracts/pages/ContractDetailPage.tsx`,
`src/shared/constants/contractStatus.ts`

### 19:40 — La búsqueda espera a que dejes de teclear

**Qué:** 300 ms de espera antes de consultar al servidor.
**Por qué:** «Puerto Real» son once peticiones sin esto, y la última en contestar no
tiene por qué ser la del texto completo: la tabla acabaría mostrando el resultado de
«Puerto Rea».
**Archivos:** `src/features/contracts/pages/ContractListPage.tsx`

### 18:30 — Cola de autorización de requisiciones

**Qué:** pantalla nueva en `/requisiciones/autorizacion`: pendientes a la izquierda,
lo que se firma a la derecha y la resolución abajo. `GET /requisitions/authorizations`,
`GET /catalogs/status-change-reasons` y los `POST` de autorizar y rechazar. Se llega
desde la métrica «Por autorizar» del tablero. 8 pruebas nuevas: 68 en total.
**Por qué:** la cola viaja con las posiciones de cada requisición dentro. Quien firma
salta entre ellas comparando, y pedir el detalle a cada clic metería medio segundo
de espera en cada comparación. Son tres asuntos, no tres mil.
**Archivos:** `src/features/requisitions/**`, `src/app/router.tsx`

### 18:30 — La frase del semáforo se lee de las constantes

**Qué:** el subtítulo dice «Autorizar mueve En elaboración → Autorizada» armándolo
con `AUTHORIZATION_TRANSITION` y las etiquetas, no escrito a mano.
**Por qué:** la maqueta dice «Azul claro → Verde manzana» y §5 dice otra cosa —es la
misma discrepancia de ayer, y ya van dos pantallas seguidas donde el diseño coincide
consigo mismo y difiere del vault—. Mientras se aclara, la frase sale de las
constantes: si el semáforo se corrige, el texto se corrige solo y no queda una
pantalla mintiendo.
**Archivos:** `src/shared/constants/requisitionStatus.ts`,
`src/features/requisitions/pages/RequisitionAuthorizationPage.tsx`

### 18:30 — Rechazar solo puede llevar a Morado

**Qué:** `REJECTION_STATUS = 'MORADO'`, y el mock lo aplica al rechazar.
**Por qué:** no es una elección de diseño. `VERDE_MANZANA` tiene exactamente dos
salidas en §5 —`VERDE` y `MORADO`—, así que si rechazar no es autorizar, solo puede
ser Morado. Queda escrito para que nadie invente un séptimo estado.
**Archivos:** `src/shared/constants/requisitionStatus.ts`,
`src/features/requisitions/api/authorizationsMocks.ts`

### 18:30 — El motivo es obligatorio solo al rechazar

**Qué:** el esquema declara `reasonId` opcional y la regla vive en el manejador de
rechazo, que hace `setError` si viene vacío.
**Por qué:** la obligatoriedad no depende del campo sino de qué botón se pulsó, y eso
no cabe en una validación de forma. Meterlo al esquema exigiría dos esquemas o un
campo oculto con la intención, que es peor de leer que una condición de tres líneas.
**Archivos:** `src/features/requisitions/types/resolveAuthorization.schema.ts`,
`src/features/requisitions/components/AuthorizationResolutionForm.tsx`

### 18:30 — En los mocks gana la ruta con menos comodines

**Qué:** `withMocks` deja de tomar la primera ruta que casa y toma la que tiene menos
segmentos dinámicos.
**Por qué:** `/requisitions/authorizations` y `/requisitions/:requisitionId` casan
las dos con la misma URL. Sin desempate mandaba la registrada primero —es decir, el
orden de los imports— y la cola respondía «no existe la requisición authorizations».
Un bug que aparece y desaparece al reordenar imports es de los que cuestan una tarde.
**Archivos:** `src/shared/lib/mockBaseQuery.ts`

### 18:30 — La métrica «Por autorizar» es un enlace

**Qué:** `MetricCard` acepta `to` opcional; con él la tarjeta entera es un `<a>`.
**Por qué:** es un `<a>` y no un `<div>` con `onClick` para conservar el foco por
teclado, el clic central y abrir en pestaña nueva. Es la única de las cuatro que
lleva a algún lado, porque es la única que se resuelve haciendo algo.
**Archivos:** `src/shared/components/MetricCard.tsx`,
`src/features/requisitions/pages/RequisitionBoardPage.tsx`

### 18:30 — `req-0003` se escribe a mano para que las dos pantallas cuadren

**Qué:** la requisición que encabeza la cola pasa a tener detalle propio —2 líneas de
posición— en vez de derivarse, y la fila del tablero pasa de 1 posición a 2.
**Por qué:** derivada daba una sola línea llamada «Mantenimiento», y al firmar en una
pantalla la otra habría mostrado algo distinto de la misma requisición. La cola lee
sus posiciones del mismo fixture, no de una copia.
**Archivos:** `src/features/requisitions/api/requisitionsMocks.ts`,
`src/features/requisitions/api/authorizationsMocks.ts`

### 17:35 — Detalle de Requisición

**Qué:** pantalla nueva en `/requisiciones/:requisitionId` con encabezado, cinta de
datos, tabla de posiciones, lista de slots de la posición elegida e historia de
estado. `GET /requisitions/:id` con su fixture. Se llega desde el folio del tablero.
**Por qué:** el detalle trae posiciones y slots en UNA respuesta —son decenas de
filas y partirlo en tres peticiones armaría la pantalla a pedazos sin ganar nada—,
pero los totales del encabezado siguen viniendo del backend aunque los slots ya
estén en la carga: es el mismo número que pinta el tablero, y recalcularlo abriría
la puerta a que las dos pantallas discrepen por redondeo.
**Archivos:** `src/features/requisitions/**`, `src/app/router.tsx`

### 17:35 — La historia de estado respeta las transiciones del vault

**Qué:** los detalles derivados construyen su historia recorriendo el camino legal
del semáforo: a `AZUL_CLARO` y a `ROJO` se llega pasando por `AMARILLO`, nunca de
`VERDE` directo. Una prueba lo fija.
**Por qué:** un fixture puede escribir cualquier cosa, pero una historia con un
salto que `REQUISITION_TRANSITIONS` prohíbe es una historia que el backend jamás
podría producir, y se acabaría diseñando la pantalla contra un caso imposible.
**Archivos:** `src/features/requisitions/api/requisitionsMocks.ts`

### 17:35 — Corregidos los chips de la maqueta contra NOMENCLATURA §5

**Qué:** la historia de la captura muestra «nace en Azul claro» y «Azul claro →
Verde manzana» rotulado _Autorizada_. Se implementó «nace en En elaboración» y
«En elaboración → Autorizada».
**Por qué:** en §5, `AZUL_CLARO` es «Cubierta totalmente» y es terminal —no tiene
transiciones de salida—, y `VERDE_MANZANA` es «En elaboración». Tal cual, la
maqueta dice que la requisición nació cubierta y retrocedió a elaboración. Los dos
chips están intercambiados. Pendiente de confirmar con el vault.
**Archivos:** `src/features/requisitions/api/requisitionsMocks.ts`

### 17:35 — El tablero y el detalle cuadran en la misma requisición

**Qué:** la fila `202608120930·K7` pasa de `6 posiciones · 4/6 · En proceso` a
`3 posiciones · 4/7 · Autorizada`.
**Por qué:** el detalle de esa misma requisición son 3 líneas de posición que suman
7 slots con 4 ocupados, y su encabezado dice «Autorizada». Con los números viejos,
hacer clic en el folio cambiaba las cifras a media navegación. `Pos.` queda
definido como líneas de posición, y la cobertura se cuenta sobre slots.
**Archivos:** `src/features/requisitions/api/requisitionsMocks.ts`

### 17:35 — «Sin cubrir» pasa a rojo y la palabra se unifica

**Qué:** `lib/coverage.ts` concentra la palabra, el color y el porcentaje de una
cobertura; la barra del tablero y el chip del detalle lo consumen. Cero cubiertos
pasa de amarillo a rojo.
**Por qué:** si una pantalla dijera «parcial» y la otra «incompleta» parecerían dos
conceptos. Y cero asignados no es «va a medias»: es que no ha empezado, que es
justo lo que el supervisor busca de un vistazo. En la barra no cambia ningún pixel
—con cero no se dibuja relleno—, solo el chip nuevo.
**Archivos:** `src/features/requisitions/lib/coverage.ts`,
`src/features/requisitions/components/CoverageBar.tsx`,
`src/features/requisitions/components/CoverageBadge.tsx`

### 17:35 — «Asignado» en vez de «Asignada» en los slots

**Qué:** el renglón del slot ocupado dice «Asignado 12 ago 10:02».
**Por qué:** la maqueta dice «Asignada» porque las tres personas del ejemplo son
mujeres. Deducir el género de un nombre falla el día que el slot lo ocupe alguien
más; en masculino concuerda con «el slot», que es lo que se asignó.
**Archivos:** `src/features/requisitions/components/SlotList.tsx`

### 16:40 — Módulo de Requisiciones

**Qué:** feature `requisitions` con el tablero del supervisor: cuatro métricas, tabla
de nueve columnas con folio, cobertura, urgencia y semáforo, y `GET /requisitions`
con su fixture. 4 pruebas nuevas: 53 en total.
**Por qué:** las cifras del encabezado NO se derivan de las filas. El tablero pinta
una página, pero «8 abiertas en 4 hoteles» habla de todo el territorio; calcularlas
en el front daría números que cambian al paginar. La urgencia también la calcula el
backend desde la fecha de inicio: si la dedujera el front, dos pantallas abiertas a
distinta hora mostrarían urgencias distintas para la misma requisición.
**Archivos:** `src/features/requisitions/**`, `src/app/router.tsx`

### 16:40 — Semáforo de Requisición, transcrito del vault

**Qué:** `shared/constants/requisitionStatus.ts` con los seis estados, sus
transiciones y el semáforo de Urgencia de tres niveles.
**Por qué:** a diferencia del de Onboarding, este NO se dedujo de una captura: está
transcrito del ejemplo de `NOMENCLATURA.md` §5, que sale del vault. Las transiciones
son las de ahí, literales. Es la primera vez que un semáforo entra con su fuente.
**Archivos:** `src/shared/constants/requisitionStatus.ts`

### 16:40 — `SemaforoSoftBadge` sirve a los siete semáforos

**Qué:** el chip suave pasa de recibir un `OnboardingStatus` a recibir token y
etiqueta, la misma API que `SemaforoBadge`. Se actualizan sus ocho usos.
**Por qué:** Requisiciones usa los mismos colores con otro significado —azul claro es
«Cubierta totalmente» y no «Contacto y datos»—, así que el chip no puede conocer un
semáforo concreto. El nombre del estado lo pone quien lo usa.
**Archivos:** `src/shared/components/SemaforoSoftBadge.tsx` y sus ocho consumidores

### 16:40 — `MetricCard` sube a `shared` y admite ícono

**Qué:** el componente se mueve desde `features/dashboard` y gana `icon` y `tone`
opcionales.
**Por qué:** lo usan Dashboard y Requisiciones, y §4 prohíbe que una feature importe
de otra. El tablero de Requisiciones lleva chip de ícono y el Dashboard no, así que
ambos son opcionales; `tone="danger"` distingue la métrica que exige acción.
**Archivos:** `src/shared/components/MetricCard.tsx`,
`src/features/dashboard/pages/DashboardPage.tsx`

### 16:40 — Entran los módulos del rol Supervisor

**Qué:** Schedule, Timesheet, Mi Personal y Accidentes se agregan como placeholders.
El sidebar queda con catorce módulos.
**Por qué:** salieron del sidebar de esta maqueta, que es el del Supervisor. Se
agregan aunque sean de otro rol, según lo acordado: primero todos los módulos
alcanzables, la separación por rol al final.
**Archivos:** `src/layouts/Sidebar.tsx`, `src/layouts/Sidebar.spec.tsx`,
`src/app/router.tsx`

### 15:35 — Todos los módulos al sidebar, sin filtrar por rol

**Qué:** entran «Mi Equipo» y «Reportes» como placeholders, y el sidebar queda con
nueve módulos. Se retira el aviso que trataba la mezcla de roles como algo
provisional a resolver.
**Por qué:** mientras se diseñan las pantallas, cada módulo se agrega al sidebar sin
importar de qué rol venga. Las maquetas llegan de roles distintos —BD y BDC tienen
sidebars diferentes— y filtrar ahora dejaría módulos inalcanzables. La separación por
rol se hará en una pasada aparte, al final. Los dos que se agregan salieron de la
maqueta de Conversión, que dibuja el sidebar del BDC.
**Archivos:** `src/layouts/Sidebar.tsx`, `src/layouts/Sidebar.spec.tsx`,
`src/app/router.tsx`

### 15:20 — Módulo de Conversión a cliente activo

**Qué:** feature nueva `conversion` con dos pantallas: la cola de prospectos en Rosa
(`/conversion`) y la conversión de uno concreto (`/conversion/:prospectId`), con sus
requisitos, la acción para crear el usuario del hotel, «Devolver a Café» y «Aprobar
conversión». Cinco endpoints y sus fixtures. 4 pruebas nuevas: 49 en total.
**Por qué:** los requisitos, el permiso y los efectos los decide el BACKEND y la
pantalla los pinta: `canApprove` viene del servidor y el front NO deduce si se puede
aprobar contando palomitas, porque esa regla no puede vivir en dos sitios. Lo que
ocurre al aprobar también lo redacta el backend —describe columnas que él toca— y el
front no lo adivina. El requisito pendiente ofrece su acción ahí mismo: mandar a otra
pantalla a resolver lo único que bloquea haría perder el hilo.
**Archivos:** `src/features/conversion/**`, `src/app/router.tsx`

### 15:20 — ⚠ El sidebar sigue siendo uno solo para todos los roles

**Qué:** «Conversión» se agrega al sidebar existente, junto a los módulos del BD.
**Por qué:** la maqueta muestra el sidebar del **BDC** —con Mi Equipo y Reportes, y
sin Mi Territorio ni Propuestas—, y el usuario del encabezado es Lucía Márquez · BDC.
La navegación por rol no está implementada, así que conviven todos los módulos para
que nada quede inalcanzable. Implementarla es una decisión aparte.
**Archivos:** `src/layouts/Sidebar.tsx`, `src/layouts/Sidebar.spec.tsx`

### 15:20 — ⚠ Aprobar no mueve la tarjeta del tablero en modo mock

**Qué:** los fixtures de conversión llevan su propio estado, separado de los de
Onboarding.
**Por qué:** §4 impide que una feature importe de otra, así que los hoteles se repiten
en los dos almacenes en memoria. Consecuencia: aprobar una conversión cambia esta
pantalla pero no el semáforo del tablero. Contra la API real es una sola transacción
y la invalidación del tag `Prospect` basta — no hay que cambiar nada del front.
**Archivos:** `src/features/conversion/api/conversionMocks.ts`

### 14:15 — La nota del pin cruza las dos columnas

**Qué:** el aviso «El pin se arrastra a propósito» sale de la columna derecha y pasa a
ocupar el ancho completo con `xl:col-span-2`, al pie de la rejilla.
**Por qué:** explica dos cosas que están en columnas distintas —el mapa a la derecha y
el radio de geocerca a la izquierda—, así que colgarla de una sola la dejaba a medias.
**Archivos:** `src/features/onboarding/components/ProspectFormDialog.tsx`

### 14:05 — Compacta el modal y equilibra sus dos columnas

**Qué:** el ancho sube a 86rem; el mapa y la ficha del hotel se funden en UNA sola
tarjeta; «Primer contacto» sube a la columna izquierda debajo de la geocerca, y «El
ciclo comercial» baja a la derecha con la nota del pin. Controles, márgenes y
espaciados más ajustados.
**Por qué:** la columna izquierda terminaba antes que la derecha y dejaba un hueco
colgando; repartir las dos tarjetas de abajo una a cada lado iguala las alturas y
quita el scroll. Mapa y ficha van juntos porque hablan del mismo hotel: en dos
recuadros separados parecían cosas distintas.
**Archivos:** `src/features/onboarding/components/{ProspectFormDialog,PlacesAutofillSummary}.tsx`

### 13:35 — El mapa del alta vuelve a la columna derecha

**Qué:** el selector de ubicación se parte en dos: `PlacesSearchField` se queda como
un campo más de la columna izquierda, y `HotelLocationMap` sube a la columna derecha,
encima de la ficha del hotel. Un `MapsScope` nuevo envuelve las dos columnas.
**Por qué:** corrige la entrada de las 13:10, donde buscador y mapa iban juntos en un
solo componente dentro del campo «Ubicación», y el mapa acabó a la izquierda en vez
de a la derecha como pide la maqueta. Hacen falta ambos dentro del mismo contexto de
Google Maps, y con un `APIProvider` por componente el script se inicializaría dos
veces con contextos separados: de ahí el `MapsScope`.
**Archivos:** `src/shared/components/MapsScope.tsx`,
`src/features/onboarding/components/{PlacesSearchField,HotelLocationMap,ProspectFormDialog}.tsx`,
`src/shared/constants/googleMaps.ts`

### 13:10 — El mapa del alta dibuja la geocerca y detecta el pin movido

**Qué:** el selector de ubicación gana el círculo de la geocerca a escala, botones de
«Recentrar» y zoom, y distingue elegir un sitio de arrastrar el pin. Al lado, un
resumen de lo que Places autollenó.
**Por qué:** Google devuelve el centroide del lugar, que casi nunca es por donde
entra el colaborador; como la geocerca se evalúa con ST_DWithin, unos metros de más
rechazan ponches legítimos. Por eso el pin se arrastra a mano y la pantalla lo dice.
El resumen hace visible que `zone_id` NO lo sabe Places: sale del catálogo de Oranje
y siempre se elige a mano.
**Archivos:** `src/features/onboarding/components/{HotelLocationPicker,PlacesAutofillSummary}.tsx`

### 12:00 — «Ver propuesta» abre esa versión en el módulo Propuestas

**Qué:** cada versión de la tarjeta «Versiones de la propuesta» gana un botón amarillo
que lleva a `/propuestas/:prospectId/:version`, una pantalla nueva de solo lectura con
los servicios, las tarifas y el margen de ESA versión, más el historial al lado.
4 pruebas nuevas: 47 en total.
**Por qué:** la ficha del hotel queda con dos salidas distintas y a propósito: «Ver
propuesta» abre una versión concreta para consultarla, y «Abrir propuesta», al pie,
entra al editor donde se escribe. Una versión enviada no se edita, así que darle una
pantalla propia de lectura evita pasar por el editor para consultarla.
⚠ La pantalla no tiene maqueta; se armó con las formas que ya existen.
**Archivos:** `src/features/onboarding/pages/ProposalVersionPage.tsx`,
`src/features/onboarding/components/ProposalVersionList.tsx`, `src/app/router.tsx`

### 12:00 — Variante amarilla del botón

**Qué:** `Button` gana `variant="yellow"`: fondo `--yellow` y texto `--ink`.
**Por qué:** el texto NO va en blanco. `tokens.ts` mide amarillo con blanco en 1.4:1,
que es ilegible; con `--ink` sube a 13:1. Es la misma regla que ya aplica
`statusLightForeground` al chip amarillo del semáforo.
**Archivos:** `src/shared/components/Button.tsx`

### 11:50 — «Propuestas» vuelve al sidebar como vista de solo lectura

**Qué:** módulo y ruta `/propuestas` de nuevo, con `ProposalListPage`: lista los
hoteles que tienen alguna versión, con la última y su estado. Cada fila lleva al
editor dentro del pipeline. Se restaura `GET /proposals`.
**Por qué:** revierte la decisión del 11-ago de eliminarlo, porque dos maquetas
seguidas —dashboard y Pipeline— lo siguen dibujando. Es de SOLO LECTURA: crear y
editar sigue viviendo dentro del hotel, así que no hay dos sitios donde cambiar lo
mismo. La pantalla vive en `features/onboarding` y no en una feature propia porque
comparte contrato con la propuesta del hotel; §4 pide carpeta por módulo, pero
partirla en dos obligaría a duplicar sus tipos. ⚠ No tiene maqueta: se armó con las
formas que ya existen.
**Archivos:** `src/features/onboarding/pages/ProposalListPage.tsx`,
`src/features/onboarding/api/{proposalsApi,proposalsMocks}.ts`,
`src/features/onboarding/types/proposal.types.ts`, `src/app/router.tsx`,
`src/layouts/Sidebar.tsx`

### 11:50 — Chips suaves en las columnas del tablero

**Qué:** las cabeceras de columna del Pipeline pasan de `SemaforoBadge` sólido a
`SemaforoSoftBadge`.
**Por qué:** lo pide la maqueta nueva, y tiene sentido: son cuatro o seis chips a la
vez y el relleno lleno compite con las tarjetas, que es lo que hay que leer.
**Archivos:** `src/features/onboarding/components/PipelineColumn.tsx`

### 11:50 — ⚠ Sin contadores en el sidebar

**Qué:** el módulo Pipeline no lleva la píldora naranja que dibuja la maqueta.
**Por qué:** no se sabe qué cuenta ese 12. La página dice «38 prospectos abiertos» y
el dashboard cuenta 6 sin actividad y 12 clientes activos, así que podría ser el
contador de otro módulo mal colocado. Un número en el sidebar que nadie sabe leer es
peor que ninguno. Hay una prueba que lo fija hasta que se defina.
**Archivos:** `src/layouts/Sidebar.tsx`, `src/layouts/Sidebar.spec.tsx`

### 11:25 — Rehace el shell según la maqueta del dashboard

**Qué:** el sidebar pasa a ocupar toda la altura, con el logo arriba y la tarjeta del
usuario abajo; la barra superior cubre solo el área de contenido, a su derecha. Cada
módulo gana su ícono, el activo se pinta en naranja y desaparecen los contadores.
**Por qué:** revierte la decisión del 10-ago, cuando el header se hizo de ancho
completo siguiendo la maqueta del Pipeline. Las dos maquetas se contradicen y esta es
la más reciente. Afecta a todas las pantallas, no solo al dashboard: el shell es
compartido.
**Archivos:** `src/layouts/{AppShell,Header,Sidebar}.tsx`, `src/layouts/Sidebar.spec.tsx`

### 11:25 — El usuario de la sesión sale de un solo sitio

**Qué:** `GET /me` con `sessionApi`, que sustituye al `navApi` de los contadores. El
header y la tarjeta del sidebar lo consumen; se borran `navApi.ts` y `nav.types.ts`.
**Por qué:** el nombre y el rol estaban escritos a mano en dos componentes, y ahí es
donde empiezan a no coincidir. Vive en `app/` y no en una feature porque lo pinta el
shell en todas las pantallas: desde una feature arrastraría esa feature al bundle
inicial. El endpoint de contadores se elimina porque el sidebar ya no los muestra.
**Archivos:** `src/app/sessionApi.ts`, `src/shared/types/session.types.ts`

### 11:25 — ⚠ «Propuestas» no vuelve al sidebar

**Qué:** la maqueta del dashboard dibuja seis módulos, incluido Propuestas. Se
implementan cinco.
**Por qué:** el 11-ago se decidió quitarlo, porque la propuesta pasó a vivir dentro de
cada hotel del pipeline. La maqueta parece anterior a esa decisión, así que se
respeta lo acordado en vez de reintroducir el módulo en silencio. Hay una prueba que
lo fija. Si vuelve a ser módulo propio, se agrega y se le da ruta.
**Archivos:** `src/layouts/Sidebar.tsx`, `src/layouts/Sidebar.spec.tsx`

### 11:20 — Reemplaza el dashboard de humo por el del rol BD

**Qué:** la pantalla de verificación de tokens da paso al dashboard de la maqueta:
encabezado con dueño, zonas y periodo; cuatro métricas —prospectos abiertos, tasa de
conversión, tiempo promedio y clientes activos—; embudo por estado del semáforo; y
lista de prospectos sin actividad reciente. Endpoint `GET /dashboard` con su fixture.
4 pruebas nuevas: 38 en total.
**Por qué:** la API manda números crudos —la tasa como fracción, los días como
entero— y el formato lo pone la UI: el backend no decide si algo lleva `%` o `d`.
Las barras del embudo se escalan contra el peldaño más alto y no contra el total, así
las proporciones se leen igual con 30 prospectos que con 300. La consulta se etiqueta
con `Prospect`/`LIST`, de modo que cambiar un semáforo o registrar un intento refresca
el dashboard sin que esas mutaciones sepan que existe.
**Archivos:** `src/features/dashboard/**`, `src/shared/lib/formatters.ts`

### 11:20 — Chip de semáforo en variante suave

**Qué:** `SemaforoSoftBadge` — fondo teñido al 15 % y punto de color, frente al
relleno sólido de `SemaforoBadge`.
**Por qué:** en el dashboard hay varios chips a la vez y el relleno sólido compite con
las cifras. ⚠ El texto va en `--ink-2` y no en el color del estado, aunque la maqueta
lo pinte de color: `--st-azul-claro` sobre blanco da 2.1:1 y el amarillo es peor. El
color sigue estando en el punto y el fondo, que es señal redundante y no la única
portadora del significado. Su sitio natural es `packages/ui`, hoy fuera de alcance.
**Archivos:** `src/shared/components/SemaforoSoftBadge.tsx`

### 11:20 — Métrica sin ícono, aparte de `KpiCard`

**Qué:** `MetricCard` local en la feature del dashboard.
**Por qué:** `KpiCard` de `packages/ui` trae chip de ícono y tendencia, y esta maqueta
no lleva ninguno de los dos. Cuando se pueda tocar ese paquete, lo razonable es que
`KpiCard` gane una variante sin ícono y este componente desaparezca.
**Archivos:** `src/features/dashboard/components/MetricCard.tsx`

## 2026-08-11

### 16:35 — Apaga comercios y puntos de interés en los mapas

**Qué:** los mapas se estilan en código con `HIDE_POI_MAP_STYLES`: fuera POIs,
comercios, atracciones, transporte y los iconitos de carretera. Se conservan los
nombres de calles. `clickableIcons={false}` remata: ya no hay nada más que clicar.
**Por qué:** ⚠ EXIGIÓ RENUNCIAR AL MAP ID. Google ignora el array `styles` cuando el
mapa arranca con un Map ID —ahí el estilo solo se configura en la consola de GCP—, y
el requisito es que el filtro venga en el código. Sin Map ID tampoco se pueden usar
`AdvancedMarker`, así que los marcadores pasan a ser `Marker` clásicos con un ícono
SVG generado a partir del token del semáforo. Se eliminó `VITE_GOOGLE_MAPS_MAP_ID`.
**Archivos:** `src/shared/constants/googleMaps.ts`,
`src/features/territory/components/TerritoryMap.tsx`, `src/vite-env.d.ts`,
`.env.example`

### 16:35 — Alta de prospecto desde «Nuevo prospecto»

**Qué:** el botón del tablero deja de estar deshabilitado y lleva a
`/pipeline/nuevo`, con el formulario de datos del hotel. Al crearlo se entra directo
a su ficha. Endpoints `POST /prospects` y `GET /catalogs/zones`.
**Por qué:** el hotel nace en Gris —hotel identificado— y el semáforo lo fija el
backend, no el formulario: el front no inventa estados. La zona sale del catálogo y
no de un `<select>` escrito a mano, porque `catalogs.zonas` es la fuente.
**Archivos:** `src/features/onboarding/pages/NewProspectPage.tsx`,
`src/features/onboarding/components/HotelForm.tsx`,
`src/features/onboarding/types/hotelForm.schema.ts`,
`src/features/onboarding/api/{onboardingApi,onboardingMocks}.ts`,
`src/app/router.tsx`, `src/features/onboarding/pages/PipelinePage.tsx`

### 16:35 — Modo edición con lápiz en «Datos del hotel»

**Qué:** un lápiz en la esquina de la tarjeta la convierte en formulario, con los
mismos campos del alta. `PATCH /prospects/:id/hotel`. `SectionCard` gana un slot
`action` para el botón.
**Por qué:** la edición ocurre en la misma tarjeta y no en otra pantalla: se corrige
un teléfono o se afina el pin sin perder de vista el resto de la ficha. Alta y
edición comparten `HotelForm` y su schema — si los campos divergen, divergen los dos
flujos.
**Archivos:** `src/features/onboarding/components/HotelDataCard.tsx`,
`src/shared/components/SectionCard.tsx`

### 16:35 — Selector de ubicación con mapa, buscador y pin arrastrable

**Qué:** mapa chico dentro del formulario: se busca la dirección, se hace clic en el
mapa o se arrastra el pin, y debajo se leen las coordenadas. `HotelData` gana
`location` y `zoneId`, y ambos viajan en el alta y en la edición.
**Por qué:** la coordenada es estado del formulario que lo contiene; el selector solo
la reporta, así alta y edición lo comparten. ⚠ El buscador necesita la **Places API**
habilitada en GCP, que es distinta de Maps JavaScript API: si no lo está, el campo
queda deshabilitado y se sigue pudiendo marcar el punto a mano, que es lo que de
verdad fija la coordenada.
**Archivos:** `src/features/onboarding/components/HotelLocationPicker.tsx`,
`src/shared/types/geo.types.ts`, `src/shared/components/MissingMapsKeyNotice.tsx`,
`src/features/onboarding/types/prospect.types.ts`

### 12:00 — Arregla el contrato recortado al imprimir

**Qué:** el documento se extrae a `ContractDocument` y se pinta dos veces: dentro
del modal para verlo, y portalizado a un `#print-root` nuevo —fuera de `#root`—
para imprimirlo. El `@media print` cambia la app entera por ese contenedor en vez
de esconderla con `visibility`. Prueba de regresión que verifica que la copia
imprimible está fuera del modal.
**Por qué:** corrige la entrada de las 10:45. El documento vivía dentro del panel
del modal, que tiene `overflow-y: auto` y `max-height`, y **un ancestro que recorta
sigue recortando aunque sus hijos sean invisibles**: al imprimir salía solo el trozo
que cabía en pantalla. Sacándolo a `#print-root` fluye por el documento y pagina
completo. Se agregó `print-color-adjust: exact` —sin él el navegador descarta los
fondos y el aviso legal salía en blanco— y `break-inside: avoid` para que ningún
bloque se parta entre dos páginas.
**Archivos:** `index.html`, `src/styles/globals.css`,
`src/features/onboarding/components/{ContractDocument,ContractPreviewDialog}.tsx`

### 12:00 — El contrato lleva todos los datos de la propuesta

**Qué:** sección «Propuesta de referencia» con versión, estado, fecha de envío y
responsable, y el objeto pasa a titularse «Objeto: servicios ofrecidos».
**Por qué:** antes solo salían las tarifas y la descripción. Ahora el documento
carga todo lo que la versión conoce, que es lo que se pidió.
**Archivos:** `src/features/onboarding/components/ContractDocument.tsx`

### 10:45 — Exige que el bill rate supere al pay rate

**Qué:** `proposalDraftSchema` gana un `refine` que bloquea guardar o enviar cuando
el bill rate no supera al pay rate, con el error señalando ese campo. Los mensajes
del formulario dejan de estar escritos en el JSX y salen del schema.
**Por qué:** es la regla de negocio que faltaba: facturar por debajo de lo que se
paga pierde dinero en cada hora trabajada. ⚠ Validarla solo aquí no basta — el mismo
schema tiene que correr en el pipe de Nest cuando migre a `packages/contracts`, o un
`curl` se la salta.
**Archivos:** `src/features/onboarding/types/proposalDraft.schema.ts`,
`src/features/onboarding/pages/ProposalEditorPage.tsx`

### 10:45 — Vista previa del contrato desde el historial de la propuesta

**Qué:** icono de PDF junto a cada versión, en el historial del editor y en la
tarjeta de la ficha. Abre el contrato con las partes, el objeto y una tabla de
tarifas —pay, bill y margen bruto por hora con su porcentaje— tomadas de esa versión.
Botón «Imprimir o guardar como PDF» y regla `@media print` que aísla el documento.
**Por qué:** las tarifas se inyectan desde la versión, no se vuelven a capturar: el
contrato no puede decir una cosa y la propuesta otra. NO se genera el PDF con una
librería porque eso tocaría el `pnpm-lock.yaml` de la raíz; el diálogo de impresión
del navegador ya ofrece «Guardar como PDF» y produce el mismo archivo con cero
dependencias. Se imprime con `visibility` y no con `display:none` porque el documento
vive dentro de un modal `position: fixed`, y ocultar por display se llevaría al hijo.
**Archivos:** `src/features/onboarding/components/{ContractPreviewDialog,ContractPreviewButton,ProposalVersionHistory,ProposalVersionList}.tsx`,
`src/styles/globals.css`, `src/features/onboarding/types/proposal.types.ts`

### 10:45 — ⚠ El clausulado del contrato es un marcador de posición

**Qué:** el bloque «Vigencia y condiciones» dice que está pendiente, y el documento
lleva la marca «VISTA PREVIA SIN VALIDEZ LEGAL» dentro del área imprimible.
**Por qué:** el texto legal no está en ningún documento del proyecto y no se redacta
desde el front; lo natural es que salga de la plantilla de Documentos T&C. La marca
va DENTRO de lo que se imprime a propósito: un borrador impreso sin aviso puede
acabar circulando como si fuera el contrato bueno.
**Archivos:** `src/features/onboarding/components/ContractPreviewDialog.tsx`

### 09:35 — Mete la propuesta dentro del hotel y elimina el módulo aparte

**Qué:** la feature `proposals` se disuelve dentro de `onboarding`. El editor pasa
de `/propuestas/:id` a `/pipeline/:prospectId/propuesta`, se borra el selector de
hoteles que se había inventado y «Propuestas» desaparece del sidebar. La entrada al
editor es ahora un botón dentro de la tarjeta «Versiones de la propuesta» de la
ficha del prospecto.
**Por qué:** la propuesta cuelga del hotel, no es un módulo por sí misma; y Clientes
Activos son los mismos hoteles en otro estado del semáforo, así que apuntarán a esta
misma ruta en vez de duplicar pantalla. Al dejar de ser módulo del sidebar deja
también de ser una feature: §4 dice que la carpeta de feature coincide con el módulo
del sidebar del rol.
**Archivos:** `src/features/onboarding/{api,components,pages,types}/**`,
`src/app/router.tsx`, `src/layouts/Sidebar.tsx`

### 09:35 — Una sola fuente para las versiones de la propuesta

**Qué:** `ProspectDetail` deja de traer `proposals`; la ficha las pide a
`GET /prospects/:id/proposals`, el mismo endpoint que usa el editor.
`ProposalVersionSummary` gana `byName` para poder pintar «Enviada 03 jun 2026 · Ana
Ruiz» como en el diseño.
**Por qué:** con las propuestas en dos contratos, la ficha mostraba unas versiones y
el editor otras. Es una petición más en la ficha a cambio de que no puedan
contradecirse. En los fixtures pasa lo mismo: el nombre y el semáforo del hotel
salen de `getProspectIdentity`, no se repiten en dos archivos.
**Archivos:** `src/features/onboarding/types/{prospect,proposal}.types.ts`,
`src/features/onboarding/api/{onboardingMocks,proposalsMocks}.ts`,
`src/features/onboarding/components/ProposalVersionList.tsx`,
`src/features/onboarding/pages/ProspectDetailPage.tsx`

### 09:35 — Quita la tercera acción del encabezado del detalle

**Qué:** desaparece el botón «Enviar propuesta» que se había agregado al encabezado
de la ficha, junto con el contador `proposals` del sidebar.
**Por qué:** revierte la decisión de las 16:55 de ayer. Con la propuesta viviendo en
su propia tarjeta, ese botón sobraba, y quitarlo devuelve el encabezado a las dos
acciones que trae el diseño original.
**Archivos:** `src/features/onboarding/pages/ProspectDetailPage.tsx`,
`src/app/navApi.ts`, `src/shared/types/nav.types.ts`, `src/layouts/Sidebar.spec.tsx`

## 2026-08-10

### 16:55 — Replica el editor de propuesta

**Qué:** pantalla nueva en `/propuestas/:prospectId`: servicios ofrecidos, tarifas
tentativas e historial de versiones, con «Guardar borrador» y «Enviar propuesta».
Endpoints `GET/POST /prospects/:id/proposals`, `PATCH /proposals/:id` y
`POST /proposals/:id/send`, más sus fixtures. 5 pruebas nuevas: 20 en total.
**Por qué:** una propuesta está en borrador mientras `sent_at` es NULL, así que no
hay campo `status` en el contrato: el estado ES la fecha de envío. Solo hay una
versión abierta a la vez; al enviarla, `draft` pasa a `null` y la pantalla ofrece
abrir la siguiente, que arranca con las tarifas de la anterior. Las enviadas no se
editan ni se borran. «Enviar propuesta» guarda antes de enviar: si no, se enviaría
la versión sin los cambios que hay en pantalla.
**Archivos:** `src/features/proposals/**`, `src/app/router.tsx`

### 16:55 — Agrega el selector de hotel del módulo Propuestas

**Qué:** `/propuestas` lista los hoteles del pipeline con el estado de su propuesta
—borrador, enviada o sin propuesta— y lleva al editor de cada uno. Endpoint
`GET /proposals`.
**Por qué:** ⚠ ESTA PANTALLA NO TIENE DISEÑO. Se pidió expresamente poder elegir el
hotel al entrar al módulo, así que se armó reusando las formas que ya existen en
Pipeline y Mi Territorio, sin inventar patrones nuevos. Se rehace cuando llegue su
maqueta.
**Archivos:** `src/features/proposals/pages/ProposalListPage.tsx`,
`src/features/proposals/api/proposalsApi.ts`

### 16:55 — Entra al editor de propuesta desde la ficha del prospecto

**Qué:** botón «Enviar propuesta» en el encabezado del detalle, junto a «Registrar
intento» y «Cambiar estado».
**Por qué:** era el otro camino pedido. Es un enlace y no un botón porque navega, y
como enlace conserva el clic central y abrir en pestaña nueva. ⚠ El diseño del
detalle traía solo dos acciones: esta tercera es una adición pedida aparte, no algo
que estuviera en la maqueta. No se puso en las tarjetas del tablero porque la
tarjeta ya es un enlace completo y anidar un botón dentro sería HTML inválido.
**Archivos:** `src/features/onboarding/pages/ProspectDetailPage.tsx`

### 16:55 — Sube `SectionCard` a `shared/components`

**Qué:** el componente se mueve de `features/onboarding/components/`.
**Por qué:** lo usan el detalle del prospecto y el editor de propuesta, y §4 prohíbe
que una feature importe de otra. Mismo criterio que se aplicó al semáforo.
**Archivos:** `src/shared/components/SectionCard.tsx` y los cinco componentes de
`features/onboarding/` que lo importaban

### 16:20 — Replica el modal «Registrar intento de contacto»

**Qué:** formulario con React Hook Form + Zod: tipo de intento como control
segmentado, contacto del hotel (opcional), resultado, fecha y hora y notas.
Endpoint `POST /prospects/:id/contact-attempts` y su fixture. El botón «Registrar
intento» del detalle deja de estar deshabilitado. 3 pruebas nuevas: 15 en total.
**Por qué:** §4 fija React Hook Form + Zod para formularios, y ambos ya estaban
instalados. El botón de envío vive en el pie del modal, fuera del `<form>`, así que
se unen con `form={id}` en vez de duplicar el pie dentro del formulario. La hora se
arma en local y no con `toISOString()`: en México, UTC adelantaría el valor.
**Archivos:** `src/features/onboarding/components/RegisterAttemptDialog.tsx`,
`src/features/onboarding/types/registerContactAttempt.schema.ts`,
`src/shared/components/FormField.tsx`,
`src/features/onboarding/pages/ProspectDetailPage.tsx`,
`src/features/onboarding/api/{onboardingApi,onboardingMocks}.ts`

### 16:20 — Declara `attempt_type` y `outcome` como listas cerradas en código

**Qué:** `shared/constants/contactAttempt.ts` con los tres tipos de intento y los
cuatro resultados, más sus etiquetas.
**Por qué:** el diseño lo dice explícitamente: «attempt_type — lista cerrada con
CHECK, no catálogo». Por eso NO se piden a `/catalogs`, a diferencia de los motivos
del cambio de estado, que sí salen de `catalogs.status_change_reason`. Un catálogo se
edita en runtime; un CHECK exige migración. ⚠ Los valores salen de leer el modal:
hay que cuadrarlos con el CHECK real cuando `apps/api` lo defina.
**Archivos:** `src/shared/constants/contactAttempt.ts`

### 16:20 — `ContactAttempt.date` pasa a `occurredAt` con hora

**Qué:** el campo cambia de nombre y de tipo: de fecha suelta a ISO con hora. Los
fixtures llevan hora y la bitácora sigue mostrando solo día y mes, como el diseño.
**Por qué:** el modal captura «Fecha y hora», así que un campo llamado `date` que
guardara un instante sería mentira. El intento ocurre en un momento, no en un día.
**Archivos:** `src/features/onboarding/types/prospect.types.ts`,
`src/features/onboarding/api/onboardingMocks.ts`,
`src/features/onboarding/components/ContactAttemptLog.tsx`

### 15:52 — Fija el puerto de dev con `strictPort`

**Qué:** `server.strictPort = true` en `vite.config.ts`.
**Por qué:** con solo `port: 5173`, si el puerto está ocupado Vite se pasa al 5174
sin avisar. La key de Google Maps se restringe por referrer a un puerto concreto,
así que el mapa se rompía con `RefererNotAllowedMapError` y sin causa aparente.
Ahora el arranque falla con el motivo a la vista en vez de mover el puerto en
silencio.
**Archivos:** `vite.config.ts`

### 15:30 — Replica Mi Territorio con mapa de Google

**Qué:** pantalla nueva en `/mi-territorio`, con panel izquierdo (buscador con
debounce, filtro por zona y lista de hoteles) y mapa de Google a la derecha:
marcadores con el color del semáforo, leyenda, ficha flotante del hotel
seleccionado y «Abrir ficha» hacia su detalle. Endpoint `GET /territory` y sus
fixtures. 4 pruebas nuevas: 12 en total.
**Por qué:** el mapa usa `@vis.gl/react-google-maps`, que ya estaba instalado por
D-17. La ficha NO es un `InfoWindow` de Google sino un panel propio, porque el
diseño la fija en la esquina sin pico ni la cromática de la librería. Sin
`VITE_GOOGLE_MAPS_API_KEY` se explica qué falta en lugar de dejar el recuadro gris
con el error de Google encima, que se lee como bug del front.
**Archivos:** `src/features/territory/**`, `src/shared/hooks/useDebounce.ts`,
`src/app/router.tsx`, `src/vite-env.d.ts`, `.env.example`

### 15:30 — Siembra el territorio en Cancún y no en Birmingham

**Qué:** las coordenadas de los fixtures son de Quintana Roo, no las del mapa de la
captura.
**Por qué:** el mapa del diseño muestra Birmingham, Alabama, que es la ubicación por
defecto de la herramienta de maquetación. Todo el resto de la pantalla apunta a
Cancún (`America/Cancun`, teléfonos +52 998). La ubicación es dato, no diseño.
**Archivos:** `src/features/territory/api/territoryMocks.ts`

### 15:30 — Declara a mano la superficie de `google.maps.Map` que se usa

**Qué:** una interfaz local de tres métodos y una conversión en el borde, en
`TerritoryMap`.
**Por qué:** `@types/google.maps` llega como dependencia transitiva de la librería
de mapas y con pnpm sin hoisting no se resuelve desde `apps/web`; `skipLibCheck`
esconde el fallo y el tipo queda sin resolver, así que el linter marcaba siete
accesos como inseguros. Se prefirió una conversión documentada a apagar siete
reglas de seguridad de tipos. Se borra si algún día se agrega
`@types/google.maps` a las devDependencies, lo cual regenera el `pnpm-lock.yaml`
de la raíz.
**Archivos:** `src/features/territory/components/TerritoryMap.tsx`

### 15:30 — Corrige el nombre del estado Rosa

**Qué:** `ONBOARDING_STATUS_DESCRIPTION.ROSA` pasa de «T&C creado y validado» a
«Negociación de términos».
**Por qué:** corrige la entrada de las 14:30 («Define el semáforo de Onboarding»).
La columna Rosa quedaba fuera de encuadre en la captura del Pipeline, así que se
había tomado la NOTA de la transición Amarillo → Rosa como si fuera el nombre del
estado. La captura de Mi Territorio lo nombra directamente.
**Archivos:** `src/shared/constants/onboardingStatus.ts`

### 15:30 — Sube el semáforo de Onboarding a `shared/constants`

**Qué:** `onboardingStatus.ts` se mueve de `features/onboarding/utils/` a
`src/shared/constants/`.
**Por qué:** lo consumen `onboarding` y `territory`, y §4 prohíbe que una feature
importe de otra — el ESLint del proyecto lo bloquea. Sigue siendo un domicilio
provisional: su lugar definitivo es `packages/domain/src/semaforos/`.
**Archivos:** `src/shared/constants/onboardingStatus.ts` y los ocho archivos de
`features/onboarding/` que lo importaban

### 14:37 — Hace que los cuatro módulos sin diseño sí naveguen

**Qué:** Mi Territorio, Propuestas, Documentos T&C y Clientes Activos pasan de ser
texto muerto en el sidebar a enlaces reales, hacia `/mi-territorio`, `/propuestas`,
`/documentos-tc` y `/clientes-activos`. Las cuatro rutas rinden un
`ModulePlaceholder` que dice que la pantalla está pendiente de diseño. Prueba de
regresión que verifica los seis enlaces del sidebar.
**Por qué:** corrige la decisión de la entrada de las 14:30 («Adapta el shell al
diseño de Ventas»), donde se dejaron sin navegar para no inventar pantallas. El
efecto real fue peor: hacer clic y que no pasara nada se lee como app rota, no como
pantalla pendiente. Ahora la URL cambia, el sidebar marca el módulo activo y el
usuario ve a dónde llegó. El placeholder desaparece cuando cada módulo tenga su
feature.
**Archivos:** `src/shared/components/ModulePlaceholder.tsx`, `src/app/router.tsx`,
`src/layouts/Sidebar.tsx`, `src/layouts/Sidebar.spec.tsx`

### 14:30 — Agrega las primeras pruebas del front

**Qué:** prueba de humo de `PipelinePage` (resumen, tarjetas, columnas y enlace al
detalle) y prueba unitaria de `resolveActivityLabel` con sus cuatro ramas. 7 tests
en verde. `vitest.config.ts` fija `VITE_USE_MOCKS=true` para el entorno de prueba.
**Por qué:** la prueba de humo recorre la cadena completa —hook generado → RTK Query
→ fixtures → componente—, que es justo lo que se quiere que siga funcionando el día
que se apaguen los mocks. Los tests quedan con los fixtures encendidos a propósito:
un test unitario no debe depender de que el backend esté levantado.
**Archivos:** `vitest.config.ts`, `src/features/onboarding/pages/PipelinePage.spec.tsx`,
`src/features/onboarding/utils/resolveActivityLabel.spec.ts`

### 14:30 — Saca los contadores del sidebar de la feature

**Qué:** el endpoint `GET /onboarding/nav-counts` se mueve de
`features/onboarding/` a `app/navApi.ts`, y su tipo a `shared/types/nav.types.ts`.
**Por qué:** el `Sidebar` se pinta siempre, así que al importar
`@/features/onboarding` arrastraba la feature entera al bundle inicial y anulaba el
`lazy` de su ruta — el build lo avisaba con `INEFFECTIVE_DYNAMIC_IMPORT`. Con el
cambio, `onboarding` sale como chunk propio de 25 kB y el bundle principal baja de
484 a 459 kB.
**Archivos:** `src/app/navApi.ts`, `src/shared/types/nav.types.ts`,
`src/layouts/Sidebar.tsx`, `src/features/onboarding/index.ts`,
`src/features/onboarding/api/onboardingApi.ts`,
`src/features/onboarding/api/onboardingMocks.ts`,
`src/features/onboarding/types/prospect.types.ts`

### 14:30 — Adapta el shell al diseño de Ventas

**Qué:** la barra superior pasa a cruzar todo el ancho, con logo, buscador global
(`Ctrl K`), Avisos y perfil; el sidebar queda debajo de ella con los seis módulos
del rol BD y sus contadores. Rutas nuevas `/pipeline` y `/pipeline/:prospectId`.
**Por qué:** el diseño coloca el buscador a lo ancho de la ventana, lo que exige que
el header envuelva al sidebar y no al revés. Los módulos sin pantalla se pintan pero
no navegan: mandar a una ruta inexistente tira al error boundary del router.
**Archivos:** `src/layouts/AppShell.tsx`, `src/layouts/Header.tsx`,
`src/layouts/Sidebar.tsx`, `src/app/router.tsx`

### 14:30 — Replica el modal «Cambiar estado»

**Qué:** transiciones como tarjetas de radio con su chip de semáforo, aviso de la
transición oculta, selector de motivo del catálogo y confirmación bloqueada hasta
que hay motivo cuando la transición lo exige.
**Por qué:** las transiciones NO se calculan en el front: se piden a
`/prospects/:id/allowed-transitions`, que ya las filtró por rol. El texto que explica
por qué se ocultó la conversión a Naranja también lo manda el backend, porque solo él
sabe el motivo del filtro. El front nunca decide permisos.
**Archivos:** `src/features/onboarding/components/ChangeStatusDialog.tsx`,
`src/shared/components/Modal.tsx`, `src/shared/components/Button.tsx`

### 14:30 — Replica el detalle del prospecto

**Qué:** encabezado con chip de estado y metadatos del ciclo, y seis bloques: datos
del hotel, bitácora de intentos, versiones de la propuesta, contactos del hotel y
timeline del semáforo.
**Por qué:** el timeline se rotula con el nombre de su tabla
(`prospect_state_history`) porque es el árbitro cuando alguien discute en qué estado
está un prospecto. El punto de cada entrada toma el color del estado de DESTINO, que
es el que quedó vigente tras el cambio.
**Archivos:** `src/features/onboarding/pages/ProspectDetailPage.tsx`,
`src/features/onboarding/components/{SectionCard,HotelDataCard,ContactAttemptLog,ProposalVersionList,HotelContactList,StatusTimeline}.tsx`,
`src/shared/lib/formatters.ts`

### 14:30 — Replica la pantalla Pipeline

**Qué:** tablero kanban con las seis columnas abiertas del semáforo, tarjetas de
prospecto que llevan al detalle, chips de filtro y estados de carga, error y vacío.
**Por qué:** las columnas terminales (Naranja y Rojo) quedan fuera: el tablero es de
prospectos ABIERTOS. `openCount` no se deriva de las tarjetas visibles sino que lo
manda el endpoint, porque el total del pipeline y la página que se pinta son cosas
distintas — por eso el encabezado dice 38 y se ven menos tarjetas.
**Archivos:** `src/features/onboarding/pages/PipelinePage.tsx`,
`src/features/onboarding/components/{PipelineColumn,ProspectCard}.tsx`,
`src/features/onboarding/hooks/usePipelineFilters.ts`,
`src/features/onboarding/utils/resolveActivityLabel.ts`,
`src/features/onboarding/index.ts`

### 14:30 — Define el semáforo de Onboarding y el contrato de Ventas

**Qué:** ocho estados con sus transiciones, tokens, etiquetas y descripciones; y las
formas de respuesta de los seis endpoints, más su declaración en RTK Query sobre el
`createApi` único.
**Por qué:** ⚠ dos cosas quedan en el lugar equivocado a propósito, porque
`packages/domain` y `packages/contracts` están fuera del alcance acordado. El
semáforo debe migrar a `packages/domain/src/semaforos/` y los tipos a
`packages/contracts`. Y las transiciones se reconstruyeron leyendo el timeline y el
modal de las capturas: §5 exige derivarlas del vault, así que necesitan validarse
antes de darse por buenas.
**Archivos:** `src/features/onboarding/utils/onboardingStatus.ts`,
`src/features/onboarding/types/prospect.types.ts`,
`src/features/onboarding/api/onboardingApi.ts`

### 14:30 — Agrega la capa de fixtures para RTK Query

**Qué:** `withMocks` envuelve el `baseQuery` y resuelve las peticiones contra rutas
registradas por feature cuando `VITE_USE_MOCKS` está encendido. Los datos reproducen
las capturas; una mutación se refleja en la siguiente lectura.
**Por qué:** deja declarar los endpoints con su URL y método DEFINITIVOS aunque
`apps/api` no exista todavía: apagar la bandera es todo lo que hay que hacer, sin
tocar un solo componente. Se escribió a mano en vez de usar MSW porque instalar una
dependencia obligaría a modificar el `pnpm-lock.yaml` de la raíz, y el acuerdo es no
salir de `apps/web`. Una ruta sin mock devuelve 501 con su nombre en vez de caer al
backend real, que enmascararía el olvido con un error de red confuso.
**Archivos:** `src/shared/lib/mockBaseQuery.ts`,
`src/features/onboarding/api/onboardingMocks.ts`, `src/app/baseApi.ts`,
`src/vite-env.d.ts`, `.env.example`, `.env.local` (no versionado)

### 13:50 — Instala las dependencias del front

**Qué:** instalación de las 749 dependencias de `apps/web` y de los 4 paquetes del
workspace que consume (`@oranje/config`, `@oranje/contracts`, `@oranje/domain`,
`@oranje/ui`), con `pnpm install --filter "@oranje/web..." --include-workspace-root
--frozen-lockfile`. `apps/api` quedó sin instalar a propósito. Verificado con
`tsc --noEmit` en verde y `vite dev` levantando en `http://localhost:5173/`.
**Por qué:** el repo se clonó sin `node_modules`. Se usó `--filter` para no bajar el
back, y `--frozen-lockfile` para que `pnpm-lock.yaml` no se modificara.
**Archivos:** — (no hubo cambios en archivos versionados)

### 12:13 — Levanta el andamiaje del front — commit `591bba6`

**Qué:** Vite 8 + React 19 + Tailwind 4 vía `@tailwindcss/vite`. Un solo store de
Redux Toolkit con un único `createApi` de endpoints inyectados por feature. React
Router 8 en _data mode_. Firebase Auth como autoridad de identidad, con los permisos
viviendo en Postgres. Shell de la app (sidebar 248px, header 64px) y pantalla de
verificación del sistema de diseño con los 12 chips de semáforo. Recharts,
`@vis.gl/react-google-maps` y three.js instalados.
**Por qué:** hasta este punto `apps/web` era solo un `package.json` stub. Se eligió
_data mode_ en el router porque _framework mode_ trae SSR y la decisión D-04 define
esta app como artefacto estático sin servidor que la renderice.
**Archivos:** `.env.example`, `eslint.config.mjs`, `index.html`, `package.json`,
`tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `src/app/*`,
`src/features/dashboard/*`, `src/layouts/*`, `src/shared/lib/firebase.ts`,
`src/styles/globals.css`, `src/test/setup.ts`, `src/main.tsx`, `src/vite-env.d.ts`

## 2026-08-07

### 14:51 — Crea el paquete dentro del monorepo — commit `5fe1b7e`

**Qué:** `apps/web` aparece como workspace de pnpm, con `package.json` y `README.md`.
Sin código todavía.
**Por qué:** inicialización del monorepo. El front se dejó pendiente a propósito:
sin la primera migración de base de datos no hay API que consumir.
**Archivos:** `package.json`, `README.md`
