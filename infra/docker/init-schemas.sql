-- Extensions
-- Let extension handled by Prisma because it create schema drift
-- NOTE (v1.6): uuid-ossp removed. PostgreSQL 13+ includes gen_random_uuid() natively.
-- uuid-ossp is only needed for uuid_generate_v4() -- use gen_random_uuid() everywhere instead.
-- See Prisma schema: @default(dbgenerated("gen_random_uuid()"))

-- Module schemas
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS doctors;
CREATE SCHEMA IF NOT EXISTS appointments;
CREATE SCHEMA IF NOT EXISTS scheduling;
CREATE SCHEMA IF NOT EXISTS notifications;
CREATE SCHEMA IF NOT EXISTS video;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS payments;  -- Phase 2: Mobile Money (Orange Money, MVola, Airtel)
