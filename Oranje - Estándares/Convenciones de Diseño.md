---
tags:
  - arquitectura
  - global
  - diseño
aliases:
  - Convenciones de Diseño
  - Sistema de Diseño Oranje
  - Semilla de Diseño
---

# Sistema de Diseño Oranje (Semilla)

Define los tokens visuales y componentes compartidos de la plataforma Oranje. La fuente de verdad del CSS es el archivo `oranje-seed.css`, ubicado en `oranje-mockups/Mockups/oranje-seed.css` (repo de mockups, no en este vault).

> [!info]
> Todo mockup nuevo debe enlazar `oranje-seed.css` y solo agregar CSS específico del rol encima. No se reimplementan componentes por rol. El origen de la semilla fue el mockup del Líder de Grupo.

---

## Tokens de diseño

### Paleta Oranje

| Token     | Valor   | Uso                       |
| --------- | ------- | ------------------------- |
| `--o-50`  | #FFF6E8 | Tinte más claro           |
| `--o-500` | #FF8000 | Primario (naranja Oranje) |
| `--o-700` | #C85F00 | Variante oscura           |

Gradientes: `--grad-brand`, `--grad-warm`, `--grad-hero`, `--grad-soft`.

> [!important] De dónde sale #FF8000
> El valor anterior era **#FF8E00**, derivado de los hex documentados cuando `oranje-seed.css` no estaba en disco. El 2026-08-10 se extrajeron los colores reales del **Portfolio Oranje 2024** (el PDF de marca): **#FF8000** aparece 806 veces y es el naranja dominante de toda la pieza —logotipo, bloques, títulos—, con #FF8500 como variante minoritaria. El material impreso que ve el cliente manda sobre un valor derivado, así que el token se corrige.
>
> **No se tocan `--o-50` ni `--o-700`:** el PDF no aporta evidencia de esos dos y se derivaron del primario viejo. Quedan como pendiente 1 de abajo.

### Neutrales

| Token         | Valor   | Uso                            | Contraste sobre `--surface` |
| ------------- | ------- | ------------------------------ | --------------------------- |
| `--bg`        | #F6F4F1 | Fondo de la aplicación         | —                           |
| `--surface`   | #FFFFFF | Cards, paneles, modales        | —                           |
| `--surface-2` | #FBFAF8 | Hover, filas alternas de tabla | —                           |
| `--surface-3` | #EFEBE6 | Pozos y campos deshabilitados  | —                           |
| `--line`      | #E3DDD5 | Bordes y separadores           | —                           |
| `--ink`       | #1A1108 | Texto principal                | 18.6:1                      |
| `--ink-2`     | #4A3F35 | Texto secundario               | 10.2:1                      |
| `--ink-3`     | #7A6D60 | Texto atenuado, metadatos      | 5.0:1 — AA                  |
| `--ink-4`     | #A79A8C | Placeholder y deshabilitado    | 2.7:1 — **solo decorativo** |

> [!warning]
> `--ink-4` **no cumple AA** a propósito: es para placeholders y estados deshabilitados, nunca para texto que el usuario deba leer. Si un texto informativo termina en `--ink-4`, el token equivocado es ese, no el criterio.

### Semánticos

| Token      | Valor   |
| ---------- | ------- |
| `--red`    | #E11919 |
| `--yellow` | #FFD500 |
| `--green`  | #1FA84A |
| `--blue`   | #3B7DDD |
| `--purple` | #7B2CBF |

### Colores del Semáforo del Colaborador

Usados exclusivamente para representar los 12 estados del [[Semáforo del Colaborador]].

| Token                | Estado        | Valor   | Texto del chip | Nota                                                 |
| -------------------- | ------------- | ------- | -------------- | ---------------------------------------------------- |
| `--st-blanco`        | Blanco        | #FFFFFF | `--ink`        | Requiere borde `--line`: se pierde sobre `--surface` |
| `--st-negro`         | Negro         | #1A1108 | #FFFFFF        | = `--ink`                                            |
| `--st-verde-manzana` | Verde manzana | #8CC63F | `--ink`        | Separado de `--green` a propósito                    |
| `--st-azul-claro`    | Azul claro    | #5BC0EB | `--ink`        | Separado de `--blue` a propósito                     |
| `--st-naranja`       | Naranja       | #F2711C | `--ink`        | **No es `--o-500`** — ver la regla 2 de abajo        |
| `--st-rosa`          | Rosa          | #FF6FA5 | `--ink`        | —                                                    |
| `--st-morado`        | Morado        | #7B2CBF | #FFFFFF        | = `--purple`                                         |
| `--st-rojo`          | Rojo          | #E11919 | #FFFFFF        | = `--red`                                            |
| `--st-amarillo`      | Amarillo      | #FFD500 | `--ink`        | 1.4:1 con texto blanco — nunca blanco                |
| `--st-verde`         | Verde         | #1FA84A | #FFFFFF        | = `--green`                                          |
| `--st-cafe`          | Café          | #8B5E34 | #FFFFFF        | —                                                    |
| `--st-gris`          | Gris          | #9A9A9A | `--ink`        | —                                                    |

Cinco reutilizan un token semántico existente en vez de duplicar el hex. Los otros siete son propios de la escala del semáforo.

> [!important]
> Esta escala **no se mapea a variables de shadcn/ui** (D-16). Se consume solo desde `SemaforoBadge`, y los mismos hex sirven a los demás semáforos que comparten nombre de color — Requisición (`APPLE_GREEN`, `GREEN`, `LIGHT_BLUE`, `RED`, `PURPLE`) y Onboarding (`GRAY`, `LIGHT_BLUE`, `GREEN`, `YELLOW`, `PINK`, `ORANGE`, `RED`, `BROWN`, `BLACK`). Un color se ve igual en todos los semáforos; lo que cambia es qué significa en cada uno.

### Layout y estilos base

| Token         | Valor                            | Descripción                   |
| ------------- | -------------------------------- | ----------------------------- |
| `--sb`        | 248px                            | Ancho del sidebar             |
| `--hd`        | 64px                             | Alto del header               |
| `--r-lg`      | 18px                             | Radio grande — cards, modales |
| `--r-md`      | 12px                             | Radio medio — botones, inputs |
| `--r-sm`      | 8px                              | Radio pequeño — chips, badges |
| `--ease`      | `cubic-bezier(.4, 0, .2, 1)`     | Curva de animación            |
| `--sh-sm`     | `0 1px 2px rgba(26,17,8,.06)`    | Sombra pequeña                |
| `--sh-md`     | `0 4px 12px rgba(26,17,8,.08)`   | Sombra media                  |
| `--sh-lg`     | `0 12px 32px rgba(26,17,8,.12)`  | Sombra grande                 |
| `--sh-orange` | `0 6px 20px rgba(255,128,0,.28)` | Sombra naranja (acento)       |

Las sombras se tintan con `rgba(26,17,8,…)` —el valor de `--ink`— en vez de negro puro: un negro neutro sobre la paleta cálida ensucia el naranja.

### Tipografía

**Montserrat.** Iconografía: **Material Icons** (variantes Round y Outlined).

| Peso           | Uso                                      |
| -------------- | ---------------------------------------- |
| Light (300)    | Cuerpo, listas, navegación, pies         |
| Medium (500)   | Énfasis dentro de cuerpo                 |
| SemiBold (600) | Títulos de sección, encabezados de tabla |
| Bold (700)     | Títulos de página, etiquetas de KPI      |
| Black (900)    | Cifras grandes de KPI y dashboard        |

Se sirve desde el bundle como fuente variable (`@fontsource-variable/montserrat`), no desde Google Fonts: una petición menos a host externo y una regla menos de CSP.

> [!important] Por qué Montserrat y no Poppins
> Esta nota decía **Poppins** desde su creación, sin fuente que lo respaldara. El **Portfolio Oranje 2024** —la pieza de marca que ve el cliente— está maquetado íntegramente en **Montserrat**, con esos siete pesos, verificado en las fuentes embebidas del PDF. Lo que la empresa ya usa frente al cliente gana sobre un valor sin origen.
>
> El PDF también embebe **Mark Pro**, pero solo en la columna de anotaciones en español que alguien agregó encima del maquetado. Es residuo del template de referencia, **no** tipografía de Oranje.

> [!warning] Montserrat es ancha, y la app es densa
> Montserrat tiene avances anchos. En cuerpo de tabla a 13-14px cuesta cerca de un 10% más de ancho de columna que una neutral estrecha, y las pantallas más pesadas del sistema son tablas: requisiciones, timesheet, consolidado, pipeline de 9 columnas. Si al maquetar las tablas reales el texto empieza a truncarse, la salida **no** es bajar el tamaño de fuente: es abrir una segunda decisión —Montserrat en títulos, KPIs y marca; una neutral estrecha en cuerpo de tabla— y asentarla aquí. Hoy va Montserrat en todo.

### Reglas de contraste

Tres reglas que salen de medir la paleta, no de preferencia estética. Aplican al maquetado y a los componentes por igual.

1. **Sobre `--o-500` el texto va en `--ink`, nunca blanco.** El naranja primario da **2.5:1** con blanco —reprueba AA— y **7.4:1** con `--ink`. Como el botón primario es naranja, esto toca todas las pantallas: la variable derivada de shadcn se declara `--primary-foreground: var(--ink)`. El Portfolio Oranje 2024 llega a la misma solución por su cuenta: el texto sobre naranja va en cafés oscuros (#824613, #8B4000), nunca en blanco.
2. **`--st-naranja` (#F2711C) no es `--o-500` (#FF8000).** Si fueran el mismo hex, un chip de estado Naranja se leería como elemento de marca y se rompería _"un color = un significado por semáforo"_. La distancia perceptual entre ambos es **ΔE 11.0** — se distinguen sin esfuerzo, pero el margen se estrechó al corregir el primario (era ΔE 16.7 con #FF8E00). Si algún día se ajusta cualquiera de los dos, esta separación se vuelve a medir antes de aceptarlo.
3. **Sobre `--yellow` y `--st-amarillo` el texto va en `--ink`.** Con blanco da **1.4:1**, ilegible.

> [!note]
> Los valores derivados que espera shadcn (`--background`, `--foreground`, `--primary`, `--ring`, `--radius`) se declaran en `tokens.css` apuntando a estos tokens — `--primary: var(--o-500)`, `--radius: var(--r-md)`. Ningún token Oranje se renombra ni se redefine (D-16).

### Pendientes del sistema de diseño

1. **`--o-50` y `--o-700` se derivaron del primario viejo.** #FFF6E8 y #C85F00 salieron de #FF8E00. El Portfolio no aporta evidencia de un tinte ni de una variante oscura, así que se conservan; toca rederivarlos cuando aparezca `oranje-seed.css` o cuando el maquetado real los ponga a prueba.
2. **#FBE7A0 no es un token y hace falta.** El Portfolio usa ese crema para las cifras grandes sobre naranja (`602,100`, el título de portada). Sobre `--o-500` da apenas **2.0:1**, así que no es texto legible: es número decorativo de gran tamaño. Antes de convertirlo en token hay que decidir si el dashboard lo necesita o si esas cifras van en `--ink`.
3. **`oranje-seed.css` sigue sin estar en disco.** El repo `oranje-mockups` no está clonado, así que la §1 declara una fuente de verdad que nadie puede leer. Todo token de esta nota está derivado o medido, no leído de la semilla.
4. **El Sistema de Diseño en Figma quedó desactualizado.** El archivo `Oranje` (`fileKey` g1cYWZisiq6jbXvULvUVOw) tiene las 34 variables con **#FF8E00** y la tipografía anterior. Hay que resincronizarlo antes del siguiente maquetado.
5. **Los colores de gráfica del Portfolio no son de Oranje.** #945BFF, #4E3A8E, #00BEA5 y #E12BFF salen del template de reporte que sirvió de referente. **No se adoptan.** La paleta de series de gráfica es decisión abierta.

---

## Componentes del sistema

> [!info] Estas clases son el lenguaje de los mockups, no el de la app
> En la plataforma, estos componentes se implementan sobre las primitivas de **shadcn/ui** en el web y de **react-native-reusables** en el móvil (D-16 de [[Arquitecturas/_Globales/Decisiones de Arquitectura|Decisiones de Arquitectura]]). Dos cosas no se negocian al hacerlo: los tokens de esta nota son la **única** fuente de tema —las variables de shadcn se declaran derivadas de ellos— y la iconografía sigue siendo **Material Icons**, así que al copiar un componente se cambia su import de `lucide-react`. El **KPI rico**, los **accesos rápidos**, el **stepper de flujo** y el **chip de semáforo** no tienen equivalente en ninguna de las dos librerías: se escriben como composiciones.

- **Shell** (`.app`, `.sidebar`, `.main`, `.header`, `.content`): estructura base de la app; contiene todos los demás elementos.
- **Navegación lateral** (`.sb-item`, `.sb-label`, `.count`, `.sb-foot`, `.sb-user`): ítems del sidebar con barra de acento activa.
- **Header** (`.hd-crumbs`, `.ic-btn`, `.badge`, `.hd-profile`, `.avatar`): breadcrumbs a la izquierda; botones de acción con badge y perfil a la derecha.
- **Dropdowns de header** (`.dd`, `.notif-item`, `.prof-dd`, `.prof-menu`): panel de notificaciones y menú de perfil desplegables desde el header.
- **Page header** (`.ph`): encabezado de cada vista con título y acciones de página.
- **Botones** (`.btn` con variantes `primary`, `ghost`, `sm`, `block`).
- **Cards** (`.card`, `.card-h`, `.card-b`): contenedor genérico de contenido.
- **KPI rico** (`.kpi`, `.ki`, `.val`, `.trend`, `.foot`): tarjeta de métrica con chip de ícono, valor principal, tendencia y pie; tinte por métrica.
- **Card destacada** (`.qa-hero`): card de llamada a la acción principal.
- **Accesos rápidos** (`.qa` con variantes `primary`, `soft`, `line`): chips de ícono en tonos naranja para acciones frecuentes.
- **Tile** (`.tile`): bloque compacto de información.
- **Chip de semáforo** (`.st-chip`): pastilla de color que representa el estado del [[Semáforo del Colaborador]].
- **Meta pill** (`.meta-pill`): etiqueta de metadato.
- **Tablas** (`.tbl`): tabla de datos con estilo unificado.
- **Formularios** (`.field`, `.inp`, `.sel`, `.ta`, `.upload`): campos de texto, selectores, áreas de texto y carga de archivos.
- **Filas de info** (`.irow`): fila de clave/valor para detalle de entidad.
- **Banners** (`.banner` con variantes `info`, `warn`, `ok`): alertas contextuales.
- **Toggle** (`.switch`): interruptor on/off.
- **Tabs** (`.tabs`, `.tab`): pestañas de navegación dentro de una vista.
- **Stepper de flujo** (`.flow`, `.flow-step`, `.flow-ic`, `.flow-num`, `.flow-arrow`): proceso por pasos horizontal con íconos numerados y flechas; ideal para explicar flujos de estado (p. ej. Amarillo → Café → Verde).
- **Empty state** (`.empty`): estado vacío con ícono y mensaje, para listas o tablas sin datos.
- **Toast** (`#toast`): notificación temporal de retroalimentación (oculta con opacidad cuando inactiva).
- **Modal** (`.modal-bg`, `.modal`): capa de diálogo.

---

## Principios de diseño

> [!important]
> Estas reglas aplican a todos los mockups de la plataforma Oranje.

1. **Reutilizar la semilla, no reimplementar.** Cada mockup enlaza `oranje-seed.css` y solo agrega estilos exclusivos del rol encima. No se duplican componentes.
2. **Nada decorativo.** Todo lo que parece clickeable debe funcionar. No se agregan elementos UI sin comportamiento asociado.
3. **Notificaciones y Perfil van en el header.** La campana (notificaciones) y el avatar (menú de perfil) viven en el header, no como módulos del sidebar.
4. **Iconografía en tonos naranja.** Las acciones rápidas usan chips de ícono en tonos naranja para armonía cálida; se evitan colores sólidos chillones.

---

## Mockups que usan la semilla

| Mockup         | Ruta en repo                                                        | Notas                |
| -------------- | ------------------------------------------------------------------- | -------------------- |
| Líder de Grupo | `Mockups/Reclutamiento/Lider de grupo/Lider de Grupo - Oranje.html` | Origen de la semilla |
| Colaborador    | `Mockups/Colaborador/Colaborador - Oranje.html`                     | —                    |

---

## Relacionado

- [[Arquitecturas/_Globales/Decisiones de Arquitectura|Decisiones de Arquitectura]] — D-12 y D-16, el stack de estilos y componentes
- [[Arquitecturas/_Globales/Estructura de Proyecto y Nomenclatura|Estructura de Proyecto y Nomenclatura]] — §6, dónde vive cada componente
- [[Estructura General App]]
- [[Semáforo del Colaborador]]
- [[00 - Arquitectura Colaborador]]
- [[12 - Mockup y Decisiones de UI]]
