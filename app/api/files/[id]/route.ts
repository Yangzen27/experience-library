import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { files } from "@/db/schema";
import { createSupabaseServerClient, requireUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (!user) return response!;
  if (!db) return Response.json({ error: "数据库尚未配置。" }, { status: 503 });
  const { id } = await context.params;
  const [record] = await db.select().from(files).where(and(eq(files.id, id), eq(files.userId, user.id))).limit(1);
  if (!record) return Response.json({ error: "未找到该来源材料。" }, { status: 404 });
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.storage.from("experience-materials").download(record.storagePath);
    if (error || !data) throw new Error(error?.message || "对象不存在");
    return new Response(data, { headers: { "Content-Type": record.mimeType || "application/octet-stream", "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(record.originalName)}`, "Cache-Control": "private, no-store" } });
  } catch { return Response.json({ error: "来源文件不可读取。" }, { status: 404 }); }
}
