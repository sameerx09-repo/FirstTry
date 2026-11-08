import { config } from "dotenv";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres";
import { sql as drizzleSql } from "drizzle-orm";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";
import { readFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
export const root = resolve(import.meta.dirname, "../../..");
config({ path: resolve(root, ".env"), quiet: true });
export type Row = Record<string, any>;
export class Database {
  private constructor(
    private driver: PGlite | Pool,
    private embedded = driver instanceof PGlite,
  ) {}
  static async open(memory = false) {
    await mkdir(resolve(root, ".local"), { recursive: true });
    const driver =
      process.env.DATABASE_URL && !memory
        ? new Pool({ connectionString: process.env.DATABASE_URL })
        : new PGlite(memory ? undefined : resolve(root, ".local/postgres"));
    const db = new Database(driver);
    for (const file of [
      "001_initial.sql",
      "002_tokens.sql",
      "003_dev_builds.sql",
    ])
      await db.exec(
        await readFile(resolve(root, "infra/migrations", file), "utf8"),
      );
    return db;
  }
  async query<T extends Row = Row>(
    text: string,
    args: unknown[] = [],
  ): Promise<T[]> {
    const fragments = text
      .split(/(\$\d+)/g)
      .map((part) =>
        /^\$\d+$/.test(part)
          ? drizzleSql`${args[Number(part.slice(1)) - 1]}`
          : drizzleSql.raw(part),
      );
    const statement = drizzleSql.join(fragments, drizzleSql.raw(""));
    try {
      const result = this.embedded
        ? await drizzlePglite(this.driver as PGlite).execute(statement)
        : await drizzlePostgres(this.driver as Pool).execute(statement);
      return result.rows as T[];
    } catch (error) {
      throw (error as { cause?: unknown }).cause ?? error;
    }
  }
  async exec(sql: string) {
    if (this.driver instanceof PGlite) await this.driver.exec(sql);
    else await this.driver.query(sql);
  }
  async transaction<T>(fn: (db: Database) => Promise<T>): Promise<T> {
    if (this.driver instanceof PGlite)
      return this.driver.transaction(async (tx) =>
        fn(new Database(tx as unknown as PGlite, true)),
      );
    const client = await this.driver.connect();
    try {
      await client.query("BEGIN");
      const value = await fn(new Database(client as unknown as Pool));
      await client.query("COMMIT");
      return value;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  async close() {
    if (this.driver instanceof PGlite) await this.driver.close();
    else await this.driver.end();
  }
}
