-- The postgis/postgis Docker image auto-creates 4 extensions on init:
--   postgis, fuzzystrmatch, postgis_tiger_geocoder, postgis_topology
-- We drop ALL of them here so Prisma owns the postgis extension via its
-- migration history. Without this, Prisma detects "drift" because it sees
-- an extension it didn't create.
-- The PostGIS *packages* remain installed in the image — dropping the
-- extension only removes the SQL objects. Prisma's first migration will
-- run CREATE EXTENSION postgis to recreate it under its own control.
-- Order matters: dependents first, then dependencies.
DROP EXTENSION IF EXISTS postgis_tiger_geocoder CASCADE;
DROP EXTENSION IF EXISTS postgis_topology CASCADE;
DROP EXTENSION IF EXISTS fuzzystrmatch CASCADE;
DROP EXTENSION IF EXISTS postgis CASCADE;
