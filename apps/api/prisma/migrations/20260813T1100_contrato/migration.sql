-- CreateTable
CREATE TABLE "commercial"."contract" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "prospect_id" UUID,
    "number" TEXT NOT NULL,
    "overtime_bill_multiplier" DECIMAL(4,2) NOT NULL DEFAULT 1.5,
    "overtime_pay_multiplier" DECIMAL(4,2) NOT NULL DEFAULT 1.0,
    "holiday_bill_multiplier" DECIMAL(4,2) NOT NULL DEFAULT 2.0,
    "holiday_pay_multiplier" DECIMAL(4,2) NOT NULL DEFAULT 1.0,
    "week_start_day" INTEGER NOT NULL,
    "week_end_day" INTEGER NOT NULL,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "renewal_notes" TEXT,
    "signed_by" UUID,
    "signed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial"."contract_rate" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "catalog_position_id" UUID NOT NULL,
    "pay_rate" DECIMAL(10,2) NOT NULL,
    "bill_rate" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "contract_rate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogs"."holiday" (
    "id" UUID NOT NULL,
    "holiday_date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'US',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holiday_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ix_contract_hotel" ON "commercial"."contract"("hotel_id");

-- CreateIndex
CREATE UNIQUE INDEX "ux_contract_number" ON "commercial"."contract"("number");

-- CreateIndex
CREATE UNIQUE INDEX "ux_contract_rate_position" ON "commercial"."contract_rate"("contract_id", "catalog_position_id");

-- CreateIndex
CREATE UNIQUE INDEX "ux_holiday_date_country" ON "catalogs"."holiday"("holiday_date", "country");

-- AddForeignKey
ALTER TABLE "commercial"."contract" ADD CONSTRAINT "contract_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "commercial"."hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."contract" ADD CONSTRAINT "contract_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "commercial"."prospect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."contract" ADD CONSTRAINT "contract_signed_by_fkey" FOREIGN KEY ("signed_by") REFERENCES "identity"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."contract_rate" ADD CONSTRAINT "contract_rate_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "commercial"."contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."contract_rate" ADD CONSTRAINT "contract_rate_catalog_position_id_fkey" FOREIGN KEY ("catalog_position_id") REFERENCES "catalogs"."position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ###########################################################################
-- Lo que Prisma no sabe declarar
-- ###########################################################################

-- --- un solo contrato VIGENTE por hotel ----------------------------------
-- El historico se conserva entero —los contratos se renuevan— pero solo uno manda
-- a la vez. Es PARCIAL: un unico simple sobre hotel_id impediria la renovacion.
--
-- Y de aqui sale una regla del servicio: el Consolidado no debe leer "el contrato
-- del hotel", sino el contrato vigente EN LA FECHA de la semana que liquida. Si
-- el rate subio el martes, la semana anterior se paga al rate viejo.
CREATE UNIQUE INDEX ux_contract_active
  ON commercial.contract (hotel_id)
  WHERE status = 'ACTIVE';

ALTER TABLE commercial.contract
  ADD CONSTRAINT ck_contract_status CHECK (
    status IN ('DRAFT', 'ACTIVE', 'EXPIRED', 'CANCELLED'));

-- --- la vigencia va hacia adelante ---------------------------------------
-- valid_to nulable es un contrato SIN fecha de fin, que es lo normal: el vault
-- habla de renovacion, no de expiracion automatica.
ALTER TABLE commercial.contract
  ADD CONSTRAINT ck_contract_validity CHECK (
    valid_to IS NULL OR valid_to > valid_from);

-- --- los dias de la semana existen ---------------------------------------
-- Convencion de Postgres: 0 = domingo, 1 = lunes. La Simulacion de Ventas usa
-- lunes a domingo, o sea 1 y 0.
ALTER TABLE commercial.contract
  ADD CONSTRAINT ck_contract_week CHECK (
    week_start_day BETWEEN 0 AND 6
    AND week_end_day BETWEEN 0 AND 6
    AND week_start_day <> week_end_day);

-- --- ningun multiplicador reduce el pago ---------------------------------
ALTER TABLE commercial.contract
  ADD CONSTRAINT ck_contract_multipliers CHECK (
    overtime_bill_multiplier >= 1 AND overtime_pay_multiplier >= 1
    AND holiday_bill_multiplier >= 1 AND holiday_pay_multiplier >= 1);

-- Y el hotel nunca paga menos recargo que el colaborador. Si el multiplicador del
-- colaborador supera al del hotel, Oranje PIERDE dinero en cada hora extra — y
-- como el overtime pasa todas las semanas, ese error se acumula rapido antes de
-- que alguien lo note en el margen.
ALTER TABLE commercial.contract
  ADD CONSTRAINT ck_contract_multiplier_margin CHECK (
    overtime_bill_multiplier >= overtime_pay_multiplier
    AND holiday_bill_multiplier >= holiday_pay_multiplier);

-- --- ningun rate negativo, y el bill nunca por debajo del pay ------------
-- La segunda es la que importa: si el bill rate queda por debajo del pay rate,
-- Oranje pierde dinero en cada hora trabajada. Un dedo mal puesto al capturar el
-- contrato costaria una semana entera antes de que alguien lo note.
ALTER TABLE commercial.contract_rate
  ADD CONSTRAINT ck_contract_rate_positive CHECK (
    pay_rate > 0 AND bill_rate > 0),
  ADD CONSTRAINT ck_contract_rate_margin CHECK (
    bill_rate >= pay_rate);

-- --- updated_at lo mantiene la base (seccion 4) --------------------------
CREATE TRIGGER tg_contract_updated_at BEFORE UPDATE ON commercial.contract
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tg_contract_rate_updated_at BEFORE UPDATE ON commercial.contract_rate
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- NOTA: lo que la base NO puede impedir es un contrato ACTIVE sin ningun
-- contract_rate. Una FK no obliga a que existan hijos, y no hay forma de
-- expresarlo como restriccion. Es guard del servicio al activar el contrato: uno
-- sin tarifas no puede pagar ni facturar nada.
