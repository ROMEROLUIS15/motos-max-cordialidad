-- Observaciones del servicio por orden de trabajo (qué encontró/hizo el mecánico).
ALTER TABLE "work_orders" ADD COLUMN "observations" TEXT;
