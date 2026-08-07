import { createSupabaseServerClient, requireUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (!user) return response!;
  const body = await request.json() as { password?: string };
  const password = body.password || "";
  if (password.length < 10) return Response.json({ error: "新密码至少需要 10 位" }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return Response.json({ error: "更新密码失败，请重新打开邮件链接后再试。" }, { status: 422 });
  return Response.json({ ok: true });
}
