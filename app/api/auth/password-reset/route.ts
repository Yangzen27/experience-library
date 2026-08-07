import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) return Response.json({ error: "Supabase 尚未配置" }, { status: 503 });
  const body = await request.json() as { email?: string };
  const email = body.email?.trim().toLowerCase() || "";
  if (!/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: "请输入有效邮箱地址" }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: new URL("/auth/callback?next=/reset-password", request.url).toString() });
  if (error) return Response.json({ error: "暂时无法发送重置邮件，请稍后再试。" }, { status: 422 });
  return Response.json({ ok: true });
}
