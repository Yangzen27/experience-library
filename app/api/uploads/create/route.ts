import path from "node:path";
import { createSupabaseServerClient, requireUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".pdf", ".docx", ".txt", ".md", ".markdown"]);

export async function POST(request: Request) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response!;
    const body = await request.json() as { name?: string; type?: string; size?: number };
    const originalName = path.basename(String(body.name || "")).normalize("NFC");
    const extension = path.extname(originalName).toLowerCase().replace(/[^.a-z0-9]/g, "");
    if (!originalName || !ALLOWED_EXTENSIONS.has(extension)) return Response.json({ error: "仅支持 PDF、DOCX、TXT、Markdown 文件。" }, { status: 415 });
    if (!Number.isFinite(body.size) || Number(body.size) <= 0 || Number(body.size) > MAX_UPLOAD_BYTES) return Response.json({ error: "单个文件不能超过 20MB。" }, { status: 413 });
    const id = crypto.randomUUID(); const storagePath = `${user.id}/${id}${extension}`;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.storage.from("experience-materials").createSignedUploadUrl(storagePath);
    if (error || !data?.signedUrl) throw new Error(error?.message || "未能创建安全上传地址");
    return Response.json({ fileId: id, storagePath, signedUrl: data.signedUrl });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? `准备上传失败：${error.message}` : "准备上传失败" }, { status: 422 });
  }
}
