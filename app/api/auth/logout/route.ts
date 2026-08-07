import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  if (!isSupabaseConfigured()) return new Response(null, { status: 204 });
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return new Response(null, { status: 204 });
}
