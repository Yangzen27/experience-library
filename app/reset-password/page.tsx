"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setNotice("");
    try {
      const response = await fetch("/api/auth/update-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "更新失败");
      setNotice("密码已更新，现在可以返回经历库登录。");
    } catch (error) { setNotice(error instanceof Error ? error.message : "更新失败"); } finally { setSaving(false); }
  }
  return <main className="auth-screen"><section className="auth-card"><div className="auth-brand"><span className="brand-mark">E</span><b>经历库</b></div><h1>设置新密码</h1><p>请设置至少 10 位的新密码。</p><form onSubmit={submit}><label>新密码<input type="password" required minLength={10} value={password} onChange={(event) => setPassword(event.target.value)} /></label>{notice && <p className="auth-notice">{notice}</p>}<button className="confirm-action" disabled={saving}>{saving ? "保存中…" : "保存新密码"}</button></form>{notice.startsWith("密码已") && <Link className="auth-return" href="/">返回经历库</Link>}</section></main>;
}
