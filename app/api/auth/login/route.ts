import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) return Response.json({ error: "Supabase 尚未配置" }, { status: 503 });
  const body = await request.json() as { email?: string; password?: string };
  const email = body.email?.trim().toLowerCase() || "";
  const password = body.password || "";
  if (!email || !password) return Response.json({ error: "请填写邮箱和密码" }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    const message = error?.message.toLowerCase() || "";
    if (message.includes("email not confirmed")) {
      return Response.json({ error: "该邮箱尚未验证。请打开注册邮件中的确认链接后，再回来登录。" }, { status: 403 });
    }
    return Response.json({ error: "邮箱或密码不正确" }, { status: 401 });
  }
  return Response.json({ user: { id: data.user.id, email: data.user.email ?? "", username: String(data.user.user_metadata?.username ?? "") } });
}
