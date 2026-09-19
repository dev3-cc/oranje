#!/usr/bin/env bash
# Clona la base de staging a producción y limpia lo de prueba (2026-09-19).
#
# Por qué clonar y no sembrar de cero: staging YA tiene lo real — los 307
# colaboradores migrados de AWS, los hoteles de Georgia con sus prospectos y
# contrato, el personal interno y los puestos que Hugo agregó al catálogo. Un
# clon conserva todos los uuid (catálogos, roles, estados) y con eso no hay
# nada que mapear; después `limpiar-datos-prueba.sql` quita la basura de las
# suites y `seed` + `grants` dejan permisos y privilegios como manda el repo.
#
# Requiere dos Cloud SQL Auth Proxy corriendo:
#   staging  → localhost:5433  (oranjeapp-gcp:us-central1:oranje)
#   prod     → localhost:5434  (oranje-prod:us-central1:oranje)
# Las contraseñas salen de Secret Manager al vuelo; nunca se imprimen.
#
# Pasos (cada uno se puede repetir):
#   1 dump      pg_dump de staging (esquemas de la app + _prisma_migrations)
#   2 restore   pg_restore --clean en prod (borra y recrea; prod queda = staging)
#   3 limpiar   limpiar-datos-prueba.sql en una transacción
#   4 seed      permisos/estados/catálogos como en el repo (idempotente)
#   5 grants    privilegios de app_user (grants.sql)
#   6 firebase  cuentas con contraseña: migrar-cuentas-firebase.mjs
#   7 bucket    fotos y documentos: gs://oranje-staging-files → oranje-prod-files
#
# Uso: scripts/prod/clonar-staging-a-prod.sh [paso...]   (sin pasos = todos)
set -euo pipefail
cd "$(dirname "$0")/../.."   # apps/api

STAGING_PROJECT=oranjeapp-gcp
PROD_PROJECT=oranje-prod
STAGING_PORT=5433
PROD_PORT=5434
DUMP="${TMPDIR:-/tmp}/oranje-staging.dump"

secreto() { gcloud secrets versions access latest --secret "$1" --project "$2"; }
clave_de() { sed -E 's#.*://[^:]+:([^@]+)@.*#\1#' <<<"$1"; }

STAGING_OWNER_URL=$(secreto oranje-migrate-database-url "$STAGING_PROJECT")
PROD_OWNER_URL=$(secreto oranje-migrate-database-url "$PROD_PROJECT")
export STAGING_PGPASSWORD=$(clave_de "$STAGING_OWNER_URL")
export PROD_PGPASSWORD=$(clave_de "$PROD_OWNER_URL")
# El .sql de grants espera MIGRATE_DATABASE_URL; se arma contra el proxy.
export MIGRATE_DATABASE_URL="postgresql://oranje_dev:${PROD_PGPASSWORD}@localhost:${PROD_PORT}/oranje"

ESQUEMAS=(catalogs commercial coverage demand identity journal notifications operations personal settlement supervision public)

paso_dump() {
  echo "== 1 dump de staging"
  local args=()
  for s in "${ESQUEMAS[@]}"; do args+=(--schema="$s"); done
  # spatial_ref_sys es de PostGIS (ya existe en prod); el resto de public es
  # solo _prisma_migrations.
  PGPASSWORD="$STAGING_PGPASSWORD" pg_dump -h localhost -p "$STAGING_PORT" -U oranje_dev -d oranje \
    --format=custom --no-owner --no-privileges "${args[@]}" \
    --exclude-table=public.spatial_ref_sys --file "$DUMP"
  ls -la "$DUMP"
}

paso_restore() {
  echo "== 2 restore en prod (--clean: prod queda igual a staging)"
  # Se vacía prod antes (los esquemas de la app completos): `--clean` de
  # pg_restore se atora con las particiones del journal ("cannot drop
  # inherited constraint"). El dump trae los CREATE SCHEMA.
  local drops=""
  for s in "${ESQUEMAS[@]}"; do
    [ "$s" = public ] && continue
    drops+="DROP SCHEMA IF EXISTS $s CASCADE;"
  done
  PGPASSWORD="$PROD_PGPASSWORD" psql -h localhost -p "$PROD_PORT" -U oranje_dev -d oranje -v ON_ERROR_STOP=1 -q \
    -c "$drops" -c 'DROP TABLE IF EXISTS public._prisma_migrations;' \
    -c 'DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;'
  # pg_dump 17 emite `SET transaction_timeout`, que Postgres 15 no conoce:
  # se convierte a SQL, se filtra esa línea y se corre con psql parando en
  # el primer error real.
  PGPASSWORD="$PROD_PGPASSWORD" pg_restore --no-owner --no-privileges -f - "$DUMP" \
    | grep -v '^SET transaction_timeout' \
    | grep -v '^CREATE SCHEMA public;' \
    | grep -v '^COMMENT ON SCHEMA public ' \
    | PGPASSWORD="$PROD_PGPASSWORD" psql -h localhost -p "$PROD_PORT" -U oranje_dev -d oranje \
        -v ON_ERROR_STOP=1 -q
  PGPASSWORD="$PROD_PGPASSWORD" psql -h localhost -p "$PROD_PORT" -U oranje_dev -d oranje -Atc \
    "select count(*) || ' tablas' from information_schema.tables where table_schema in ('catalogs','commercial','coverage','demand','identity','journal','notifications','operations','personal','settlement','supervision')"
}

paso_limpiar() {
  echo "== 3 limpiar datos de prueba en prod"
  PGPASSWORD="$PROD_PGPASSWORD" psql -h localhost -p "$PROD_PORT" -U oranje_dev -d oranje \
    -v ON_ERROR_STOP=1 --single-transaction -f scripts/prod/limpiar-datos-prueba.sql
}

paso_seed() {
  echo "== 4 seed en prod"
  MIGRATE_DATABASE_URL="$MIGRATE_DATABASE_URL" pnpm exec tsx prisma/seed.ts
}

paso_grants() {
  echo "== 5 grants en prod"
  psql "$MIGRATE_DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/grants.sql
}

paso_firebase() {
  echo "== 6 cuentas de Firebase (con contraseña) staging → prod"
  # Solo las cuentas que sobrevivieron a la limpieza: las de prueba no viajan.
  local correos="${TMPDIR:-/tmp}/oranje-correos-prod.txt"
  PGPASSWORD="$PROD_PGPASSWORD" psql -h localhost -p "$PROD_PORT" -U oranje_dev -d oranje -Atc \
    'SELECT lower(email) FROM identity."user"' > "$correos"
  node scripts/prod/migrar-cuentas-firebase.mjs "$STAGING_PROJECT" "$PROD_PROJECT" "$correos"
  rm -f "$correos"
}

paso_bucket() {
  echo "== 7 archivos del bucket"
  gcloud storage rsync --recursive "gs://oranje-staging-files" "gs://oranje-prod-files"
}

PASOS=("$@")
[ ${#PASOS[@]} -eq 0 ] && PASOS=(dump restore limpiar seed grants firebase bucket)
for p in "${PASOS[@]}"; do "paso_$p"; done
echo "== listo"
