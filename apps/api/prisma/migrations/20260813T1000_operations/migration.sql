-- CreateTable
CREATE TABLE "operations"."schedule" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "week_start" DATE NOT NULL,
    "week_end" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),
    "created_by" UUID NOT NULL,

    CONSTRAINT "schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operations"."schedule_entry" (
    "id" UUID NOT NULL,
    "schedule_id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "worker_id" UUID NOT NULL,
    "work_date" DATE NOT NULL,
    "shift_range" tstzrange NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "schedule_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operations"."timesheet" (
    "id" UUID NOT NULL,
    "schedule_id" UUID NOT NULL,
    "worker_id" UUID NOT NULL,
    "requisition_id" UUID NOT NULL,
    "week_start" DATE NOT NULL,
    "week_end" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "timesheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operations"."timesheet_day" (
    "id" UUID NOT NULL,
    "timesheet_id" UUID NOT NULL,
    "work_date" DATE NOT NULL,
    "gross_minutes" INTEGER NOT NULL,
    "lunch_deduction_minutes" INTEGER NOT NULL DEFAULT 30,
    "overtime_minutes" INTEGER NOT NULL DEFAULT 0,
    "is_absence" BOOLEAN NOT NULL DEFAULT false,
    "has_anomaly" BOOLEAN NOT NULL DEFAULT false,
    "review_note" TEXT,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "timesheet_day_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operations"."punch_mark" (
    "id" UUID NOT NULL,
    "timesheet_day_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "device_at" TIMESTAMPTZ(6),
    "server_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "coordinates" geography(Point, 4326),
    "inside_geofence" BOOLEAN,
    "photo_path" TEXT,
    "is_manual" BOOLEAN NOT NULL DEFAULT false,
    "registered_by" UUID,
    "manual_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "punch_mark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ux_schedule_hotel_week" ON "operations"."schedule"("hotel_id", "week_start");

-- CreateIndex
CREATE INDEX "ix_schedule_entry_schedule" ON "operations"."schedule_entry"("schedule_id");

-- CreateIndex
CREATE INDEX "ix_schedule_entry_worker_date" ON "operations"."schedule_entry"("worker_id", "work_date");

-- CreateIndex
CREATE INDEX "ix_timesheet_schedule" ON "operations"."timesheet"("schedule_id");

-- CreateIndex
CREATE INDEX "ix_timesheet_requisition" ON "operations"."timesheet"("requisition_id");

-- CreateIndex
CREATE UNIQUE INDEX "ux_timesheet_worker_week_req" ON "operations"."timesheet"("worker_id", "week_start", "requisition_id");

-- CreateIndex
CREATE INDEX "ix_timesheet_day_date" ON "operations"."timesheet_day"("work_date");

-- CreateIndex
CREATE UNIQUE INDEX "ux_timesheet_day" ON "operations"."timesheet_day"("timesheet_id", "work_date");

-- CreateIndex
CREATE UNIQUE INDEX "ux_punch_day_type" ON "operations"."punch_mark"("timesheet_day_id", "type");

-- AddForeignKey
ALTER TABLE "operations"."schedule" ADD CONSTRAINT "schedule_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "commercial"."hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations"."schedule" ADD CONSTRAINT "schedule_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "identity"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations"."schedule_entry" ADD CONSTRAINT "schedule_entry_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "operations"."schedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations"."schedule_entry" ADD CONSTRAINT "schedule_entry_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "coverage"."assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations"."schedule_entry" ADD CONSTRAINT "schedule_entry_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "personal"."worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations"."timesheet" ADD CONSTRAINT "timesheet_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "operations"."schedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations"."timesheet" ADD CONSTRAINT "timesheet_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "personal"."worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations"."timesheet" ADD CONSTRAINT "timesheet_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "demand"."requisition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations"."timesheet" ADD CONSTRAINT "timesheet_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "identity"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations"."timesheet_day" ADD CONSTRAINT "timesheet_day_timesheet_id_fkey" FOREIGN KEY ("timesheet_id") REFERENCES "operations"."timesheet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations"."timesheet_day" ADD CONSTRAINT "timesheet_day_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "identity"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations"."punch_mark" ADD CONSTRAINT "punch_mark_timesheet_day_id_fkey" FOREIGN KEY ("timesheet_day_id") REFERENCES "operations"."timesheet_day"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations"."punch_mark" ADD CONSTRAINT "punch_mark_registered_by_fkey" FOREIGN KEY ("registered_by") REFERENCES "identity"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ###########################################################################
-- Lo que Prisma no sabe declarar
-- ###########################################################################

-- --- RR-05: sin solape de horas ------------------------------------------
-- La regla que ningun esquema anterior pudo hacer cumplir. Va sobre el turno
-- PLANEADO porque el choque hay que impedirlo al ASIGNAR, no descubrirlo cuando
-- el colaborador ya se presento. btree_gist es lo que permite mezclar el = de un
-- uuid con el && de un rango en la misma restriccion.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE operations.schedule_entry
  ADD CONSTRAINT no_shift_overlap
  EXCLUDE USING gist (worker_id WITH =, shift_range WITH &&);

-- --- listas cerradas: text + CHECK ---------------------------------------
ALTER TABLE operations.punch_mark
  ADD CONSTRAINT ck_punch_type CHECK (
    type IN ('CLOCK_IN', 'LUNCH_OUT', 'LUNCH_IN', 'CLOCK_OUT'));

-- La foto solo se exige en los extremos. El par de lunch no la lleva y es
-- OPCIONAL: su ausencia no es un error, el sistema deduce los 30 min igual.
-- Un ponche MANUAL tampoco: es justo el caso en que el colaborador no pudo
-- ponchar, asi que exigirsela seria pedirle lo que no tiene.
ALTER TABLE operations.punch_mark
  ADD CONSTRAINT ck_punch_photo CHECK (
    type IN ('LUNCH_OUT', 'LUNCH_IN') OR is_manual = true OR photo_path IS NOT NULL);

-- Los tres campos del manual van juntos o no van: no hay GPS ni foto que lo
-- respalde, solo la palabra del Supervisor.
ALTER TABLE operations.punch_mark
  ADD CONSTRAINT ck_punch_manual CHECK (
    (is_manual = false AND registered_by IS NULL AND manual_reason IS NULL)
    OR
    (is_manual = true  AND registered_by IS NOT NULL AND manual_reason IS NOT NULL));

ALTER TABLE operations.timesheet
  ADD CONSTRAINT ck_timesheet_status CHECK (
    status IN ('OPEN', 'PENDING_APPROVAL', 'APPROVED'));

-- --- solo lo aprobado paga (D-09) ----------------------------------------
ALTER TABLE operations.timesheet
  ADD CONSTRAINT ck_timesheet_approval CHECK (
    (status =  'APPROVED' AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
    OR
    (status <> 'APPROVED' AND approved_by IS NULL     AND approved_at IS NULL));

-- --- el absurdo ----------------------------------------------------------
-- El unico CHECK que el overtime merece. Atrapa un ponche corrupto o un error de
-- zona horaria: el tipo de bug que se descubre tres meses despues, en la nomina.
ALTER TABLE operations.timesheet_day
  ADD CONSTRAINT ck_day_minutes   CHECK (gross_minutes BETWEEN 0 AND 1440),
  ADD CONSTRAINT ck_day_lunch     CHECK (lunch_deduction_minutes BETWEEN 0 AND 480),
  ADD CONSTRAINT ck_day_overtime  CHECK (overtime_minutes >= 0);

ALTER TABLE operations.schedule
  ADD CONSTRAINT ck_schedule_week CHECK (week_end > week_start);
ALTER TABLE operations.timesheet
  ADD CONSTRAINT ck_timesheet_week CHECK (week_end > week_start);

-- --- las horas netas, en VISTA ------------------------------------------
-- No como columna GENERATED: Prisma no las sabe representar y su diff queda en un
-- bucle donde las tres opciones rompen la siguiente migracion. Ya paso con
-- personal.vw_worker.
CREATE VIEW operations.vw_timesheet_day AS
SELECT
  d.*,
  -- greatest(0,...) evita netos negativos si la jornada fue mas corta que la
  -- deduccion.
  greatest(0, d.gross_minutes - d.lunch_deduction_minutes) AS net_minutes,
  -- La duracion REAL del lunch, cuando el colaborador poncho el par. Es lo que
  -- alimenta el Indicador de Lunch Extendido, que con tres marcas era
  -- incalculable. NO descuenta nada: la deduccion sigue fija en 30.
  (SELECT (EXTRACT(EPOCH FROM (
             max(p.server_at) FILTER (WHERE p.type = 'LUNCH_IN') -
             max(p.server_at) FILTER (WHERE p.type = 'LUNCH_OUT')))/60)::int
     FROM operations.punch_mark p
    WHERE p.timesheet_day_id = d.id) AS actual_lunch_minutes
FROM operations.timesheet_day d;

GRANT SELECT ON operations.vw_timesheet_day TO app_user;

-- --- updated_at lo mantiene la base (seccion 4) --------------------------
CREATE TRIGGER tg_schedule_updated_at BEFORE UPDATE ON operations.schedule
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tg_schedule_entry_updated_at BEFORE UPDATE ON operations.schedule_entry
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tg_timesheet_updated_at BEFORE UPDATE ON operations.timesheet
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tg_timesheet_day_updated_at BEFORE UPDATE ON operations.timesheet_day
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
