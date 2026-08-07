import mammoth from "mammoth";

export type ExtractedChunk = { sequence: string; content: string; pageNumber?: string };

export async function extractText(name: string, mimeType: string, buffer: Buffer): Promise<ExtractedChunk[]> {
  const lower = name.toLowerCase();
  let text = "";
  if (mimeType.startsWith("text/") || lower.endsWith(".md")) text = buffer.toString("utf8");
  else if (lower.endsWith(".docx")) text = (await mammoth.extractRawText({ buffer })).value;
  else if (lower.endsWith(".pdf")) {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try { text = (await parser.getText()).text; }
    finally { await parser.destroy(); }
  } else throw new Error("暂仅支持 PDF、DOCX、TXT 与 Markdown 文件。");
  // PostgreSQL text 不接受 NUL 字符；部分 DOCX 可能夹带该控制符，移除不会改变可读正文。
  const paragraphs = text.replace(/\u0000/g, "").split(/\n\s*\n|\r?\n/).map((item) => item.trim()).filter(Boolean);
  return paragraphs.map((content, index) => ({ sequence: String(index + 1), content }));
}
