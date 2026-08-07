import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { resumeProfiles } from "@/db/schema";
import type { ResumeEducation, ResumeProfile } from "@/lib/resume-types";
import { requireUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

const emptyProfile: ResumeProfile = { name: "", phone: "", email: "", educations: [], professionalSkills: [], certificates: [] };

function cleanList(value: unknown) {
  return Array.isArray(value) ? Array.from(new Set(value.map((item) => String(item).trim()).filter(Boolean))) : [];
}

function cleanEducations(value: unknown): ResumeEducation[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    const row = item && typeof item === "object" ? item as Partial<ResumeEducation> : {};
    return {
      id: String(row.id || `education-${Date.now()}-${index}`),
      school: String(row.school || "").trim(),
      major: String(row.major || "").trim(),
      startYear: String(row.startYear || "").trim(),
      endYear: String(row.endYear || "").trim(),
    };
  }).filter((item) => item.school || item.major || item.startYear || item.endYear);
}

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response!;
  if (!db) return Response.json({ error: "数据库未配置" }, { status: 503 });
  const row = (await db.select().from(resumeProfiles).where(eq(resumeProfiles.userId, user.id)).limit(1))[0];
  if (!row) return Response.json({ profile: emptyProfile });
  return Response.json({ profile: { name: row.name, phone: row.phone, email: row.email, educations: cleanEducations(row.educations), professionalSkills: cleanList(row.professionalSkills), certificates: cleanList(row.certificates) } });
}

export async function PUT(request: Request) {
  const { user, response } = await requireUser();
  if (!user) return response!;
  if (!db) return Response.json({ error: "数据库未配置" }, { status: 503 });
  const body = await request.json() as Partial<ResumeProfile>;
  const profile: ResumeProfile = {
    name: String(body.name || "").trim(), phone: String(body.phone || "").trim(), email: String(body.email || "").trim(),
    educations: cleanEducations(body.educations), professionalSkills: cleanList(body.professionalSkills), certificates: cleanList(body.certificates),
  };
  await db.insert(resumeProfiles).values({ userId: user.id, ...profile, updatedAt: new Date() })
    .onConflictDoUpdate({ target: resumeProfiles.userId, set: { ...profile, updatedAt: new Date() } });
  return Response.json({ profile });
}
