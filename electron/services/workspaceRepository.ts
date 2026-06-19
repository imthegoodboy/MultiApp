import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Logger } from "pino";
import type { WorkspaceSnapshot } from "../../src/shared/workspace";

export interface WorkspaceRepository {
  loadSnapshot: () => Promise<WorkspaceSnapshot | null>;
  saveSnapshot: (snapshot: WorkspaceSnapshot) => Promise<WorkspaceSnapshot>;
}

export class FileWorkspaceRepository implements WorkspaceRepository {
  private readonly filePath: string;

  constructor(rootPath: string) {
    this.filePath = path.join(rootPath, "workspace-snapshot.json");
  }

  async loadSnapshot(): Promise<WorkspaceSnapshot | null> {
    try {
      const payload = await readFile(this.filePath, "utf8");
      return JSON.parse(payload) as WorkspaceSnapshot;
    } catch {
      return null;
    }
  }

  async saveSnapshot(snapshot: WorkspaceSnapshot): Promise<WorkspaceSnapshot> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(snapshot, null, 2), "utf8");
    return snapshot;
  }
}

export class SqliteWorkspaceRepository implements WorkspaceRepository {
  private database: unknown;
  private readonly filePath: string;
  private readonly sqliteModule: typeof import("node:sqlite");

  constructor(rootPath: string, sqliteModule: typeof import("node:sqlite")) {
    this.filePath = path.join(rootPath, "workspace.sqlite");
    this.sqliteModule = sqliteModule;
  }

  async init(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    this.database = new this.sqliteModule.DatabaseSync(this.filePath);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS workspace_snapshots (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  async loadSnapshot(): Promise<WorkspaceSnapshot | null> {
    const row = this.db
      .prepare("SELECT payload FROM workspace_snapshots ORDER BY updated_at DESC LIMIT 1")
      .get() as { payload: string } | undefined;

    return row ? (JSON.parse(row.payload) as WorkspaceSnapshot) : null;
  }

  async saveSnapshot(snapshot: WorkspaceSnapshot): Promise<WorkspaceSnapshot> {
    const payload = JSON.stringify(snapshot);

    this.db
      .prepare(
        `INSERT INTO workspace_snapshots (id, payload, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`
      )
      .run(snapshot.id, payload, snapshot.updatedAt);

    return snapshot;
  }

  private get db(): import("node:sqlite").DatabaseSync {
    if (!this.database) {
      throw new Error("SQLite repository was used before init");
    }

    return this.database as import("node:sqlite").DatabaseSync;
  }
}

export async function createWorkspaceRepository(rootPath: string, logger: Logger): Promise<WorkspaceRepository> {
  try {
    const sqliteModule = await import("node:sqlite");
    const repository = new SqliteWorkspaceRepository(rootPath, sqliteModule);
    await repository.init();
    logger.info({ rootPath }, "Using SQLite workspace repository");
    return repository;
  } catch (error) {
    logger.warn({ error }, "SQLite unavailable, using file workspace repository");
    return new FileWorkspaceRepository(rootPath);
  }
}
