import { createSupplementAdvice } from "@/lib/resume-ai";
import type { JobAnalysis, ResumeExperienceInput } from "@/lib/resume-types";
import { requireUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response!;
    const body = await request.json() as { analysis?: JobAnalysis; experiences?: ResumeExperienceInput[] };
    if (!body.analysis || !Array.isArray(body.experiences) || !body.experiences.length) {
      return Response.json({ error: "请先完成岗位分析并选择经历" }, { status: 400 });
    }
    const supplement = await createSupplementAdvice(body.analysis, body.experiences);
    return Response.json({ supplement });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "补充建议生成失败" }, { status: 422 });
  }
}
