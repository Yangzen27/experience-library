import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { jobDescriptions, resumeProjects, resumeSelections, resumeVersions } from "@/db/schema";
import type { ResumeDraft } from "@/lib/resume-types";
import { requireUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

function isDraftPayload(value: unknown): value is ResumeDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as ResumeDraft;
  return typeof draft.title === "string" && typeof draft.role === "string" &&
    typeof draft.language === "string" && Array.isArray(draft.experiences) &&
    draft.experiences.every((item) => item && typeof item.id === "number" && typeof item.resumeSummary === "string");
}

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response!;
  if (!db) return Response.json({ error: "数据库未配置" }, { status: 503 });
  const rows = await db.select({ project: resumeProjects, version: resumeVersions })
    .from(resumeVersions)
    .innerJoin(resumeProjects, eq(resumeVersions.projectId, resumeProjects.id))
    .where(eq(resumeProjects.userId, user.id))
    .orderBy(desc(resumeVersions.createdAt));

  const drafts = rows.map(({ project, version }) => {
    const content = version.content as Partial<ResumeDraft>;
    return {
      ...content,
      id: version.id,
      title: content.title || `${project.targetCompany ? `${project.targetCompany} · ` : ""}${project.targetRole}`,
      language: content.language || (version.language === "en" ? "英文" : "中文"),
      createdAt: version.createdAt.toLocaleString("zh-CN", { dateStyle: "medium", timeStyle: "short" }),
      experiences: Array.isArray(content.experiences) ? content.experiences : [],
      skills: Array.isArray(content.skills) ? content.skills : [],
      generation_note: content.generation_note || "",
    };
  });
  return Response.json({ drafts });
}

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (!user) return response!;
  if (!db) return Response.json({ error: "数据库未配置" }, { status: 503 });
  const body = await request.json() as unknown;
  if (!isDraftPayload(body)) return Response.json({ error: "简历草稿数据不完整" }, { status: 400 });

  const created = await db.transaction(async (tx) => {
    const [project] = await tx.insert(resumeProjects).values({
      userId: user.id, targetCompany: body.company?.trim() || null, targetRole: body.role?.trim() || body.title,
      jobType: "default", language: body.language === "英文" ? "en" : "zh", pageCount: "1", status: "draft", updatedAt: new Date(),
    }).returning();
    if (!project) throw new Error("创建简历项目失败");

    if (body.mainJD?.trim()) await tx.insert(jobDescriptions).values({ userId: user.id, projectId: project.id, sourceRole: "main", content: body.mainJD.trim(), sortOrder: "0", analysis: {} });
    const usableReferences = (body.references ?? []).map((item) => item.trim()).filter(Boolean);
    if (usableReferences.length) await tx.insert(jobDescriptions).values(usableReferences.map((content, index) => ({ userId: user.id, projectId: project.id, sourceRole: "reference", content, sortOrder: String(index + 1), analysis: {} })));
    await tx.insert(resumeSelections).values(body.experiences.map((experience, index) => ({
      userId: user.id, projectId: project.id, experienceRef: String(experience.id), isRequired: body.requiredIds?.includes(experience.id) ? "true" : "false", sortOrder: String(index), selectedEvidence: experience.evidence ?? [],
    })));
    const [version] = await tx.insert(resumeVersions).values({
      userId: user.id, projectId: project.id, language: body.language === "英文" ? "en" : "zh", status: "draft", content: body, userEdits: [], updatedAt: new Date(),
    }).returning();
    if (!version) throw new Error("创建简历版本失败");
    return version;
  });

  return Response.json({
    draft: { ...body, id: created.id, createdAt: created.createdAt.toLocaleString("zh-CN", { dateStyle: "medium", timeStyle: "short" }) },
  });
}
