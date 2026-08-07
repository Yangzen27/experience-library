import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const libraryState = pgTable("library_state", {
  userId: text("user_id").primaryKey(),
  experiences: jsonb("experiences").notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const files = pgTable("files", {
  id: uuid("id").defaultRandom().primaryKey(), userId: text("user_id").notNull(), originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(), storagePath: text("storage_path").notNull(), status: text("status").notNull().default("uploaded"),
  riskFlags: jsonb("risk_flags").notNull().default([]), uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});
export const sourceChunks = pgTable("source_chunks", {
  id: uuid("id").defaultRandom().primaryKey(), fileId: uuid("file_id").notNull().references(() => files.id), userId: text("user_id").notNull(), sequence: text("sequence").notNull(),
  pageNumber: text("page_number"), sectionTitle: text("section_title"), content: text("content").notNull(), createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const experiences = pgTable("experiences", {
  id: uuid("id").defaultRandom().primaryKey(), userId: text("user_id").notNull(), type: text("type").notNull(), organizationName: text("organization_name"),
  title: text("title").notNull(), teamName: text("team_name"), startDate: text("start_date"), endDate: text("end_date"), summary: text("summary"),
  status: text("status").notNull().default("active"), createdAt: timestamp("created_at").notNull().defaultNow(), updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export const evidencePoints = pgTable("evidence_points", {
  id: uuid("id").defaultRandom().primaryKey(), userId: text("user_id").notNull(), experienceId: uuid("experience_id").notNull().references(() => experiences.id), category: text("category").notNull(),
  content: text("content").notNull(), skills: jsonb("skills").notNull().default([]), tags: jsonb("tags").notNull().default([]), sourceChunkIds: jsonb("source_chunk_ids").notNull().default([]),
  confidence: text("confidence").notNull(), verificationStatus: text("verification_status").notNull().default("source_backed"), createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const mergeDecisions = pgTable("merge_decisions", {
  id: uuid("id").defaultRandom().primaryKey(), userId: text("user_id").notNull(), fileId: uuid("file_id").notNull().references(() => files.id), candidateExperienceId: uuid("candidate_experience_id").references(() => experiences.id),
  decisionType: text("decision_type").notNull(), reason: text("reason").notNull(), payload: jsonb("payload").notNull(), createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const educationRecords = pgTable("education_records", {
  id: uuid("id").defaultRandom().primaryKey(), userId: text("user_id").notNull(), schoolName: text("school_name").notNull(),
  degree: text("degree"), major: text("major"), startDate: text("start_date"), endDate: text("end_date"), details: jsonb("details").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const resumeProfiles = pgTable("resume_profiles", {
  userId: text("user_id").primaryKey(),
  name: text("name").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  educations: jsonb("educations").notNull().default([]),
  professionalSkills: jsonb("professional_skills").notNull().default([]),
  certificates: jsonb("certificates").notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const resumeProjects = pgTable("resume_projects", {
  id: uuid("id").defaultRandom().primaryKey(), userId: text("user_id").notNull(), targetCompany: text("target_company"),
  targetRole: text("target_role").notNull(), jobType: text("job_type").notNull(), language: text("language").notNull().default("zh"),
  pageCount: text("page_count").notNull().default("1"), status: text("status").notNull().default("draft"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const jobDescriptions = pgTable("job_descriptions", {
  id: uuid("id").defaultRandom().primaryKey(), userId: text("user_id").notNull(), projectId: uuid("project_id").notNull().references(() => resumeProjects.id), sourceRole: text("source_role").notNull(),
  content: text("content").notNull(), sortOrder: text("sort_order").notNull().default("0"), analysis: jsonb("analysis").notNull().default({}), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const resumeSelections = pgTable("resume_selections", {
  id: uuid("id").defaultRandom().primaryKey(), userId: text("user_id").notNull(), projectId: uuid("project_id").notNull().references(() => resumeProjects.id), experienceRef: text("experience_ref").notNull(),
  isRequired: text("is_required").notNull().default("false"), sortOrder: text("sort_order").notNull().default("0"), selectedEvidence: jsonb("selected_evidence").notNull().default([]), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const resumeVersions = pgTable("resume_versions", {
  id: uuid("id").defaultRandom().primaryKey(), userId: text("user_id").notNull(), projectId: uuid("project_id").notNull().references(() => resumeProjects.id), language: text("language").notNull(),
  status: text("status").notNull().default("draft"), content: jsonb("content").notNull().default({}), userEdits: jsonb("user_edits").notNull().default([]), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
