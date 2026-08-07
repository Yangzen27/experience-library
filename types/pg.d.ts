declare module "pg" {
  export class Pool {
    constructor(options?: { connectionString?: string; connectionTimeoutMillis?: number });
  }
}
