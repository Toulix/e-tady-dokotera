-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "analytics";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "appointments";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "auth";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "doctors";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "notifications";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "scheduling";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "video";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "auth"."UserType" AS ENUM ('patient', 'doctor', 'admin', 'support');

-- CreateEnum
CREATE TYPE "auth"."Gender" AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');

-- CreateEnum
CREATE TYPE "auth"."Language" AS ENUM ('malagasy', 'french', 'english');

-- CreateEnum
CREATE TYPE "appointments"."AppointmentType" AS ENUM ('in_person', 'video', 'home_visit');

-- CreateEnum
CREATE TYPE "appointments"."AppointmentStatus" AS ENUM ('pending_confirmation', 'confirmed', 'completed', 'cancelled', 'no_show');

-- CreateEnum
CREATE TYPE "appointments"."CancelledBy" AS ENUM ('patient', 'doctor', 'system');

-- CreateEnum
CREATE TYPE "appointments"."PaymentStatus" AS ENUM ('not_applicable', 'pending', 'paid', 'refunded');

-- CreateEnum
CREATE TYPE "appointments"."PaymentMethod" AS ENUM ('cash', 'mobile_money', 'card', 'insurance');

-- CreateEnum
CREATE TYPE "doctors"."FacilityType" AS ENUM ('hospital', 'clinic', 'diagnostic_center', 'pharmacy');

-- CreateEnum
CREATE TYPE "scheduling"."ScheduleAppointmentType" AS ENUM ('in_person', 'video', 'both');

-- CreateEnum
CREATE TYPE "scheduling"."ExceptionType" AS ENUM ('day_off', 'custom_hours', 'emergency_only');

-- CreateEnum
CREATE TYPE "notifications"."NotificationChannel" AS ENUM ('sms', 'email', 'push');

-- CreateEnum
CREATE TYPE "notifications"."NotificationStatus" AS ENUM ('pending', 'sent', 'delivered', 'failed');

-- CreateTable
CREATE TABLE "auth"."users" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "user_type" "auth"."UserType" NOT NULL,
    "phone_number" TEXT NOT NULL,
    "email" TEXT,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "date_of_birth" DATE,
    "gender" "auth"."Gender",
    "profile_photo_url" TEXT,
    "preferred_language" "auth"."Language" NOT NULL DEFAULT 'malagasy',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."otp_codes" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "phone" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."sessions" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctors"."profiles" (
    "user_id" TEXT NOT NULL,
    "registration_number" TEXT NOT NULL,
    "specialties" TEXT[],
    "sub_specialties" TEXT[],
    "years_of_experience" INTEGER NOT NULL,
    "about" TEXT,
    "languages_spoken" TEXT[],
    "consultation_fee_mga" INTEGER NOT NULL,
    "consultation_duration_minutes" INTEGER NOT NULL DEFAULT 30,
    "accepts_new_patients" BOOLEAN NOT NULL DEFAULT true,
    "education" JSONB,
    "certifications" JSONB,
    "insurance_accepted" TEXT[],
    "video_consultation_enabled" BOOLEAN NOT NULL DEFAULT false,
    "home_visit_enabled" BOOLEAN NOT NULL DEFAULT false,
    "is_profile_live" BOOLEAN NOT NULL DEFAULT false,
    "average_rating" INTEGER NOT NULL DEFAULT 0,
    "total_reviews" INTEGER NOT NULL DEFAULT 0,
    "total_appointments" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "doctors"."facilities" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "type" "doctors"."FacilityType" NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "geolocation" geometry(Point, 4326),
    "phone_number" TEXT,
    "email" TEXT,
    "website" TEXT,
    "opening_hours" JSONB,
    "photos" TEXT[],
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctors"."doctor_facilities" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "doctor_id" TEXT NOT NULL,
    "facility_id" TEXT NOT NULL,

    CONSTRAINT "doctor_facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments"."appointments" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "booking_reference" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "facility_id" TEXT,
    "appointment_type" "appointments"."AppointmentType" NOT NULL,
    "start_time" TIMESTAMPTZ NOT NULL,
    "end_time" TIMESTAMPTZ NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "status" "appointments"."AppointmentStatus" NOT NULL DEFAULT 'pending_confirmation',
    "cancellation_reason" TEXT,
    "cancelled_by" "appointments"."CancelledBy",
    "reason_for_visit" TEXT,
    "is_first_visit" BOOLEAN NOT NULL DEFAULT false,
    "consultation_fee_mga" INTEGER,
    "payment_status" "appointments"."PaymentStatus" NOT NULL DEFAULT 'not_applicable',
    "payment_method" "appointments"."PaymentMethod",
    "notes" TEXT,
    "prescription_storage_key" TEXT,
    "follow_up_required" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments"."slot_locks" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "doctor_id" TEXT NOT NULL,
    "slot_time" TIMESTAMPTZ NOT NULL,
    "user_id" TEXT NOT NULL,
    "lock_token" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "slot_locks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments"."waitlist" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "patient_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waitlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling"."weekly_templates" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "doctor_id" TEXT NOT NULL,
    "facility_id" TEXT,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TIME NOT NULL,
    "end_time" TIME NOT NULL,
    "appointment_type" "scheduling"."ScheduleAppointmentType" NOT NULL,
    "slot_duration_minutes" INTEGER NOT NULL DEFAULT 30,
    "buffer_minutes" INTEGER NOT NULL DEFAULT 0,
    "max_bookings_per_slot" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" DATE NOT NULL,
    "effective_until" DATE,

    CONSTRAINT "weekly_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling"."exceptions" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "doctor_id" TEXT NOT NULL,
    "exception_date" DATE NOT NULL,
    "exception_type" "scheduling"."ExceptionType" NOT NULL,
    "custom_start_time" TIME,
    "custom_end_time" TIME,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications"."notification_log" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "appointment_id" TEXT,
    "channel" "notifications"."NotificationChannel" NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" "notifications"."NotificationStatus" NOT NULL DEFAULT 'pending',
    "provider_msg_id" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "sent_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications"."notification_preferences" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "sms_enabled" BOOLEAN NOT NULL DEFAULT true,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "push_enabled" BOOLEAN NOT NULL DEFAULT true,
    "quiet_hours_start" TEXT,
    "quiet_hours_end" TEXT,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications"."sms_opt_outs" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "phone" TEXT NOT NULL,
    "opted_out_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_opt_outs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video"."sessions" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "appointment_id" TEXT NOT NULL,
    "room_name" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ,
    "ended_at" TIMESTAMPTZ,
    "duration_seconds" INTEGER,
    "recording_key" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video"."consent_records" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "video_session_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "consent_type" TEXT NOT NULL,
    "granted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics"."events" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_number_key" ON "auth"."users"("phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "auth"."users"("email");

-- CreateIndex
CREATE INDEX "otp_codes_phone_code_idx" ON "auth"."otp_codes"("phone", "code");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "auth"."sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "auth"."sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_registration_number_key" ON "doctors"."profiles"("registration_number");

-- CreateIndex
CREATE INDEX "profiles_is_profile_live_average_rating_idx" ON "doctors"."profiles"("is_profile_live", "average_rating" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "doctor_facilities_doctor_id_facility_id_key" ON "doctors"."doctor_facilities"("doctor_id", "facility_id");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_booking_reference_key" ON "appointments"."appointments"("booking_reference");

-- CreateIndex
CREATE INDEX "appointments_patient_id_start_time_idx" ON "appointments"."appointments"("patient_id", "start_time" DESC);

-- CreateIndex
CREATE INDEX "appointments_doctor_id_start_time_idx" ON "appointments"."appointments"("doctor_id", "start_time");

-- CreateIndex
CREATE INDEX "appointments_status_start_time_idx" ON "appointments"."appointments"("status", "start_time");

-- CreateIndex
CREATE UNIQUE INDEX "slot_locks_lock_token_key" ON "appointments"."slot_locks"("lock_token");

-- CreateIndex
CREATE INDEX "slot_locks_expires_at_idx" ON "appointments"."slot_locks"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "slot_locks_doctor_id_slot_time_key" ON "appointments"."slot_locks"("doctor_id", "slot_time");

-- CreateIndex
CREATE INDEX "weekly_templates_doctor_id_day_of_week_idx" ON "scheduling"."weekly_templates"("doctor_id", "day_of_week");

-- CreateIndex
CREATE INDEX "exceptions_doctor_id_exception_date_idx" ON "scheduling"."exceptions"("doctor_id", "exception_date");

-- CreateIndex
CREATE INDEX "notification_log_user_id_created_at_idx" ON "notifications"."notification_log"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notification_log_appointment_id_idx" ON "notifications"."notification_log"("appointment_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_key" ON "notifications"."notification_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sms_opt_outs_phone_key" ON "notifications"."sms_opt_outs"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_appointment_id_key" ON "video"."sessions"("appointment_id");

-- CreateIndex
CREATE INDEX "events_event_type_created_at_idx" ON "analytics"."events"("event_type", "created_at");

-- AddForeignKey
ALTER TABLE "auth"."sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctors"."profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctors"."doctor_facilities" ADD CONSTRAINT "doctor_facilities_user_fkey" FOREIGN KEY ("doctor_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctors"."doctor_facilities" ADD CONSTRAINT "doctor_facilities_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "doctors"."facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctors"."doctor_facilities" ADD CONSTRAINT "doctor_facilities_profile_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"."profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments"."appointments" ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments"."appointments" ADD CONSTRAINT "appointments_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments"."appointments" ADD CONSTRAINT "appointments_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "doctors"."facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling"."weekly_templates" ADD CONSTRAINT "weekly_templates_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling"."exceptions" ADD CONSTRAINT "exceptions_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications"."notification_log" ADD CONSTRAINT "notification_log_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"."appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video"."sessions" ADD CONSTRAINT "sessions_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"."appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video"."consent_records" ADD CONSTRAINT "consent_records_video_session_id_fkey" FOREIGN KEY ("video_session_id") REFERENCES "video"."sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
