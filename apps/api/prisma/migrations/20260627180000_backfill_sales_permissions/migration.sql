-- Backfill the 'sales' module permissions (added in Fase 3) for existing
-- system roles. New tenants receive these from SYSTEM_ROLE_PERMISSIONS at seed
-- time; roles already in the database need them inserted here. Idempotent via
-- the (roleId, module, action) unique constraint.

-- OWNER + ADMIN: CREATE, READ, UPDATE
INSERT INTO "role_permissions" ("id", "roleId", "module", "action")
SELECT gen_random_uuid(), r."id", 'sales', a."action"
FROM "roles" r
CROSS JOIN (VALUES ('CREATE'), ('READ'), ('UPDATE')) AS a("action")
WHERE r."isSystem" = true AND r."name" IN ('OWNER', 'ADMIN')
ON CONFLICT ("roleId", "module", "action") DO NOTHING;

-- RECEPTIONIST + VIEWER: READ only
INSERT INTO "role_permissions" ("id", "roleId", "module", "action")
SELECT gen_random_uuid(), r."id", 'sales', 'READ'
FROM "roles" r
WHERE r."isSystem" = true AND r."name" IN ('RECEPTIONIST', 'VIEWER')
ON CONFLICT ("roleId", "module", "action") DO NOTHING;
