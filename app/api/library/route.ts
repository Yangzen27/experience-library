import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { libraryState } from "@/db/schema";
import { requireUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response!;
  if (!db) return Response.json({ error: "数据库未配置" }, { status: 503 });
  const row = (await db.select().from(libraryState).where(eq(libraryState.userId, user.id)).limit(1))[0];
  return Response.json({ experiences: Array.isArray(row?.experiences) ? row.experiences : [] });
}

export async function PUT(request: Request) {
  const { user, response } = await requireUser();
  if (!user) return response!;
  if (!db) return Response.json({ error: "数据库未配置" }, { status: 503 });
  const body = await request.json() as { experiences?: unknown };
  if (!Array.isArray(body.experiences)) return Response.json({ error: "经历数据格式错误" }, { status: 400 });
  await db.insert(libraryState).values({ userId: user.id, experiences: body.experiences, updatedAt: new Date() })
    .onConflictDoUpdate({ target: libraryState.userId, set: { experiences: body.experiences, updatedAt: new Date() } });
  return Response.json({ ok: true, count: body.experiences.length });
}
