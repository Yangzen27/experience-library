CREATE TABLE IF NOT EXISTS "resume_profiles" (
  "user_id" text PRIMARY KEY DEFAULT 'local-user' NOT NULL,
  "name" text DEFAULT '' NOT NULL,
  "phone" text DEFAULT '' NOT NULL,
  "email" text DEFAULT '' NOT NULL,
  "educations" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "professional_skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "certificates" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
