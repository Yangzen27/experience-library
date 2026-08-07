# 本地经历库 MVP 启动说明

## 1. 配置环境变量

复制 `.env.example` 为 `.env`，然后填写：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
DATABASE_URL=postgresql://postgres.YOUR_PROJECT_REF:YOUR_DATABASE_PASSWORD@aws-0-YOUR_REGION.pooler.supabase.com:6543/postgres?sslmode=require
DEEPSEEK_API_KEY=你的DeepSeek_API_Key
```

`.env` 已被 Git 忽略；不要把 Key 粘贴到代码、聊天记录或提交中。

## 2. 初始化数据库

创建名为 `experience_library` 的本机 PostgreSQL 数据库，并执行：

```bash
psql "$DATABASE_URL" -f db/migrations/0000_init.sql
psql "$DATABASE_URL" -f db/migrations/0001_library_state.sql
psql "$DATABASE_URL" -f db/migrations/0002_resume_generation.sql
psql "$DATABASE_URL" -f db/migrations/0003_resume_profile.sql
psql "$DATABASE_URL" -f db/migrations/0004_supabase_auth_isolation.sql
```

## 3. 运行

```bash
npm run dev
```

启动命令会先检查三件事：Supabase 地址和 anon key 是否已填写、Supabase PostgreSQL 是否可连接、DeepSeek Key 是否已填写。原始文件已迁移到 Supabase 私有 Storage，不再依赖本机附件目录。检查通过后固定使用 `http://localhost:3100`，避免误连旧的 Worker 预览端口。

上传入口现已接到 `/api/process`：原文件会保存至 `local-data/uploads/`，文本会写入 `files` 与 `source_chunks` 表，再发送文本片段给 DeepSeek Flash 生成结构化整理计划。

当前实际支持文字版 PDF、DOCX、TXT、Markdown；扫描件与图片 OCR 是下一阶段能力。
