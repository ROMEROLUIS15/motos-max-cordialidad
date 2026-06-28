-- Make the motorcycle model year optional: the workshop owner may not know it
-- and should be able to register a vehicle without it (or pick/type it later).
ALTER TABLE "vehicles" ALTER COLUMN "year" DROP NOT NULL;
