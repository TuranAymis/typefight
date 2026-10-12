import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

/**
 * Minimal in-memory D1 stand-in on top of node:sqlite, covering the calls the API uses
 * (prepare/bind/first/all/run). The real migrations are applied, so schema drift fails tests.
 */
const migrationsDir = fileURLToPath(new URL('../../migrations/', import.meta.url));

type SqlValue = string | number | null;

class FakeStatement {
  private values: SqlValue[] = [];

  constructor(
    private readonly db: DatabaseSync,
    private readonly sql: string,
  ) {}

  bind(...values: SqlValue[]): FakeStatement {
    this.values = values;
    return this;
  }

  async first<T>(): Promise<T | null> {
    const row = this.db.prepare(this.sql).get(...this.values);
    return (row as T | undefined) ?? null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.db.prepare(this.sql).all(...this.values) as T[] };
  }

  async run(): Promise<{ meta: { changes: number } }> {
    const info = this.db.prepare(this.sql).run(...this.values);
    return { meta: { changes: Number(info.changes) } };
  }
}

export interface TestDb {
  readonly d1: D1Database;
  readonly raw: DatabaseSync;
}

export const createTestDb = (): TestDb => {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON');
  for (const file of readdirSync(migrationsDir).sort()) {
    if (file.endsWith('.sql')) raw.exec(readFileSync(`${migrationsDir}${file}`, 'utf8'));
  }
  const d1 = { prepare: (sql: string) => new FakeStatement(raw, sql) } as unknown as D1Database;
  return { d1, raw };
};
