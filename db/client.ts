import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
// 上传分段在事务内顺序写入，避免短时间创建大量数据库请求。
export const db = connectionString ? drizzle(new Pool({ connectionString, connectionTimeoutMillis: 5000 })) : null;
