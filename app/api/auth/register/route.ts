import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) return Response.json({ error: "Supabase 尚未配置" }, { status: 503 });
  const body = await request.json() as { email?: string; password?: string; username?: string };
  const email = body.email?.trim().toLowerCase() || "";
  const password = body.password || "";
  const username = body.username?.trim() || "";
  if (!/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: "请输入有效邮箱地址" }, { status: 400 });
  if (password.length < 10) return Response.json({ error: "密码至少需要 10 位" }, { status: 400 });
  if (username && !/^[\w-]{3,32}$/.test(username)) return Response.json({ error: "用户名需为 3–32 位字母、数字、下划线或连字符" }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  const emailRedirectTo = new URL("/auth/callback", request.url).toString();
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { username }, emailRedirectTo } });
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ user: data.user ? { id: data.user.id, email: data.user.email, username } : null, needsEmailConfirmation: !data.session }, { status: 201 });
}
