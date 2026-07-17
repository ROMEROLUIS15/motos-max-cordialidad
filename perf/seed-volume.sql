-- Siembra volumen realista para medir latencia: 2.000 clientes, 2.000 vehículos,
-- 20.000 órdenes de trabajo. Reutiliza tenant/branch/técnico/recepción existentes.
-- Pensado para correr contra la BD LOCAL de perf, nunca contra producción.
\set ON_ERROR_STOP on

\echo '--- semillas base (tenant, branch, tecnico, recepcion de referencia)'
SELECT id AS tenant_id FROM tenants LIMIT 1 \gset
SELECT id AS branch_id FROM branches WHERE "tenantId" = :'tenant_id' LIMIT 1 \gset
SELECT u.id AS tech_id FROM users u JOIN roles r ON r.id = u."roleId"
  WHERE u."tenantId" = :'tenant_id' AND r.name = 'TECHNICIAN' LIMIT 1 \gset
SELECT id AS reception_id FROM vehicle_receptions LIMIT 1 \gset

\echo '--- 2.000 clientes'
INSERT INTO customers (id, "tenantId", "fullName", "documentType", "documentNumber", phone, email, address, city, "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  :'tenant_id',
  (ARRAY['Juan','Maria','Carlos','Ana','Luis','Sofia','Pedro','Laura','Diego','Camila'])[1 + (i % 10)] || ' ' ||
  (ARRAY['Gomez','Perez','Rodriguez','Martinez','Lopez','Garcia','Torres','Ramirez','Vargas','Moreno'])[1 + ((i / 10) % 10)] || ' ' || i,
  'CC',
  'PERF' || i,
  '+57 300 ' || lpad((i % 10000)::text, 4, '0') || ' ' || lpad((i % 100)::text, 2, '0'),
  'perf' || i || '@carga.test',
  'Calle ' || i,
  (ARRAY['Bogota','Medellin','Cali','Barranquilla','Bucaramanga'])[1 + (i % 5)],
  now() - (i || ' minutes')::interval,
  now()
FROM generate_series(1, 2000) AS i;

\echo '--- 2.000 vehiculos'
INSERT INTO vehicles (id, "tenantId", "currentOwnerId", plate, brand, model, year, color, "engineNumber", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  :'tenant_id',
  c.id,
  -- ojo: lpad TRUNCA si el texto excede el ancho ('1000' con ancho 3 -> '100'),
  -- asi que el ancho debe cubrir el maximo (2000 -> 4 digitos)
  'PRF' || lpad(c.rn::text, 4, '0'),
  (ARRAY['Bajaj','Honda','Yamaha','Suzuki','KTM','Kawasaki','TVS','Hero'])[1 + (c.rn % 8)],
  (ARRAY['Pulsar NS200','CB190R','FZ 2.0','Gixxer','Duke 200','Z400','Apache 160','Hunk 190'])[1 + (c.rn % 8)],
  2015 + (c.rn % 11),
  (ARRAY['Rojo','Negro','Azul','Blanco','Gris'])[1 + (c.rn % 5)],
  'ENGPERF' || c.rn,
  now() - (c.rn || ' minutes')::interval,
  now()
FROM (SELECT id, row_number() OVER (ORDER BY "createdAt") AS rn FROM customers WHERE "documentNumber" LIKE 'PERF%') c;

\echo '--- 20.000 ordenes de trabajo'
INSERT INTO work_orders (id, "tenantId", "branchId", "orderNumber", "receptionId", "vehicleId", "customerId", "technicianId",
                         "serviceType", "problemDescription", status, "promisedDeliveryAt", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  :'tenant_id',
  :'branch_id',
  'PERF-' || lpad(i::text, 6, '0'),
  :'reception_id',
  v.id,
  v."currentOwnerId",
  :'tech_id',
  (ARRAY['Cambio de aceite','Revision de frenos','Sincronizacion','Diagnostico','Mantenimiento general'])[1 + (i % 5)],
  'Orden de carga generada para medir latencia (' || i || ')',
  (ARRAY['PENDING','IN_PROGRESS','WAITING_PARTS','COMPLETED','DELIVERED'])[1 + (i % 5)],
  now() + ((i % 30) || ' days')::interval,
  now() - ((i % 500) || ' hours')::interval,
  now()
FROM generate_series(1, 20000) AS i
JOIN LATERAL (
  SELECT id, "currentOwnerId" FROM vehicles WHERE plate LIKE 'PRF%' OFFSET (i % 2000) LIMIT 1
) v ON true;

\echo '--- conteos finales'
SELECT 'clientes' AS tabla, count(*) FROM customers
UNION ALL SELECT 'vehiculos', count(*) FROM vehicles
UNION ALL SELECT 'ordenes', count(*) FROM work_orders;

ANALYZE customers;
ANALYZE vehicles;
ANALYZE work_orders;
