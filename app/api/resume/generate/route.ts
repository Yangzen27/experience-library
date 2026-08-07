import { generateTailoredResume } from "@/lib/resume-ai";
import type { JobAnalysis, ResumeExperienceInput, ResumeProfile } from "@/lib/resume-types";
import { requireUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response!;
    const body = await request.json() as { role?: string; language?: string; analysis?: JobAnalysis; experiences?: ResumeExperienceInput[]; profile?: Pick<ResumeProfile, "name" | "educations"> };
    if (!body.role?.trim() || !body.analysis || !Array.isArray(body.experiences) || !body.experiences.length) {
      return Response.json({ error: "生成简历所需信息不完整" }, { status: 400 });
    }
    const resume = await generateTailoredResume(body.role.trim(), body.language || "中文", body.analysis, body.experiences, body.profile);
    return Response.json({ resume });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "简历生成失败" }, { status: 422 });
  }
}
