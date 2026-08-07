import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const file = (path) => readFile(new URL(path, root), "utf8");

test("the application shell presents the two primary product modules", async () => {
  const page = await file("app/page.tsx");
  assert.match(page, /我的经历/);
  assert.match(page, /简历生成/);
  assert.match(page, /<AuthGate>/);
  assert.match(page, /ResumePrototype/);
});

test("authentication gate has login, registration, password reset and no local-user fallback", async () => {
  const gate = await file("components/AuthGate.tsx");
  assert.match(gate, /登录你的经历库/);
  assert.match(gate, /创建个人经历库/);
  assert.match(gate, /忘记密码/);
  assert.match(gate, /退出登录/);
  assert.doesNotMatch(gate, /local-user/);
});

test("login does not mislabel an unconfirmed email as a wrong password", async () => {
  const route = await file("app/api/auth/login/route.ts");
  assert.match(route, /email not confirmed/);
  assert.match(route, /该邮箱尚未验证/);
});

test("email confirmation returns to the local auth callback", async () => {
  const route = await file("app/api/auth/register/route.ts");
  assert.match(route, /new URL\("\/auth\/callback", request\.url\)/);
  assert.match(route, /emailRedirectTo/);
});

test("resume preview preserves the requested sections and removes job-direction text", async () => {
  const prototype = await file("components/ResumePrototype.tsx");
  assert.match(prototype, /const sectionOrder = \["工作经历", "实习经历", "项目经历", "校园经历"\]/);
  assert.match(prototype, /education: "教育经历"/);
  assert.match(prototype, /skills: "个人技能"/);
  assert.doesNotMatch(prototype, /求职方向/);
});

test("English and bilingual resume output use localized templates and distinct drafts", async () => {
  const [prototype, writer, ai] = await Promise.all([
    file("components/ResumePrototype.tsx"), file("app/api/resumes/word/route.ts"), file("lib/resume-ai.ts"),
  ]);
  assert.match(prototype, /outputMode === "中英文双份" \? \["中文", "英文"\] : \[outputMode\]/);
  assert.match(prototype, /AI生成中文简历/);
  assert.match(prototype, /AI生成英文简历/);
  assert.match(prototype, /AI生成中英文简历/);
  assert.match(prototype, /previewDrafts\.map/);
  assert.match(prototype, /englishProfileSnapshot/);
  assert.match(prototype, /profile: \{ name: profile\.name, educations: profile\.educations \}/);
  assert.match(prototype, /Work Experience/);
  assert.match(writer, /Internship Experience/);
  assert.match(writer, /draft\.language === "英文"/);
  assert.match(ai, /所有面向招聘者的字段.*英文/);
  assert.match(ai, /english_name/);
  assert.match(ai, /全大写汉语拼音/);
  assert.match(ai, /school 与 major 必须翻译为规范、自然的英文/);
});
