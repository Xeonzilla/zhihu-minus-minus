import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

export const FEED_SEEN_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const MAX_FEED_SEEN_PER_SCOPE = 5_000;
export const MAX_FEED_SEEN_RECORDS = 20_000;

const DATABASE_NAME = 'feed-seen.db';
const DATABASE_VERSION = 1;
const RECORD_UPDATE_INTERVAL_MS = 60_000;

interface SeenContentRow {
  content_key: string;
}

interface ScopeRow {
  scope: string;
}

interface UserVersionRow {
  user_version: number;
}

class FeedSeenStorage {
  private databasePromise: Promise<SQLiteDatabase> | null = null;
  private operationChain: Promise<void> = Promise.resolve();

  async getSeenContentKeys(scope: string): Promise<Set<string>> {
    if (!scope) return new Set();

    return this.enqueue(async (database) => {
      const rows = await database.getAllAsync<SeenContentRow>(
        `SELECT content_key
         FROM feed_seen
         WHERE scope = ? AND seen_at >= ?`,
        [scope, Date.now() - FEED_SEEN_RETENTION_MS],
      );
      return new Set(rows.map((row) => row.content_key));
    });
  }

  async markSeen(scope: string, contentKeys: string[]): Promise<void> {
    const uniqueContentKeys = Array.from(
      new Set(contentKeys.map((key) => key.trim()).filter(Boolean)),
    );
    if (!scope || uniqueContentKeys.length === 0) return;

    await this.enqueue(async (database) => {
      const now = Date.now();

      await database.withTransactionAsync(async () => {
        for (const contentKey of uniqueContentKeys) {
          await database.runAsync(
            `INSERT INTO feed_seen (scope, content_key, seen_at)
             VALUES (?, ?, ?)
             ON CONFLICT(scope, content_key) DO UPDATE SET
               seen_at = excluded.seen_at
             WHERE excluded.seen_at - feed_seen.seen_at >= ?`,
            [scope, contentKey, now, RECORD_UPDATE_INTERVAL_MS],
          );
        }

        await this.prune(database, now, scope);
      });
    });
  }

  async clear(scope?: string): Promise<void> {
    await this.enqueue(async (database) => {
      if (scope) {
        await database.runAsync('DELETE FROM feed_seen WHERE scope = ?', [
          scope,
        ]);
      } else {
        await database.runAsync('DELETE FROM feed_seen');
      }
    });
  }

  private async initialize(): Promise<SQLiteDatabase> {
    if (!this.databasePromise) {
      this.databasePromise = this.openDatabase().catch((error) => {
        this.databasePromise = null;
        throw error;
      });
    }
    return this.databasePromise;
  }

  private async openDatabase(): Promise<SQLiteDatabase> {
    const database = await openDatabaseAsync(DATABASE_NAME);

    try {
      await database.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA busy_timeout = 5000;
        CREATE TABLE IF NOT EXISTS feed_seen (
          scope TEXT NOT NULL CHECK (length(scope) > 0),
          content_key TEXT NOT NULL CHECK (length(content_key) > 0),
          seen_at INTEGER NOT NULL,
          PRIMARY KEY (scope, content_key)
        );
        CREATE INDEX IF NOT EXISTS feed_seen_scope_seen_at_idx
          ON feed_seen (scope, seen_at DESC);
        CREATE INDEX IF NOT EXISTS feed_seen_seen_at_idx
          ON feed_seen (seen_at DESC);
      `);

      const version = await database.getFirstAsync<UserVersionRow>(
        'PRAGMA user_version',
      );
      if ((version?.user_version ?? 0) < DATABASE_VERSION) {
        await database.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
      }

      await database.withTransactionAsync(async () => {
        await this.prune(database, Date.now());
      });
      return database;
    } catch (error) {
      await database.closeAsync().catch(() => undefined);
      throw error;
    }
  }

  private enqueue<T>(
    operation: (database: SQLiteDatabase) => Promise<T>,
  ): Promise<T> {
    const result = this.operationChain.then(async () => {
      const database = await this.initialize();
      return operation(database);
    });
    this.operationChain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async prune(
    database: SQLiteDatabase,
    now: number,
    changedScope?: string,
  ): Promise<void> {
    await database.runAsync('DELETE FROM feed_seen WHERE seen_at < ?', [
      now - FEED_SEEN_RETENTION_MS,
    ]);

    const scopes = changedScope
      ? [{ scope: changedScope }]
      : await database.getAllAsync<ScopeRow>(
          `SELECT scope
           FROM feed_seen
           GROUP BY scope
           HAVING COUNT(*) > ?`,
          [MAX_FEED_SEEN_PER_SCOPE],
        );

    for (const { scope } of scopes) {
      await database.runAsync(
        `DELETE FROM feed_seen
         WHERE rowid IN (
           SELECT rowid
           FROM feed_seen
           WHERE scope = ?
           ORDER BY seen_at DESC, content_key DESC
           LIMIT -1 OFFSET ?
         )`,
        [scope, MAX_FEED_SEEN_PER_SCOPE],
      );
    }

    await database.runAsync(
      `DELETE FROM feed_seen
       WHERE rowid IN (
         SELECT rowid
         FROM feed_seen
         ORDER BY seen_at DESC, scope DESC, content_key DESC
         LIMIT -1 OFFSET ?
       )`,
      [MAX_FEED_SEEN_RECORDS],
    );
  }
}

export const feedSeenStorage = new FeedSeenStorage();
