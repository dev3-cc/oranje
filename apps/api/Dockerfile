# Imagen del API. Un solo artefacto para los dos ambientes desplegados: lo
# único que cambia entre staging y producción son las variables (APP_ENV,
# las llaves, la cadena de la base). El build NO se repite por ambiente.
#
# Se construye desde la RAÍZ del monorepo, no desde apps/api:
#   docker build -f apps/api/Dockerfile .
# El lockfile y los package.json de los otros paquetes viven arriba, y sin
# ellos `--frozen-lockfile` falla.

# ---------------------------------------------------------------------------
FROM node:26-slim AS builder

# openssl lo necesita el motor de consultas de Prisma; sin él, el binario que
# se descarga en la instalación no carga
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# pnpm se instala con npm, no con corepack: Node 25 lo sacó de la imagen oficial.
# La version va fijada a mano porque `packageManager` del package.json solo lo
# lee corepack — si esa cambia, esta linea tiene que cambiar con ella
RUN npm install --global pnpm@11.20.0

WORKDIR /repo
COPY . .

# El postinstall de apps/api corre `prisma generate`. Se hace DENTRO de la
# imagen a propósito: el motor de Prisma es un binario por plataforma, y el que
# se genera en una Mac no sirve en Linux
RUN pnpm install --frozen-lockfile

RUN pnpm -F @oranje/api build

# ---------------------------------------------------------------------------
FROM node:26-slim AS runner

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

# pnpm enlaza con rutas relativas hacia node_modules/.pnpm de la raíz, así que
# hay que conservar las dos carpetas y su posición relativa o los symlinks
# quedan colgando
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /repo/apps/api/dist ./apps/api/dist

# Las migraciones viajan en la imagen para poder correr `migrate deploy` con el
# mismo artefacto que se despliega, y no con lo que tenga alguien en su máquina
COPY --from=builder /repo/apps/api/prisma ./apps/api/prisma
COPY --from=builder /repo/apps/api/package.json ./apps/api/package.json
COPY --from=builder /repo/apps/api/prisma.config.ts ./apps/api/prisma.config.ts

# Cloud Run inyecta PORT; 8080 es su valor por omisión
ENV PORT=8080
EXPOSE 8080

# Nunca como root: si alguien escapa del proceso, que no sea dueño del sistema
USER node

CMD ["node", "apps/api/dist/main.js"]
