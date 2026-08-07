import { readFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";

function parseEnv(source) {
  const result = {};
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    result[line.slice(0, separator).trim()] = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
  }
  return result;
}

try {
  const projectRoot = process.cwd();
  const config = parseEnv(await readFile(path.join(projectRoot, ".env"), "utf8"));
  if (!config.NEXT_PUBLIC_SUPABASE_URL || !(config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || config.NEXT_PUBLIC_SUPABASE_ANON_KEY)) throw new Error(".env 中缺少 NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  try { new URL(config.NEXT_PUBLIC_SUPABASE_URL); } catch { throw new Error("NEXT_PUBLIC_SUPABASE_URL 不是有效的 Supabase 项目地址"); }
  if (!config.DATABASE_URL) throw new Error(".env 中缺少 DATABASE_URL");
  if (!config.DEEPSEEK_API_KEY || config.DEEPSEEK_API_KEY.length < 10) throw new Error(".env 中的 DEEPSEEK_API_KEY 仍为空，请在项目目录的 .env 中填写密钥");

  const pool = new Pool({ connectionString: config.DATABASE_URL, connectionTimeoutMillis: 5000 });
  try { await pool.query("select 1"); }
  finally { await pool.end(); }

  console.log("✓ Supabase 配置检查通过：数据库可连接，Supabase Auth/Storage 地址已填写，DeepSeek Key 已填写");
} catch (error) {
  console.error(`\n启动检查失败：${error instanceof Error ? error.message : "未知错误"}\n`);
  process.exit(1);
}
