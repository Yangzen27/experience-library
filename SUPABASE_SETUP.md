# Supabase 上线配置与验收

本项目已改为“Supabase Auth + Supabase PostgreSQL + 私有 Supabase Storage”。因此用户不必在自己的电脑上启动 PostgreSQL；部署完成后打开网站即可注册、登录和使用。

## 1. 创建项目

1. 在 [Supabase Dashboard](https://supabase.com/dashboard) 新建项目，保存数据库密码。
2. 在 **Settings → API Keys** 复制 **Publishable key**（通常以 `sb_publishable_` 开头）。新版已不强调旧的 `anon public` key。
3. 在 **Settings → Integrations → Data API** 找到项目根地址并复制。它必须形如 `https://xxxx.supabase.co`。不要复制带有 `/rest/v1` 的 **Data API URL**，该地址会导致 Auth 路径拼接错误。
4. 返回项目主页面，点击顶部 **Connect**，选择 **Transaction pooler**，复制 Node/psql 可用的连接串（端口一般为 `6543`）并带 `sslmode=require`。
4. 在 **Authentication → Providers** 确认 Email 登录已启用；开发阶段可暂时关闭 Confirm email，正式上线建议开启。
5. 在 **Authentication → URL Configuration** 填写 Site URL（部署后的正式域名），并将 `https://你的域名/auth/callback` 加入 Redirect URLs。本地调试再加入 `http://localhost:3100/auth/callback`。

## 2. 建表与 RLS

在 Supabase 的 **SQL Editor** 中，按下列顺序执行：

1. `db/migrations/0000_init.sql`
2. `db/migrations/0001_library_state.sql`
3. `db/migrations/0002_resume_generation.sql`
4. `db/migrations/0003_resume_profile.sql`
5. `db/migrations/0004_supabase_auth_isolation.sql`

第五个迁移会做四件关键事：移除 `local-user` 默认值、给关联表补齐直属 `user_id`、为所有个人数据表启用 RLS、创建私有 `experience-materials` 文件桶及其路径隔离策略。

不要创建公开 bucket，也不要把 `service_role` key 放到浏览器、`.env` 前缀为 `NEXT_PUBLIC_` 的变量或 Git 仓库。

## 3. 配置环境变量

将 `.env.example` 的值填入本机 `.env`；部署到 Vercel / 其他托管平台时，把同样变量填入该平台的 Environment Variables。

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
DATABASE_URL=postgresql://...pooler.supabase.com:6543/postgres?sslmode=require
DEEPSEEK_API_KEY=你的密钥
```

随后运行：

```bash
npm run dev
```

若项目已部署，用户不需要运行这条命令；托管平台会持续运行服务。

## 4. 上线前验收

严格按 [tests/good-bad-cases.md](tests/good-bad-cases.md) 的 G-01~G-08、B-01~B-08 执行。最低要求是用两个独立浏览器会话完成 A/B 用户隔离实测，重点检查：B 访问 A 的 `/api/files/<id>` 必须返回 404。

本地代码已通过构建、静态隔离测试和未配置 Supabase 时的安全降级测试；由于本工作区没有你的 Supabase 项目密钥，注册、邮件和 A/B 数据库实测必须在你完成上述配置后再进行。
