"use client";

import { createContext, FormEvent, ReactNode, useContext, useEffect, useState } from "react";

type User = { id: string; email: string; username: string };
type AuthContextValue = { user: User; signOut: () => Promise<void> };
const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth 必须在 AuthGate 内使用");
  return value;
}

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error || "请求失败");
  return body;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"loading" | "signed-out" | "signed-in" | "misconfigured">("loading");
  const [mode, setMode] = useState<"login" | "register" | "reset">("login");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [username, setUsername] = useState(""); const [notice, setNotice] = useState(""); const [submitting, setSubmitting] = useState(false);

  const [user, setUser] = useState<User | null>(null);
  useEffect(() => { fetch("/api/auth/me").then(async (response) => { if (response.status === 401) return setStatus("signed-out"); if (response.status === 503) return setStatus("misconfigured"); const result = await readJson<{ user: User }>(response); setUser(result.user); setStatus("signed-in"); }).catch(() => setStatus("misconfigured")); }, []);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null); setStatus("signed-out"); setMode("login"); setPassword(""); setNotice("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setSubmitting(true); setNotice("");
    try {
      if (mode === "reset") { await readJson(await fetch("/api/auth/password-reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) })); setNotice("如该邮箱已注册，重置密码邮件已发送。"); return; }
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = mode === "login" ? { email, password } : { email, password, username };
      const result = await readJson<{ needsEmailConfirmation?: boolean }>(await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
      if (result.needsEmailConfirmation) { setNotice("注册成功，请先到邮箱确认后再登录。"); setMode("login"); return; }
      const me = await readJson<{ user: User }>(await fetch("/api/auth/me")); setUser(me.user); setStatus("signed-in");
    } catch (error) { setNotice(error instanceof Error ? error.message : "操作失败"); } finally { setSubmitting(false); }
  }

  if (status === "signed-in" && user) return <AuthContext.Provider value={{ user, signOut }}><>{children}</><button className="auth-signout" onClick={signOut}>退出登录</button></AuthContext.Provider>;
  if (status === "loading") return <main className="auth-screen"><p>正在确认登录状态…</p></main>;
  if (status === "misconfigured") return <main className="auth-screen"><section><span className="brand-mark">E</span><h1>需要连接 Supabase</h1><p>请完成 Supabase 项目配置后再使用个人经历库。</p></section></main>;
  return <main className="auth-screen"><section className="auth-card"><div className="auth-brand"><span className="brand-mark">E</span><b>经历库</b></div><h1>{mode === "login" ? "登录你的经历库" : mode === "register" ? "创建个人经历库" : "找回密码"}</h1><p>{mode === "login" ? "登录后，你只能访问自己的经历、附件与简历。" : mode === "register" ? "注册后即可建立独立、安全的个人经历库。" : "输入注册邮箱，我们会发送重置密码邮件。"}</p><form onSubmit={submit}>{mode === "register" && <label>用户名<input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="可选，用于展示" /></label>}<label>邮箱<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required /></label>{mode !== "reset" && <label>密码<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 10 位" required minLength={10} /></label>}{notice && <p className="auth-notice">{notice}</p>}<button className="confirm-action" disabled={submitting}>{submitting ? "处理中…" : mode === "login" ? "登录" : mode === "register" ? "注册" : "发送重置邮件"}</button></form><div className="auth-links">{mode !== "login" && <button onClick={() => { setMode("login"); setNotice(""); }}>已有账号，去登录</button>}{mode !== "register" && <button onClick={() => { setMode("register"); setNotice(""); }}>创建账号</button>}{mode !== "reset" && <button onClick={() => { setMode("reset"); setNotice(""); }}>忘记密码</button>}</div></section></main>;
}
