import { analyseJobDescriptions } from "@/lib/resume-ai";
import { requireUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response!;
    const body = await request.json() as { role?: string; mainJD?: string; references?: string[] };
    const role = body.role?.trim() || "";
    const mainJD = body.mainJD?.trim() || "";
    const references = Array.isArray(body.references) ? body.references.map((item) => item.trim()).filter(Boolean).slice(0, 5) : [];
    if (!role || !mainJD) return Response.json({ error: "目标岗位和主JD不能为空" }, { status: 400 });
    const analysis = await analyseJobDescriptions(role, mainJD, references);
    return Response.json({ analysis });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "岗位分析失败" }, { status: 422 });
  }
}
