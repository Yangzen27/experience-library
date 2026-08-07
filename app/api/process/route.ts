import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { files, sourceChunks } from "@/db/schema";
import { extractText } from "@/lib/extract";
import { analyseExperience } from "@/lib/deepseek";
import { createSupabaseServerClient, requireUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".pdf", ".docx", ".txt", ".md", ".markdown"]);

export async function POST(request: Request) {
  let stage = "准备上传";
  let fileId: string | null = null;
  let fileOwnerId: string | null = null;
  try {
    const { user, response } = await requireUser();
    if (!user) return response!;
    if (!db) return Response.json({ error: "请先配置 DATABASE_URL，并执行 db/migrations/0000_init.sql。" }, { status: 503 });
    stage = "读取上传信息";
    const body = await request.json() as { fileId?: string; storagePath?: string; name?: string; type?: string; size?: number };
    const originalName = path.basename(String(body.name || "")).normalize("NFC");
    const extension = path.extname(originalName).toLowerCase().replace(/[^.a-z0-9]/g, "");
    if (!ALLOWED_EXTENSIONS.has(extension)) return Response.json({ error: "仅支持 PDF、DOCX、TXT、Markdown 文件。" }, { status: 415 });
    if (!body.fileId || !body.storagePath || body.storagePath !== `${user.id}/${body.fileId}${extension}`) return Response.json({ error: "上传凭据无效，请重新选择文件。" }, { status: 400 });
    if (!Number.isFinite(body.size) || Number(body.size) <= 0 || Number(body.size) > MAX_UPLOAD_BYTES) return Response.json({ error: "单个文件不能超过 20MB。" }, { status: 413 });
    const id = body.fileId; fileId = id; fileOwnerId = user.id;
    const supabase = await createSupabaseServerClient();
    stage = "读取私有材料";
    const { data: uploaded, error: downloadError } = await supabase.storage.from("experience-materials").download(body.storagePath);
    if (downloadError || !uploaded) throw new Error(downloadError?.message || "未找到已上传文件");
    const bytes = Buffer.from(await uploaded.arrayBuffer());
    stage = "写入经历库数据库";
    await db.insert(files).values({ id: fileId, userId: user.id, originalName, mimeType: body.type || "application/octet-stream", storagePath: body.storagePath, status: "extracting" });
    stage = "提取文档内容";
    const chunks = await extractText(originalName, body.type || "application/octet-stream", bytes);
    stage = "保存可追溯来源";
    const inserted = await db.transaction(async (transaction) => {
      const saved = [] as { id: string; content: string }[];
      for (const chunk of chunks) {
        const [row] = await transaction.insert(sourceChunks).values({ fileId: id, userId: user.id, ...chunk }).returning({ id: sourceChunks.id, content: sourceChunks.content });
        if (!row) throw new Error("未能保存文档片段");
        saved.push(row);
      }
      return saved;
    });
    stage = "请求 AI 整理";
    const analysis = await analyseExperience(inserted);
    await db.update(files).set({ status: "processed" }).where(eq(files.id, id));
    return Response.json({ fileId: id, fileUrl: `/api/files/${id}`, analysis });
  } catch (error) {
    // 不把 Drizzle 的 SQL 和参数回显给浏览器，其中可能含有用户上传的原文。
    const cause = error && typeof error === "object" && "cause" in error ? (error as { cause?: { code?: string; constraint?: string } }).cause : undefined;
    console.error("experience upload failed", { stage, databaseCode: cause?.code, constraint: cause?.constraint });
    if (fileId && fileOwnerId && db) await db.update(files).set({ status: "failed" }).where(and(eq(files.id, fileId), eq(files.userId, fileOwnerId))).catch(() => {});
    const message = stage === "保存可追溯来源"
      ? "保存来源材料的结构化片段失败。原文件已保留，请重新尝试上传。"
      : `${stage}失败，请稍后重试。`;
    return Response.json({ error: message }, { status: 422 });
  }
}
