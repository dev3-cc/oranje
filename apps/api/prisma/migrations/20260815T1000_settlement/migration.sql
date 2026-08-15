-- AlterTable
ALTER TABLE "commercial"."contract" ADD COLUMN     "deducts_meals" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "splits_invoice_by_month" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "personal"."worker_rate" (
    "id" UUID NOT NULL,
    "worker_id" UUID NOT NULL,
    "catalog_position_id" UUID,
    "rate" DECIMAL(10,2) NOT NULL,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,
    "authorized_by" UUID NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worker_rate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement"."consolidation" (
    "id" UUID NOT NULL,
    "worker_id" UUID NOT NULL,
    "week_start" DATE NOT NULL,
    "week_end" DATE NOT NULL,
    "gross_amount" DECIMAL(12,2) NOT NULL,
    "deduction_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "validated_by" UUID,
    "validated_at" TIMESTAMPTZ(6),
    "authorized_by" UUID,
    "authorized_at" TIMESTAMPTZ(6),
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "consolidation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement"."consolidation_detail" (
    "id" UUID NOT NULL,
    "consolidation_id" UUID NOT NULL,
    "requisition_id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "catalog_position_id" UUID NOT NULL,
    "regular_minutes" INTEGER NOT NULL,
    "overtime_minutes" INTEGER NOT NULL DEFAULT 0,
    "pay_rate_applied" DECIMAL(10,2) NOT NULL,
    "overtime_multiplier_applied" DECIMAL(4,2) NOT NULL,
    "is_internal_rate" BOOLEAN NOT NULL DEFAULT false,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consolidation_detail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement"."deduction" (
    "id" UUID NOT NULL,
    "consolidation_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "source_note" TEXT,
    "refunded_at" TIMESTAMPTZ(6),
    "refunded_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement"."invoice" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "folio" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "credit_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement"."invoice_detail" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "requisition_id" UUID NOT NULL,
    "worker_id" UUID NOT NULL,
    "catalog_position_id" UUID NOT NULL,
    "regular_minutes" INTEGER NOT NULL,
    "overtime_minutes" INTEGER NOT NULL DEFAULT 0,
    "bill_rate_applied" DECIMAL(10,2) NOT NULL,
    "overtime_multiplier_applied" DECIMAL(4,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_detail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ix_worker_rate_worker" ON "personal"."worker_rate"("worker_id", "valid_from" DESC);

-- CreateIndex
CREATE INDEX "ix_consolidation_status" ON "settlement"."consolidation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ux_consolidation_worker_week" ON "settlement"."consolidation"("worker_id", "week_start");

-- CreateIndex
CREATE INDEX "ix_consolidation_detail_hotel" ON "settlement"."consolidation_detail"("hotel_id");

-- CreateIndex
CREATE UNIQUE INDEX "ux_consolidation_detail_req" ON "settlement"."consolidation_detail"("consolidation_id", "requisition_id");

-- CreateIndex
CREATE INDEX "ix_deduction_consolidation" ON "settlement"."deduction"("consolidation_id");

-- CreateIndex
CREATE INDEX "ix_deduction_type" ON "settlement"."deduction"("type");

-- CreateIndex
CREATE INDEX "ix_invoice_status" ON "settlement"."invoice"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ux_invoice_folio" ON "settlement"."invoice"("folio");

-- CreateIndex
CREATE UNIQUE INDEX "ux_invoice_hotel_period" ON "settlement"."invoice"("hotel_id", "period_start", "period_end");

-- CreateIndex
CREATE INDEX "ix_invoice_detail_invoice" ON "settlement"."invoice_detail"("invoice_id");

-- CreateIndex
CREATE INDEX "ix_invoice_detail_worker" ON "settlement"."invoice_detail"("worker_id");

-- AddForeignKey
ALTER TABLE "personal"."worker_rate" ADD CONSTRAINT "worker_rate_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "personal"."worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal"."worker_rate" ADD CONSTRAINT "worker_rate_catalog_position_id_fkey" FOREIGN KEY ("catalog_position_id") REFERENCES "catalogs"."position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal"."worker_rate" ADD CONSTRAINT "worker_rate_authorized_by_fkey" FOREIGN KEY ("authorized_by") REFERENCES "identity"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement"."consolidation" ADD CONSTRAINT "consolidation_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "personal"."worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement"."consolidation" ADD CONSTRAINT "consolidation_validated_by_fkey" FOREIGN KEY ("validated_by") REFERENCES "identity"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement"."consolidation" ADD CONSTRAINT "consolidation_authorized_by_fkey" FOREIGN KEY ("authorized_by") REFERENCES "identity"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement"."consolidation_detail" ADD CONSTRAINT "consolidation_detail_consolidation_id_fkey" FOREIGN KEY ("consolidation_id") REFERENCES "settlement"."consolidation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement"."consolidation_detail" ADD CONSTRAINT "consolidation_detail_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "demand"."requisition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement"."consolidation_detail" ADD CONSTRAINT "consolidation_detail_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "commercial"."hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement"."consolidation_detail" ADD CONSTRAINT "consolidation_detail_catalog_position_id_fkey" FOREIGN KEY ("catalog_position_id") REFERENCES "catalogs"."position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement"."deduction" ADD CONSTRAINT "deduction_consolidation_id_fkey" FOREIGN KEY ("consolidation_id") REFERENCES "settlement"."consolidation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement"."deduction" ADD CONSTRAINT "deduction_refunded_by_fkey" FOREIGN KEY ("refunded_by") REFERENCES "identity"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement"."invoice" ADD CONSTRAINT "invoice_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "commercial"."hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement"."invoice" ADD CONSTRAINT "invoice_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "identity"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement"."invoice_detail" ADD CONSTRAINT "invoice_detail_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "settlement"."invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement"."invoice_detail" ADD CONSTRAINT "invoice_detail_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "demand"."requisition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement"."invoice_detail" ADD CONSTRAINT "invoice_detail_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "personal"."worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement"."invoice_detail" ADD CONSTRAINT "invoice_detail_catalog_position_id_fkey" FOREIGN KEY ("catalog_position_id") REFERENCES "catalogs"."position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ###########################################################################
-- Lo que Prisma no sabe declarar
-- ###########################################################################

-- --- un solo rate personal vigente por posicion --------------------------
-- PARCIAL y con NULLS NOT DISTINCT a la vez. Parcial porque el historial de
-- aumentos se conserva y solo el ultimo esta vigente. Y NULLS NOT DISTINCT porque
-- catalog_position_id nulo significa "todas las posiciones": sin la clausula, dos
-- filas globales pasarian las dos, ya que en Postgres dos NULL son distintos entre
-- si. Es la misma trampa de status_light_transition.
CREATE UNIQUE INDEX ux_worker_rate_active
  ON personal.worker_rate (worker_id, catalog_position_id)
  NULLS NOT DISTINCT
  WHERE valid_to IS NULL;

ALTER TABLE personal.worker_rate
  ADD CONSTRAINT ck_worker_rate CHECK (
    rate > 0 AND (valid_to IS NULL OR valid_to > valid_from));

-- --- solo lo autorizado se paga ------------------------------------------
-- El Flujo de Nomina tiene DOS firmas: la Contadora valida y el Manager de
-- Contabilidad autoriza. Un consolidado autorizado sin las dos es una nomina que
-- nadie reviso.
ALTER TABLE settlement.consolidation
  ADD CONSTRAINT ck_consolidation_status CHECK (
    status IN ('DRAFT', 'VALIDATED', 'AUTHORIZED', 'PAID')),
  ADD CONSTRAINT ck_consolidation_signatures CHECK (
    status IN ('DRAFT', 'VALIDATED')
    OR (validated_by IS NOT NULL AND validated_at IS NOT NULL
        AND authorized_by IS NOT NULL AND authorized_at IS NOT NULL)),
  ADD CONSTRAINT ck_consolidation_validated CHECK (
    (validated_by IS NULL) = (validated_at IS NULL)),
  ADD CONSTRAINT ck_consolidation_authorized CHECK (
    (authorized_by IS NULL) = (authorized_at IS NULL)),
  ADD CONSTRAINT ck_consolidation_paid CHECK (
    paid_at IS NULL OR status = 'PAID');

-- --- el neto CUADRA, no es un numero que alguien escribio ----------------
-- La tercera condicion es la que importa. Y la cuarta impide un cheque negativo:
-- si las deducciones superan lo ganado, el sistema tiene que decidir que hacer, no
-- emitir una deuda.
ALTER TABLE settlement.consolidation
  ADD CONSTRAINT ck_consolidation_amounts CHECK (
    gross_amount >= 0
    AND deduction_amount >= 0
    AND net_amount = gross_amount - deduction_amount
    AND net_amount >= 0),
  ADD CONSTRAINT ck_consolidation_week CHECK (week_end > week_start);

-- --- el rate congelado nunca es cero -------------------------------------
-- Un rate en cero significaria trabajo gratis. Es el error que pasa cuando el
-- calculo no encuentra el contrato vigente y escribe el default del lenguaje.
ALTER TABLE settlement.consolidation_detail
  ADD CONSTRAINT ck_detail_rate CHECK (
    pay_rate_applied > 0
    AND overtime_multiplier_applied >= 1
    AND regular_minutes >= 0
    AND overtime_minutes >= 0
    AND subtotal >= 0);

ALTER TABLE settlement.invoice_detail
  ADD CONSTRAINT ck_invoice_detail_rate CHECK (
    bill_rate_applied > 0
    AND overtime_multiplier_applied >= 1
    AND regular_minutes >= 0
    AND overtime_minutes >= 0
    AND subtotal >= 0);

-- --- el reembolso deja rastro, y solo la retencion es reembolsable -------
-- La ultima es la que sorprende: el uniforme y la comida NO se devuelven, asi que
-- marcarlos como reembolsados seria un error que nadie notaria hasta cuadrar caja.
ALTER TABLE settlement.deduction
  ADD CONSTRAINT ck_deduction_type CHECK (
    type IN ('UNIFORM', 'MEALS', 'TAX_RETENTION')),
  ADD CONSTRAINT ck_deduction_amount CHECK (amount > 0),
  ADD CONSTRAINT ck_deduction_refund CHECK (
    (refunded_at IS NULL) = (refunded_by IS NULL)),
  ADD CONSTRAINT ck_deduction_refundable CHECK (
    refunded_at IS NULL OR type = 'TAX_RETENTION');

-- --- la factura ----------------------------------------------------------
ALTER TABLE settlement.invoice
  ADD CONSTRAINT ck_invoice_status CHECK (
    status IN ('DRAFT', 'APPROVED', 'SENT', 'PAID')),
  ADD CONSTRAINT ck_invoice_amounts CHECK (
    total_amount >= 0 AND credit_amount >= 0),
  ADD CONSTRAINT ck_invoice_period CHECK (period_end >= period_start),
  ADD CONSTRAINT ck_invoice_approved CHECK (
    (approved_by IS NULL) = (approved_at IS NULL));

-- --- el saldo de la retencion, en vista ----------------------------------
-- La retencion del 16% es REEMBOLSABLE, asi que hay que poder sumar lo retenido
-- que aun no se devuelve. Se evaluo una tabla de saldo acumulado y se descarto:
-- seria un total desnormalizado que puede desincronizarse, cuando la suma es una
-- consulta.
CREATE VIEW settlement.vw_tax_retention_balance AS
SELECT
  c.worker_id,
  sum(d.amount)                                   AS retained_total,
  sum(d.amount) FILTER (WHERE d.refunded_at IS NULL) AS pending_refund,
  max(d.created_at)                               AS last_retention_at
FROM settlement.deduction d
JOIN settlement.consolidation c ON c.id = d.consolidation_id
WHERE d.type = 'TAX_RETENTION'
GROUP BY c.worker_id;

GRANT SELECT ON settlement.vw_tax_retention_balance TO app_user;

-- --- updated_at lo mantiene la base (seccion 4) --------------------------
CREATE TRIGGER tg_consolidation_updated_at BEFORE UPDATE ON settlement.consolidation
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tg_invoice_updated_at BEFORE UPDATE ON settlement.invoice
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- NOTA: lo que la base NO puede impedir es que el total del consolidado cuadre con
-- la suma de sus detalles menos sus deducciones. Un CHECK solo ve su propia fila.
-- Necesita un trigger o una verificacion del servicio al cerrar la semana — y un
-- test que lo compruebe, porque un consolidado descuadrado es dinero mal pagado.
