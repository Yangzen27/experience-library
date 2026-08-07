import { requireUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response!;
  return Response.json({ user: { id: user.id, email: user.email ?? "", username: String(user.user_metadata?.username ?? "") } });
}
