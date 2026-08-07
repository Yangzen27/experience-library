import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Supabase 2026 新项目使用 Publishable key；保留 anon 名称兼容已创建的旧项目。
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export function isSupabaseConfigured() {
  return Boolean(config());
}

export async function createSupabaseServerClient() {
  const settings = config();
  if (!settings) throw new Error("Supabase 尚未配置");
  const cookieStore = await cookies();
  return createServerClient(settings.url, settings.key, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(values) {
        try { values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
        catch { /* Server Components may refresh a session without being able to write cookies. */ }
      },
    },
  });
}

export async function requireUser() {
  if (!isSupabaseConfigured()) {
    return { user: null, response: Response.json({ error: "Supabase 尚未配置。请设置 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY。" }, { status: 503 }) };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { user: null, response: Response.json({ error: "请先登录后再访问个人数据" }, { status: 401 }) };
  }
  return { user: data.user, response: null };
}
