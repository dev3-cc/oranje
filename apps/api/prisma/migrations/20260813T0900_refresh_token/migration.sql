-- La sesion viva. El access token dura 15 minutos y no se guarda en ningun
-- lado; esta tabla existe para poder MATAR una sesion antes de que expire su
-- refresh, que dura 7 dias (Estandares de Desarrollo §6).
--
-- Sin GRANT: identity ya tiene ALTER DEFAULT PRIVILEGES para app_user, asi que
-- la tabla nace con el DML que la aplicacion necesita.

-- CreateTable
CREATE TABLE "identity"."refresh_token" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "replaced_by_id" UUID,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refresh_token_token_hash_key" ON "identity"."refresh_token"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_token_replaced_by_id_key" ON "identity"."refresh_token"("replaced_by_id");

-- CreateIndex
CREATE INDEX "ix_refresh_token_user" ON "identity"."refresh_token"("user_id");

-- CreateIndex
CREATE INDEX "ix_refresh_token_expires" ON "identity"."refresh_token"("expires_at");

-- AddForeignKey
ALTER TABLE "identity"."refresh_token" ADD CONSTRAINT "refresh_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."refresh_token" ADD CONSTRAINT "refresh_token_replaced_by_id_fkey" FOREIGN KEY ("replaced_by_id") REFERENCES "identity"."refresh_token"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

