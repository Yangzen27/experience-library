import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const file = (path) => readFile(new URL(path, root), "utf8");

test("every personal-data endpoint authenticates before accessing data", async () => {
  const routes = [
    "app/api/library/route.ts", "app/api/process/route.ts", "app/api/files/[id]/route.ts",
    "app/api/resume-profile/route.ts", "app/api/resumes/route.ts", "app/api/resumes/word/route.ts",
    "app/api/resume/analyze/route.ts", "app/api/resume/supplement/route.ts", "app/api/resume/generate/route.ts",
  ];
  for (const route of routes) {
    const source = await file(route);
    assert.match(source, /requireUser/, `${route} must require a signed-in user`);
  }
});

test("attachments are private objects and are owner-scoped twice", async () => {
  const [processRoute, uploadRoute, fileRoute] = await Promise.all([file("app/api/process/route.ts"), file("app/api/uploads/create/route.ts"), file("app/api/files/[id]/route.ts")]);
  assert.match(processRoute, /experience-materials/);
  assert.match(uploadRoute, /storagePath = `\$\{user\.id\}\//);
  assert.match(processRoute, /userId: user\.id/);
  assert.match(uploadRoute, /MAX_UPLOAD_BYTES = 20 \* 1024 \* 1024/);
  assert.match(uploadRoute, /ALLOWED_EXTENSIONS/);
  assert.match(fileRoute, /eq\(files\.userId, user\.id\)/);
  assert.match(fileRoute, /experience-materials/);
});

test("large source files are uploaded directly to private Supabase Storage before processing", async () => {
  const [page, createUpload, processRoute] = await Promise.all([file("app/page.tsx"), file("app/api/uploads/create/route.ts"), file("app/api/process/route.ts")]);
  assert.match(page, /\/api\/uploads\/create/);
  assert.match(page, /fetch\(upload\.signedUrl, \{ method: "PUT"/);
  assert.match(createUpload, /createSignedUploadUrl/);
  assert.match(createUpload, /\$\{user\.id\}\/\$\{id\}/);
  assert.match(processRoute, /storage\.from\("experience-materials"\)\.download\(body\.storagePath\)/);
  assert.doesNotMatch(processRoute, /request\.formData\(\)/);
});

test("document chunk writes are transactional and never echo source text in an error", async () => {
  const route = await file("app/api/process/route.ts");
  assert.match(route, /db\.transaction/);
  assert.match(route, /for \(const chunk of chunks\)/);
  assert.match(route, /不把 Drizzle 的 SQL 和参数回显给浏览器/);
  assert.doesNotMatch(route, /\$\{stage\}失败：\$\{detail\}/);
});

test("resume data is written and listed under the authenticated owner", async () => {
  const source = await file("app/api/resumes/route.ts");
  assert.match(source, /where\(eq\(resumeProjects\.userId, user\.id\)\)/);
  assert.match(source, /userId: user\.id, projectId: project\.id, sourceRole/);
  assert.match(source, /userId: user\.id, projectId: project\.id, experienceRef/);
  assert.match(source, /userId: user\.id, projectId: project\.id, language/);
});

test("Supabase migration removes shared defaults and enables RLS on all user data", async () => {
  const sql = await file("db/migrations/0004_supabase_auth_isolation.sql");
  for (const table of ["library_state", "files", "source_chunks", "experiences", "evidence_points", "merge_decisions", "education_records", "resume_profiles", "resume_projects", "job_descriptions", "resume_selections", "resume_versions"]) {
    assert.match(sql, new RegExp(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`));
  }
  assert.match(sql, /ALTER TABLE files ALTER COLUMN user_id DROP DEFAULT/);
  assert.match(sql, /storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/);
  assert.doesNotMatch((await file("db/schema.ts")), /default\("local-user"\)/);
});

test("resume AI receives only selected structured evidence, never uploaded source material", async () => {
  const [prototype, supplementRoute, generateRoute, ai] = await Promise.all([
    file("components/ResumePrototype.tsx"), file("app/api/resume/supplement/route.ts"),
    file("app/api/resume/generate/route.ts"), file("lib/resume-ai.ts"),
  ]);
  assert.match(prototype, /function toResumeAiInput/);
  assert.match(prototype, /experiences: selected\.map\(toResumeAiInput\)/);
  assert.match(prototype, /\.\.\.toResumeAiInput\(item\)/);
  for (const source of [supplementRoute, generateRoute, ai]) {
    assert.doesNotMatch(source, /source_chunks|sourceChunks|sourceMaterials|sourceUrl/);
  }
});
