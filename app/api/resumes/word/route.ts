import JSZip from "jszip";
import type { ResumeDraft } from "@/lib/resume-types";
import { requireUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
const sectionOrder = ["工作经历", "实习经历", "项目经历", "校园经历"];

function escapeXml(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;"); }
function canonicalType(value: string) { if (value.includes("工作")) return "工作经历"; if (value.includes("实习")) return "实习经历"; if (value.includes("校园") || value.includes("社团") || value.includes("学生")) return "校园经历"; return "项目经历"; }
function cleanOrg(value: string) { return value?.trim() === "机构待确认" ? "" : value?.trim() || ""; }
function periodScore(period: string) { if (/至今|现在|present/i.test(period)) return 999999; const matches = [...period.matchAll(/(20\d{2})(?:[.\-/年](\d{1,2}))?/g)]; if (!matches.length) return 0; const last = matches[matches.length - 1]; return Number(last[1]) * 100 + Number(last[2] || 12); }
function paragraph(text: string, options: { bold?: boolean; size?: number; after?: number; align?: "center" | "both"; color?: string; border?: boolean } = {}) { const size = options.size ?? 20; const after = options.after ?? 70; return `<w:p><w:pPr><w:spacing w:after="${after}"/>${options.align ? `<w:jc w:val="${options.align}"/>` : ""}${options.border ? '<w:pBdr><w:bottom w:val="single" w:sz="9" w:space="3" w:color="3C6382"/></w:pBdr>' : ""}</w:pPr><w:r><w:rPr>${options.bold ? "<w:b/>" : ""}${options.color ? `<w:color w:val="${options.color}"/>` : ""}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`; }
function row(left: string, middle: string, right: string) { return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="3600"/><w:gridCol w:w="3000"/><w:gridCol w:w="2400"/></w:tblGrid><w:tr>${[left, middle, right].map((value, index) => `<w:tc><w:tcPr><w:tcW w:w="${index === 0 ? 3600 : index === 1 ? 3000 : 2400}" w:type="dxa"/></w:tcPr><w:p><w:pPr>${index === 2 ? '<w:jc w:val="right"/>' : index === 1 ? '<w:jc w:val="center"/>' : ""}</w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>${escapeXml(value)}</w:t></w:r></w:p></w:tc>`).join("")}</w:tr></w:tbl>`; }

function buildDocument(draft: ResumeDraft) {
  const blocks: string[] = []; const profile = draft.resumeProfile ?? { name: "", phone: "", email: "", educations: [], professionalSkills: [], certificates: [] }; const isEnglish = draft.language === "英文";
  const labels = isEnglish ? { education: "Education", skills: "Skills", professional: "Professional Skills", certificates: "Certifications", name: "[Name]", phone: "[Phone]", email: "[Email]", school: "[University]", major: "[Major]", dates: "[Dates]", emptySkills: "[Please add professional skills]", emptyCertificates: "[Please add certifications]", types: { "工作经历": "Work Experience", "实习经历": "Internship Experience", "项目经历": "Project Experience", "校园经历": "Campus Experience" } } : { education: "教育经历", skills: "个人技能", professional: "专业技能", certificates: "资格证书", name: "[姓名]", phone: "[电话]", email: "[邮箱]", school: "[学校]", major: "[专业]", dates: "[时间]", emptySkills: "[请填写专业技能]", emptyCertificates: "[请填写资格证书]", types: { "工作经历": "工作经历", "实习经历": "实习经历", "项目经历": "项目经历", "校园经历": "校园经历" } };
  blocks.push(paragraph(profile.name || labels.name, { bold: true, size: 32, after: 70, align: "center" }));
  blocks.push(paragraph([profile.phone || labels.phone, profile.email || labels.email].join("  |  "), { size: 18, after: 150, align: "center" }));
  blocks.push(paragraph(labels.education, { bold: true, size: 23, after: 70, color: "315F7D", border: true }));
  if (profile.educations.length) for (const education of profile.educations) blocks.push(row(education.school || labels.school, education.major || labels.major, [education.startYear, education.endYear].filter(Boolean).join(" — ") || labels.dates));
  else blocks.push(row(labels.school, labels.major, labels.dates));
  for (const type of sectionOrder) {
    const group = (draft.experiences ?? []).filter((item) => canonicalType(item.type) === type).sort((left, right) => periodScore(right.period) - periodScore(left.period));
    if (!group.length) continue;
    blocks.push(paragraph(labels.types[type as keyof typeof labels.types], { bold: true, size: 23, after: 70, color: "315F7D", border: true }));
    for (const experience of group) {
      const org = cleanOrg(experience.org); blocks.push(row(org || experience.title, org ? experience.title : "", experience.period));
      const bullets = experience.resumeBullets?.length ? experience.resumeBullets : [experience.resumeSummary, ...(experience.evidence ?? [])].filter(Boolean);
      for (const bullet of bullets) blocks.push(paragraph(`• ${bullet.replace(/^•\s*/, "")}`, { size: 19, after: 45, align: "both" }));
    }
  }
  blocks.push(paragraph(labels.skills, { bold: true, size: 23, after: 70, color: "315F7D", border: true }));
  blocks.push(paragraph(`${labels.professional}: ${(draft.skills ?? []).join(isEnglish ? ", " : "、") || labels.emptySkills}`, { size: 19, after: 45 }));
  blocks.push(paragraph(`${labels.certificates}: ${(draft.certificates ?? []).join(isEnglish ? ", " : "、") || labels.emptyCertificates}`, { size: 19, after: 45 }));
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${blocks.join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="850" w:right="850" w:bottom="850" w:left="850"/></w:sectPr></w:body></w:document>`;
}

export async function POST(request: Request) {
  try {
    const { user, response } = await requireUser();
    if (!user) return response!;
    const draft = await request.json() as ResumeDraft; if (!draft || !Array.isArray(draft.experiences)) return Response.json({ error: "草稿内容不完整" }, { status: 400 });
    const zip = new JSZip(); zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`); zip.folder("_rels")?.file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`); zip.folder("word")?.file("document.xml", buildDocument(draft)); zip.folder("word")?.folder("_rels")?.file("document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`);
    const content = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }); const body = content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) as ArrayBuffer; const safeName = (draft.title || "定制简历").replace(/[\\/:*?\"<>|]/g, "-"); return new Response(body, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${safeName}.docx`)}` } });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Word导出失败" }, { status: 422 }); }
}
