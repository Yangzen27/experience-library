"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { ResumePrototype } from "@/components/ResumePrototype";
import { ResumeProfilePage } from "@/components/ResumeProfilePage";
import { AuthGate, useAuth } from "@/components/AuthGate";
import type { ResumeProfile } from "@/lib/resume-types";

type SourceMaterial = { name: string; url: string; addedAt: string };
type Experience = { id: number; title: string; org: string; period: string; type: string; status: string; color: string; summary: string; tags: string[]; archived?: boolean; sourceName?: string; sourceUrl?: string; sourceMaterials?: SourceMaterial[]; evidence?: string[]; createdAt: string; createdVia: "upload" | "manual" };
type SourcedValue = { value?: string; source_chunk_ids?: string[]; confidence?: string };
type EvidencePoint = { category?: string; content?: string; skills?: string[]; tags?: string[]; source_chunk_ids?: string[]; confidence?: string };
type Candidate = { experience_type?: string; organization_name?: SourcedValue; title?: SourcedValue; start_date?: SourcedValue; end_date?: SourcedValue; structured_summary?: string; evidence_points?: EvidencePoint[] };
type Analysis = { experience_candidates?: Candidate[]; questions_for_user?: Array<string | Record<string, unknown>> };

const initialExperiences: Experience[] = [];

type Notice = { text: string; tone?: "success" | "warning" } | null;
const emptyResumeProfile: ResumeProfile = { name: "", phone: "", email: "", educations: [], professionalSkills: [], certificates: [] };
const typeColors: Record<string, string> = { "工作经历": "blue", "实习经历": "blue", "项目经历": "violet", "校园经历": "orange" };

function normalizeExperienceType(value: string) {
  if (value.includes("工作")) return "工作经历";
  if (value.includes("实习")) return "实习经历";
  if (value.includes("校园") || value.includes("社团") || value.includes("学生")) return "校园经历";
  return "项目经历";
}
function cleanOrganization(value: string) { return value.trim() === "机构待确认" ? "" : value.trim(); }
function normalizeExperience(item: Experience): Experience { const type = normalizeExperienceType(item.type || ""); return { ...item, type, org: cleanOrganization(item.org || ""), color: typeColors[type] }; }
function candidatePeriod(candidate: Candidate) { const start = candidate.start_date?.value?.trim() || "时间待确认"; const end = candidate.end_date?.value?.trim() || ""; return end ? `${start} — ${end}` : start; }
function needsTimeConfirmation(period: string) { return !period.trim() || period.includes("时间待确认") || period.includes("开始时间待确认") || period.includes("结束时间待确认"); }

function normalized(value: string) { return value.normalize("NFKC").toLowerCase().replace(/[\s·•—–_\-（）()【】\[\]，,。.\/\\]/g, ""); }
function sameOrganization(left: string, right: string) { const a = normalized(cleanOrganization(left)); const b = normalized(cleanOrganization(right)); if (!a && !b) return true; return a.length >= 2 && b.length >= 2 && (a === b || a.includes(b) || b.includes(a)); }
function isSameExperience(left: Pick<Experience, "title" | "org" | "period">, right: Pick<Experience, "title" | "org" | "period">) {
  return normalized(left.title) === normalized(right.title) && sameOrganization(left.org, right.org) && normalized(left.period) === normalized(right.period);
}
function textSimilarity(left: string, right: string) {
  const grams = (value: string) => { const clean = normalized(value); return new Set(Array.from({ length: Math.max(0, clean.length - 1) }, (_, index) => clean.slice(index, index + 2))); };
  const a = grams(left); const b = grams(right); if (!a.size || !b.size) return normalized(left) === normalized(right) ? 1 : 0;
  const shared = [...a].filter((item) => b.has(item)).length; return shared / (a.size + b.size - shared);
}
function mergeUniqueText(existing: string[], incoming: string[]) {
  return incoming.reduce((all, item) => item && !all.some((saved) => textSimilarity(saved, item) >= 0.82) ? [...all, item] : all, [...existing]);
}
function mergeExperiences(existing: Experience, incoming: Experience): Experience {
  const oldMaterials = existing.sourceMaterials ?? (existing.sourceName ? [{ name: existing.sourceName, url: existing.sourceUrl || "", addedAt: existing.createdAt }] : []);
  const newMaterials = incoming.sourceMaterials ?? (incoming.sourceName ? [{ name: incoming.sourceName, url: incoming.sourceUrl || "", addedAt: incoming.createdAt }] : []);
  const sourceMaterials = [...oldMaterials];
  for (const material of newMaterials) if (!sourceMaterials.some((saved) => saved.url && saved.url === material.url)) sourceMaterials.push(material);
  return { ...existing, summary: incoming.summary.length > existing.summary.length ? incoming.summary : existing.summary, tags: Array.from(new Set([...existing.tags, ...incoming.tags])), evidence: mergeUniqueText(existing.evidence ?? [], incoming.evidence ?? []), sourceName: incoming.sourceName || existing.sourceName, sourceUrl: incoming.sourceUrl || existing.sourceUrl, sourceMaterials, status: "已整理" };
}

function HomeWorkspace() {
  const { user, signOut } = useAuth();
  const [page, setPage] = useState<"library" | "resume" | "profile">("library");
  const [items, setItems] = useState(initialExperiences);
  const [resumeProfile, setResumeProfile] = useState<ResumeProfile>(emptyResumeProfile);
  const [selectedId, setSelectedId] = useState(0);
  const [drawer, setDrawer] = useState(false);
  const [upload, setUpload] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processError, setProcessError] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("全部类型");
  const [statusFilter, setStatusFilter] = useState("全部状态");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [uploadedName, setUploadedName] = useState("");
  const [uploadedFileUrl, setUploadedFileUrl] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [pendingChanges, setPendingChanges] = useState<string[]>([]);
  const [candidatePeriods, setCandidatePeriods] = useState<Record<number, string>>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [libraryReady, setLibraryReady] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/library").then(async (response) => {
      const body = await response.json() as { experiences?: Experience[]; error?: string };
      if (!response.ok) throw new Error(body.error || "读取经历库失败");
      if (!active) return;
      const saved = Array.isArray(body.experiences) ? body.experiences.map(normalizeExperience) : [];
      setItems(saved); setSelectedId(saved[0]?.id ?? 0); setDrawer(Boolean(saved.length)); setLibraryReady(true);
    }).catch((error) => { if (active) { setSaveError(error instanceof Error ? error.message : "读取经历库失败"); setLibraryReady(true); } });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    fetch("/api/resume-profile").then(async (response) => {
      const body = await response.json() as { profile?: ResumeProfile; error?: string };
      if (!response.ok) throw new Error(body.error || "读取简历资料失败");
      setResumeProfile(body.profile ?? emptyResumeProfile);
    }).catch((error) => setSaveError(error instanceof Error ? error.message : "读取简历资料失败"));
  }, []);

  async function saveResumeProfile(profile: ResumeProfile) {
    const response = await fetch("/api/resume-profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) });
    const body = await response.json() as { profile?: ResumeProfile; error?: string };
    if (!response.ok || !body.profile) throw new Error(body.error || "保存简历资料失败");
    setResumeProfile(body.profile);
  }

  useEffect(() => {
    if (!libraryReady) return;
    const timer = window.setTimeout(() => {
      fetch("/api/library", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ experiences: items }) })
        .then(async (response) => { if (!response.ok) { const body = await response.json(); throw new Error(body.error || "保存经历库失败"); } setSaveError(""); })
        .catch((error) => setSaveError(error instanceof Error ? error.message : "保存经历库失败"));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [items, libraryReady]);

  const selected = items.find((item) => item.id === selectedId) ?? items[0];
  const candidates = analysis?.experience_candidates ?? [];
  const evidence = candidates.flatMap((candidate, candidateIndex) => (candidate.evidence_points ?? []).map((point, pointIndex) => ({ ...point, key: `${candidateIndex}-${pointIndex}`, candidate })));
  const completion = items.length ? Math.min(100, 35 + items.filter((item) => item.summary && item.period && item.evidence?.length).length * 15) : 0;
  const selectedSources = resultOpen ? (uploadedName ? [{ name: uploadedName, url: uploadedFileUrl, addedAt: new Date().toISOString() }] : []) : (selected?.sourceMaterials ?? (selected?.sourceName ? [{ name: selected.sourceName, url: selected.sourceUrl || "", addedAt: selected.createdAt }] : []));
  const sourceEvidence = resultOpen ? evidence.map((point) => point.content || "").filter(Boolean) : (selected?.evidence ?? []);
  const candidateMatches = candidates.map((candidate, index) => items.find((item) => isSameExperience(item, { title: candidate.title?.value || "未命名经历", org: candidate.organization_name?.value || "", period: candidatePeriods[index] ?? candidatePeriod(candidate) })));
  const unconfirmedTimeIndexes = candidates.map((candidate, index) => ({ candidate, index, period: candidatePeriods[index] ?? candidatePeriod(candidate) })).filter(({ period }) => needsTimeConfirmation(period)).map(({ index }) => index);
  const filtered = useMemo(() => items.filter((item) => {
    const matchesQuery = (item.title + item.org + item.tags.join(" ")).toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (typeFilter === "全部类型" || item.type === typeFilter) && (statusFilter === "全部状态" || item.status === statusFilter) && (showArchived ? item.archived : !item.archived);
  }), [items, query, typeFilter, statusFilter, showArchived]);

  function toast(text: string, tone: "success" | "warning" = "success") { setNotice({ text, tone }); window.setTimeout(() => setNotice(null), 2800); }
  function chooseExperience(id: number) { setSelectedId(id); setDrawer(true); setMoreOpen(false); }
  function onPickFile(event: ChangeEvent<HTMLInputElement>) { setSelectedFile(event.target.files?.[0] ?? null); setProcessError(""); }
  async function submitUpload() {
    if (!selectedFile) return setProcessError("请先选择一份材料。");
    if (!consent) return setProcessError("请先确认材料不含保密信息，且你有权上传。");
    setProcessing(true); setProcessError("");
    try {
      const uploadRequest = await fetch("/api/uploads/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: selectedFile.name, type: selectedFile.type, size: selectedFile.size }) });
      const upload = await uploadRequest.json() as { error?: string; fileId?: string; storagePath?: string; signedUrl?: string };
      if (!uploadRequest.ok || !upload.fileId || !upload.storagePath || !upload.signedUrl) throw new Error(upload.error || "未能准备安全上传");
      const directForm = new FormData(); directForm.append("cacheControl", "3600"); directForm.append("", selectedFile);
      const directResponse = await fetch(upload.signedUrl, { method: "PUT", headers: { "x-upsert": "false" }, body: directForm });
      if (!directResponse.ok) throw new Error("原始材料上传至私有存储失败，请重试。");
      const response = await fetch("/api/process", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileId: upload.fileId, storagePath: upload.storagePath, name: selectedFile.name, type: selectedFile.type, size: selectedFile.size }) });
      const raw = await response.text();
      let body: { error?: string; fileUrl?: string; analysis?: Analysis } = {};
      try { body = raw ? JSON.parse(raw) : {}; } catch { /* The fallback below gives a readable local error. */ }
      if (!raw) throw new Error("整理服务没有返回结果。请确认已使用 npm run dev 重新启动本地服务。");
      if (!response.ok) throw new Error(body.error || "材料处理失败");
      if (!body.analysis) throw new Error("AI 已返回，但整理结果缺失。请重新整理这份材料。");
      const nextEvidence = (body.analysis.experience_candidates ?? []).flatMap((candidate, candidateIndex) => (candidate.evidence_points ?? []).map((_, pointIndex) => `${candidateIndex}-${pointIndex}`));
      const nextPeriods = Object.fromEntries((body.analysis.experience_candidates ?? []).map((candidate, index) => [index, candidatePeriod(candidate)]));
      setAnalysis(body.analysis); setPendingChanges(nextEvidence); setCandidatePeriods(nextPeriods); setUploadedName(selectedFile.name); setUploadedFileUrl(body.fileUrl || ""); setUpload(false); setSelectedFile(null); setConsent(false); setResultOpen(true);
    } catch (error) { setProcessError(error instanceof Error ? error.message : "材料处理失败"); }
    finally { setProcessing(false); }
  }
  function saveExperience(event: FormEvent<HTMLFormElement>, isNew: boolean) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const title = String(data.get("title") || "").trim(); const org = cleanOrganization(String(data.get("org") || "")); const period = String(data.get("period") || "").trim(); const type = normalizeExperienceType(String(data.get("type") || "项目经历"));
    const summary = String(data.get("summary") || "").trim(); const tags = String(data.get("tags") || "").split(/[，,]/).map((tag) => tag.trim()).filter(Boolean);
    if (!title || !period || !summary || ((type === "工作经历" || type === "实习经历") && !org)) return toast(type === "工作经历" || type === "实习经历" ? "请补全名称、机构、时间与经历摘要。" : "请补全名称、时间与经历摘要。", "warning");
    if (isNew) {
      const next: Experience = { id: Date.now(), title, org, period, type, summary, tags, status: "待补充", color: typeColors[type] ?? "violet", evidence: [], createdAt: new Date().toISOString(), createdVia: "manual" };
      setItems((current) => [next, ...current]); setSelectedId(next.id); setManualOpen(false); setDrawer(true); toast("已创建经历，你可以继续补充来源材料。");
    } else {
      setItems((current) => current.map((item) => item.id === selected.id ? { ...item, title, org, period, type, summary, tags, color: typeColors[type] ?? item.color } : item));
      setEditOpen(false); toast("经历已更新，原始材料不会被改动。");
    }
  }
  function archiveSelected() { setItems((current) => current.map((item) => item.id === selected.id ? { ...item, archived: true } : item)); setMoreOpen(false); setDrawer(false); toast("已归档。这段经历仍会保留，可在“查看已归档”中找回。"); }
  function deleteSelected() { if (!window.confirm(`确认删除“${selected.title}”吗？原始来源材料不会被删除。`)) return; const remaining = items.filter((item) => item.id !== selected.id); setItems(remaining); setSelectedId(remaining[0]?.id ?? 0); setDrawer(Boolean(remaining.length)); setMoreOpen(false); toast("经历已删除；关联的原始材料仍被保留。", "warning"); }
  function applyResult() {
    if (!candidates.length) { setResultOpen(false); return toast("没有识别出可保存的经历。", "warning"); }
    if (unconfirmedTimeIndexes.length) return toast("请先补充所有标记为“时间待确认”的经历时间，再保存。", "warning");
    const now = Date.now();
    const additions = candidates.map((candidate, index): Experience => {
      const kept = (candidate.evidence_points ?? []).filter((_, pointIndex) => pendingChanges.includes(`${index}-${pointIndex}`));
      const period = candidatePeriods[index] ?? candidatePeriod(candidate);
      const createdAt = new Date().toISOString();
      const type = normalizeExperienceType(candidate.experience_type || "");
      return { id: now + index, title: candidate.title?.value || "未命名经历", org: cleanOrganization(candidate.organization_name?.value || ""), period, type, status: "已整理", color: typeColors[type], summary: candidate.structured_summary || kept.map((point) => point.content).filter(Boolean).join("；"), tags: Array.from(new Set(kept.flatMap((point) => [...(point.skills ?? []), ...(point.tags ?? [])]))), sourceName: uploadedName, sourceUrl: uploadedFileUrl, sourceMaterials: [{ name: uploadedName, url: uploadedFileUrl, addedAt: createdAt }], evidence: kept.map((point) => point.content || "").filter(Boolean), createdAt, createdVia: "upload" };
    });
    const nextItems: Experience[] = []; let merged = 0; let firstSavedId = additions[0].id;
    for (const existing of items) {
      const duplicateIndex = nextItems.findIndex((item) => isSameExperience(item, existing));
      if (duplicateIndex < 0) nextItems.push(existing);
      else { nextItems[duplicateIndex] = mergeExperiences(nextItems[duplicateIndex], existing); merged += 1; }
    }
    for (const addition of additions) {
      const matchIndex = nextItems.findIndex((item) => isSameExperience(item, addition));
      if (matchIndex < 0) { nextItems.unshift(addition); continue; }
      const existing = nextItems[matchIndex]; nextItems[matchIndex] = mergeExperiences(existing, addition);
      if (addition === additions[0]) firstSavedId = existing.id; merged += 1;
    }
    setItems(nextItems); setSelectedId(firstSavedId); setResultOpen(false); setDrawer(true); toast(merged ? `已自动合并 ${merged} 段重复经历，保留了全部来源材料。` : `已新增 ${additions.length} 段经历。`);
  }
  const modalTitle = manualOpen ? "手动创建经历" : "编辑经历";
  const formItem = manualOpen ? undefined : selected;

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">E</span><span>经历库</span></div>
      <nav><button className={page === "library" ? "nav-item active" : "nav-item"} onClick={() => { setPage("library"); setShowArchived(false); setDrawer(Boolean(items.length)); }}><span>▦</span>我的经历</button><button className={page === "profile" ? "nav-item active" : "nav-item"} onClick={() => { setPage("profile"); setDrawer(false); }}><span>▤</span>简历资料</button><button className={page === "resume" ? "nav-item active" : "nav-item"} onClick={() => { setPage("resume"); setDrawer(false); }}><span>✦</span>简历生成</button></nav>
      <div className="sidebar-bottom">
        <button className="quiet-button" onClick={() => setGuideOpen(true)}>？ 使用说明</button>
        <div className="profile-wrap"><button className="profile" onClick={() => setProfileOpen(!profileOpen)}><div className="avatar">{(user.username || user.email || "U").slice(0, 1).toUpperCase()}</div><div><b>{user.username || user.email}</b><small>个人工作区</small></div><span>⌄</span></button>{profileOpen && <div className="profile-menu"><button onClick={() => { setShowArchived(true); setProfileOpen(false); setDrawer(false); }}>查看已归档</button><button onClick={() => { setGuideOpen(true); setProfileOpen(false); }}>使用说明</button><button onClick={signOut}>退出登录</button></div>}</div>
      </div>
    </aside>

    {page === "resume" ? <ResumePrototype key={`resume-${JSON.stringify(resumeProfile)}`} experiences={items} profile={resumeProfile} onOpenProfile={() => setPage("profile")} onBackToLibrary={() => setPage("library")} /> : page === "profile" ? <ResumeProfilePage key={`profile-${JSON.stringify(resumeProfile)}`} profile={resumeProfile} onSave={saveResumeProfile} onOpenResume={() => setPage("resume")} /> : <><section className="content" id="library">
      <header className="topbar"><div className="crumb">个人经历库 <span>/</span> {showArchived ? "已归档" : "全部经历"}</div><div className="top-actions"><button className="outline-button" onClick={() => setManualOpen(true)}>＋ 手动创建</button><button className="outline-button" onClick={() => setUpload(true)}>上传材料</button></div></header>
      <div className="page-title"><div><p className="eyebrow">你的可复用职业素材</p><h1>{showArchived ? "已归档经历" : "所有经历，随时调用"}</h1><p className="subcopy">上传材料后，AI 会整理成可核对的结构化经历。</p></div><div className="completion"><b>{completion}%</b><span>经历库完整度</span><div><i style={{ width: `${completion}%` }} /></div></div></div>
      {!showArchived && <div className="action-card"><div className="ai-spark">✦</div><div><b>继续完善经历库</b><p>上传旧简历、工作笔记或项目材料，AI 会自动归类并补充到已有经历。</p></div><button onClick={() => setUpload(true)}>上传材料 <span>→</span></button></div>}
      <div className="toolbar"><div className="search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索经历、技能或关键词" /></div><select aria-label="按类型筛选" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option>全部类型</option><option>工作经历</option><option>实习经历</option><option>项目经历</option><option>校园经历</option></select><select aria-label="按状态筛选" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>全部状态</option><option>已整理</option><option>待补充</option></select><span className="result-count">{filtered.length} 段经历</span></div>
      {saveError && <p className="process-error">数据库同步失败：{saveError}</p>}<div className="experience-list">{!libraryReady ? <div className="empty-state"><b>正在读取经历库…</b></div> : filtered.length ? filtered.map((item) => <button className={`experience-card ${selected?.id === item.id ? "selected" : ""}`} key={item.id} onClick={() => chooseExperience(item.id)}><div className={`type-icon ${item.color}`}>{item.type === "实习经历" || item.type === "工作经历" ? "↗" : item.type === "项目经历" ? "◇" : "◌"}</div><div className="experience-main"><div className="title-line"><h2>{item.title}</h2><span className={`status ${item.status === "待补充" ? "pending" : ""}`}>{item.status}</span></div><p>{item.org && <>{item.org} <i>·</i> </>}{item.period}</p><div className="tag-row">{item.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></div><span className="chevron">›</span></button>) : <div className="empty-state"><b>{items.length ? "没有找到匹配的经历" : "经历库还是空的"}</b><p>{items.length ? "试试清空搜索或调整筛选条件。" : "上传简历或手动创建第一段经历。"}</p>{items.length && <button onClick={() => { setQuery(""); setTypeFilter("全部类型"); setStatusFilter("全部状态"); }}>清空筛选</button>}</div>}</div>
    </section>

    {drawer && selected && <aside className="detail-panel"><div className="detail-head"><span>经历详情</span><button aria-label="关闭详情" onClick={() => setDrawer(false)}>×</button></div><div className="detail-scroll"><div className="detail-icon">↗</div><p className="eyebrow">{selected.type} · {selected.period}</p><h2>{selected.title}</h2><p className="detail-org">{selected.org}</p><div className="detail-actions"><button className="primary-small" onClick={() => { setMoreOpen(false); setEditOpen(true); }}>编辑经历</button><div className="more-wrap"><button className="icon-button" aria-label="更多操作" onClick={() => setMoreOpen(!moreOpen)}>•••</button>{moreOpen && <div className="more-menu"><button onClick={() => { setHistoryOpen(true); setMoreOpen(false); }}>查看整理记录</button><button onClick={() => { setMoreOpen(false); setUpload(true); toast("请上传补充材料，AI 会基于新材料重新整理。" ); }}>重新 AI 整理</button><button onClick={archiveSelected}>归档经历</button><button className="danger" onClick={deleteSelected}>删除经历</button></div>}</div></div><hr /><section><h3>结构化摘要 {selected.createdVia === "upload" && <span className="ai-label">✦ AI 整理</span>}</h3><p className="summary">{selected.summary}</p></section><section><h3>工作内容与证据点</h3>{selected.evidence?.length ? selected.evidence.map((content, index) => <div className="evidence" key={`${selected.id}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><p>{content}</p>{selected.sourceName && <button aria-label="查看证据来源" onClick={() => setSourceOpen(true)}>↗</button>}</div>) : <p className="small-note">这段经历还没有关联证据点。</p>}</section><section><h3>来源材料 <small>{selectedSources.length} 个附件</small></h3>{selectedSources.length ? selectedSources.map((material, index) => <button className="source-file" key={`${material.url}-${index}`} onClick={() => setSourceOpen(true)}><div className="file-icon">FILE</div><div><b>{material.name}</b><small>{new Date(material.addedAt).toLocaleString("zh-CN", { dateStyle: "medium", timeStyle: "short" })} · 原文件已保留</small></div><span>›</span></button>) : <p className="small-note">这段经历由你手动创建，尚未上传来源材料。</p>}</section></div></aside>}

    {upload && <div className="modal-backdrop" onClick={() => !processing && setUpload(false)}><div className="upload-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" aria-label="关闭上传" onClick={() => !processing && setUpload(false)}>×</button><div className="modal-spark">✦</div><h2>把材料交给 AI 整理</h2><p>支持简历、项目文档、工作笔记、论文等。原文件会被完整保留。</p><label className="dropzone"><span>↑</span><b>{selectedFile ? selectedFile.name : "点击选择文件"}</b><small>PDF、DOCX、TXT、Markdown · 单个文件不超过 20MB</small><input type="file" accept=".pdf,.docx,.txt,.md,text/plain,application/pdf" disabled={processing} onChange={onPickFile} /></label><label className="consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> 我确认材料不含雇主保密信息，且我有权上传和使用。</label>{processError && <p className="process-error">{processError}</p>}<button className="upload-button" disabled={processing} onClick={submitUpload}>{processing ? "AI 正在提取并整理…" : "开始整理"}</button></div></div>}
    {(manualOpen || editOpen) && <div className="modal-backdrop" onClick={() => { setManualOpen(false); setEditOpen(false); }}><form className="form-modal" onClick={(event) => event.stopPropagation()} onSubmit={(event) => saveExperience(event, manualOpen)}><button type="button" className="modal-close" aria-label="关闭表单" onClick={() => { setManualOpen(false); setEditOpen(false); }}>×</button><h2>{modalTitle}</h2><p>核心信息由你确认；编辑不会更改任何原始来源材料。项目经历和校园经历可以不填写机构。</p><label>经历名称<input name="title" defaultValue={formItem?.title} placeholder="填写职位或项目名称" /></label><label>机构 <small>项目/校园经历可不填</small><input name="org" defaultValue={formItem?.org} placeholder="填写公司、组织或团队名称" /></label><div className="form-grid"><label>类型<select name="type" defaultValue={formItem?.type ?? "实习经历"}><option>工作经历</option><option>实习经历</option><option>项目经历</option><option>校园经历</option></select></label><label>时间<input name="period" defaultValue={formItem?.period} placeholder="填写开始和结束时间" /></label></div><label>结构化摘要<textarea name="summary" defaultValue={formItem?.summary} placeholder="概括你做了什么、带来了什么价值" /></label><label>技能标签<input name="tags" defaultValue={formItem?.tags.join("，")} placeholder="用逗号分隔多个技能" /></label><button className="upload-button" type="submit">{manualOpen ? "创建经历" : "保存修改"}</button></form></div>}
    {resultOpen && <div className="result-page"><header className="result-top"><div className="brand"><span className="brand-mark">E</span><span>经历库</span></div><button className="exit-result" onClick={() => setResultOpen(false)}>稍后查看</button></header><div className="result-layout"><section className="result-main"><div className="success-icon">✓</div><p className="eyebrow">AI 已完成整理</p><h1>{candidates.length ? `从材料中识别出 ${candidates.length} 段经历` : "没有识别出明确的职业经历"}</h1><p className="result-lead">《{uploadedName}》已完整保留。公司、岗位和时间一致的经历会自动合并，不会重复创建。</p>{candidates.map((candidate, index) => { const period = candidatePeriods[index] ?? candidatePeriod(candidate); const pendingTime = needsTimeConfirmation(period); return <div className={`merge-note candidate-review ${pendingTime ? "needs-time" : ""}`} key={`candidate-${index}`}><span>{index + 1}</span><div><b>{candidate.title?.value || "角色待确认"} · {candidate.organization_name?.value || "机构待确认"}</b><p>{candidateMatches[index] ? `将自动合并至已有经历“${candidateMatches[index]?.title}”，并去除高度相似的证据点。` : "未找到核心信息一致的已有经历，将创建新经历。"}<br />{candidate.experience_type || "类型待确认"}</p><label className="candidate-time-field">经历时间<input value={period} aria-invalid={pendingTime} onChange={(event) => setCandidatePeriods((current) => ({ ...current, [index]: event.target.value }))} placeholder="例如：2024.06 — 2024.09" /></label>{pendingTime && <small className="time-confirmation">请补充这段经历的开始和结束时间；时间未确认前不能保存。</small>}</div></div>; })}<h2 className="section-title">原文证据点 <span>{pendingChanges.length}/{evidence.length}</span></h2>{evidence.filter((point) => pendingChanges.includes(point.key)).map((point, index) => <article className="change-card" key={point.key}><div className="change-index">{String(index + 1).padStart(2, "0")}</div><div className="change-content"><span className="change-kind">{point.candidate.title?.value || "经历"} · {point.category || "工作内容"}</span><h3>{point.content || "未提取到具体内容"}</h3><p>{[...(point.skills ?? []), ...(point.tags ?? [])].join(" · ") || `可信度：${point.confidence || "待确认"}`}</p><button className="source-chip" onClick={() => setSourceOpen(true)}>⌁ 来源：{uploadedName} · {point.source_chunk_ids?.length || 0} 个原文段落</button></div><button className="remove-change" aria-label="移除此项新增内容" onClick={() => setPendingChanges((current) => current.filter((item) => item !== point.key))}>×</button></article>)}{!evidence.length && <div className="empty-state compact"><b>没有提取出可核对的证据点</b><p>原文件已经保留，但本次结果不建议直接保存。可以重新整理或手动创建。</p></div>}{evidence.length > 0 && !pendingChanges.length && <div className="empty-state compact"><b>你已移除全部证据点</b><p>原始文件仍然保留，本次内容不会加入经历库。</p></div>}</section><aside className="result-side"><div className="source-preview"><div className="file-icon large">PDF</div><b>{uploadedName}</b><small>原文件已保存</small>{uploadedFileUrl ? <a href={uploadedFileUrl} target="_blank" rel="noreferrer">查看原文 ›</a> : <button onClick={() => setSourceOpen(true)}>查看来源 ›</button>}</div>{unconfirmedTimeIndexes.length > 0 && <div className="confirm-box"><div className="warning-icon">!</div><div><b>有 {unconfirmedTimeIndexes.length} 段经历需要补充时间</b><p>请在经历卡片的“经历时间”填写框中补充开始和结束时间后再保存。</p></div></div>}{Boolean(analysis?.questions_for_user?.length) && <div className="confirm-box"><div className="warning-icon">!</div><div><b>有 {analysis?.questions_for_user?.length} 项待确认</b><p>{analysis?.questions_for_user?.map((question) => typeof question === "string" ? question : JSON.stringify(question)).join("；")}</p></div></div>}<div className="trust-note"><b>合并规则</b><p>公司、岗位和时间三项一致才自动合并；岗位或时间冲突时不会擅自覆盖。</p></div></aside></div><footer className="result-footer"><button className="secondary-action" onClick={() => setResultOpen(false)}>暂不应用</button><button className="confirm-action" disabled={!candidates.length || unconfirmedTimeIndexes.length > 0} onClick={applyResult}>{unconfirmedTimeIndexes.length ? "请先补充经历时间" : "确认并更新经历库"} <span>→</span></button></footer></div>}
    {guideOpen && <div className="modal-backdrop" onClick={() => setGuideOpen(false)}><section className="info-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" aria-label="关闭说明" onClick={() => setGuideOpen(false)}>×</button><h2>使用说明</h2><ol><li>上传任意与求职相关的材料，原文件会保留为来源材料。</li><li>AI 提取并形成结构化摘要；无法确认的角色、时间等核心信息会请你确认。</li><li>同一经历的相似材料会建议合并；核心信息不一致时不会自动覆盖。</li><li>你可随时手动创建、编辑、归档或删除经历；删除经历不会删除原文件。</li></ol><button className="upload-button" onClick={() => setGuideOpen(false)}>我知道了</button></section></div>}
    {sourceOpen && <div className="modal-backdrop" onClick={() => setSourceOpen(false)}><section className="info-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" aria-label="关闭来源材料" onClick={() => setSourceOpen(false)}>×</button><div className="file-icon large">FILE</div><h2>来源材料与证据</h2>{selectedSources.length ? <><p>当前经历关联了 {selectedSources.length} 份原始材料和 {sourceEvidence.length} 个去重后的证据点。</p>{sourceEvidence[0] && <blockquote>“{sourceEvidence[0]}”</blockquote>}{selectedSources.map((material, index) => material.url ? <a className="source-file" href={material.url} target="_blank" rel="noreferrer" key={`${material.url}-${index}`}><div className="file-icon">FILE</div><div><b>{material.name}</b><small>点击打开完整原文</small></div><span>›</span></a> : <div className="source-file" key={`${material.name}-${index}`}><div className="file-icon">FILE</div><div><b>{material.name}</b><small>原文件已保留</small></div></div>)}</> : <p>当前经历没有上传来源材料。</p>}<button className="secondary-action" onClick={() => setSourceOpen(false)}>关闭</button></section></div>}
    {historyOpen && selected && <div className="modal-backdrop" onClick={() => setHistoryOpen(false)}><section className="info-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" aria-label="关闭整理记录" onClick={() => setHistoryOpen(false)}>×</button><h2>整理记录</h2>{selected.createdVia === "manual" && <div className="history-item"><b>用户手动创建经历</b><span>{new Date(selected.createdAt).toLocaleString("zh-CN", { dateStyle: "medium", timeStyle: "short" })}</span><p>创建时没有关联来源材料。</p></div>}{(selected.sourceMaterials ?? []).map((material, index) => <div className="history-item" key={`${material.url}-${index}`}><b>{index === 0 && selected.createdVia === "upload" ? "AI 整理并创建经历" : "AI 合并补充材料"}</b><span>{new Date(material.addedAt).toLocaleString("zh-CN", { dateStyle: "medium", timeStyle: "short" })}</span><p>从《{material.name}》提取并合并内容；原文件未被改动。</p></div>)}<button className="upload-button" onClick={() => setHistoryOpen(false)}>关闭</button></section></div>}
    {notice && <div className={`toast ${notice.tone ?? "success"}`}>{notice.text}</div>}</>}
  </main>;
}

export default function Home() { return <AuthGate><HomeWorkspace /></AuthGate>; }
