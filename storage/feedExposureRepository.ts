import type { SQLiteDatabase } from 'expo-sqlite';
import {
  type FeedContentIdentity,
  toFeedContentKey,
} from '@/utils/feedIdentity';
import { localDatabase } from './localDatabase';

export const FEED_EXPOSURE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const MAX_FEED_EXPOSURES_PER_CONTEXT = 5_000;
export const MAX_FEED_EXPOSURES = 20_000;

const EXPOSURE_TIMESTAMP_UPDATE_INTERVAL_MS = 60_000;

export interface FeedExposureContext {
  accountKey: string;
  feedType: string;
}

interface FeedExposureRow {
  content_type: string;
  content_id: string;
}

interface ExposureContextRow {
  account_key: string;
  feed_type: string;
}

/**
 * Bounded recent exposure state used by local Feed deduplication.
 *
 * This is intentionally not a complete behavior/event log. Future local
 * recommendation signals should use dedicated tables in the shared database.
 */
class FeedExposureRepository {
  private maintenancePromise: Promise<void> | null = null;

  async getRecentContentKeys(
    context: FeedExposureContext,
  ): Promise<Set<string>> {
    if (!this.isValidContext(context)) return new Set();
    await this.ensureMaintained();

    return localDatabase.run(async (database) => {
      const rows = await database.getAllAsync<FeedExposureRow>(
        `SELECT content_type, content_id
         FROM recent_feed_exposures
         WHERE account_key = ?
           AND feed_type = ?
           AND last_exposed_at >= ?`,
        [
          context.accountKey,
          context.feedType,
          Date.now() - FEED_EXPOSURE_RETENTION_MS,
        ],
      );
      return new Set(
        rows.map((row) =>
          toFeedContentKey({
            contentType: row.content_type,
            contentId: row.content_id,
          }),
        ),
      );
    });
  }

  async recordExposures(
    context: FeedExposureContext,
    identities: FeedContentIdentity[],
  ): Promise<void> {
    if (!this.isValidContext(context)) return;

    const uniqueIdentities = Array.from(
      new Map(
        identities
          .map((identity) => ({
            contentType: identity.contentType.trim(),
            contentId: identity.contentId.trim(),
          }))
          .filter(
            (identity) =>
              identity.contentType.length > 0 && identity.contentId.length > 0,
          )
          .map((identity) => [toFeedContentKey(identity), identity]),
      ).values(),
    );
    if (uniqueIdentities.length === 0) return;
    await this.ensureMaintained();

    await localDatabase.run(async (database) => {
      const now = Date.now();
      await database.withTransactionAsync(async () => {
        for (const identity of uniqueIdentities) {
          await database.runAsync(
            `INSERT INTO recent_feed_exposures (
               account_key,
               feed_type,
               content_type,
               content_id,
               last_exposed_at
             ) VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(
               account_key,
               feed_type,
               content_type,
               content_id
             ) DO UPDATE SET
               last_exposed_at = excluded.last_exposed_at
             WHERE excluded.last_exposed_at
               - recent_feed_exposures.last_exposed_at >= ?`,
            [
              context.accountKey,
              context.feedType,
              identity.contentType,
              identity.contentId,
              now,
              EXPOSURE_TIMESTAMP_UPDATE_INTERVAL_MS,
            ],
          );
        }

        await this.prune(database, now, context);
      });
    });
  }

  async clearAll(): Promise<void> {
    await this.ensureMaintained();
    await localDatabase.run(async (database) => {
      await database.runAsync('DELETE FROM recent_feed_exposures');
    });
  }

  async clearAccount(accountKey: string): Promise<void> {
    if (!accountKey.trim()) return;
    await this.ensureMaintained();
    await localDatabase.run(async (database) => {
      await database.runAsync(
        'DELETE FROM recent_feed_exposures WHERE account_key = ?',
        [accountKey],
      );
    });
  }

  private async ensureMaintained(): Promise<void> {
    if (!this.maintenancePromise) {
      this.maintenancePromise = localDatabase
        .run((database) => this.prune(database, Date.now()))
        .catch((error) => {
          this.maintenancePromise = null;
          throw error;
        });
    }
    await this.maintenancePromise;
  }

  private isValidContext(context: FeedExposureContext): boolean {
    return Boolean(context.accountKey.trim() && context.feedType.trim());
  }

  private async prune(
    database: SQLiteDatabase,
    now: number,
    changedContext?: FeedExposureContext,
  ): Promise<void> {
    await database.runAsync(
      'DELETE FROM recent_feed_exposures WHERE last_exposed_at < ?',
      [now - FEED_EXPOSURE_RETENTION_MS],
    );

    const contexts = changedContext
      ? [
          {
            account_key: changedContext.accountKey,
            feed_type: changedContext.feedType,
          },
        ]
      : await database.getAllAsync<ExposureContextRow>(
          `SELECT account_key, feed_type
           FROM recent_feed_exposures
           GROUP BY account_key, feed_type
           HAVING COUNT(*) > ?`,
          [MAX_FEED_EXPOSURES_PER_CONTEXT],
        );

    for (const context of contexts) {
      await database.runAsync(
        `DELETE FROM recent_feed_exposures
         WHERE rowid IN (
           SELECT rowid
           FROM recent_feed_exposures
           WHERE account_key = ? AND feed_type = ?
           ORDER BY
             last_exposed_at DESC,
             content_type DESC,
             content_id DESC
           LIMIT -1 OFFSET ?
         )`,
        [
          context.account_key,
          context.feed_type,
          MAX_FEED_EXPOSURES_PER_CONTEXT,
        ],
      );
    }

    await database.runAsync(
      `DELETE FROM recent_feed_exposures
       WHERE rowid IN (
         SELECT rowid
         FROM recent_feed_exposures
         ORDER BY
           last_exposed_at DESC,
           account_key DESC,
           feed_type DESC,
           content_type DESC,
           content_id DESC
         LIMIT -1 OFFSET ?
       )`,
      [MAX_FEED_EXPOSURES],
    );
  }
}

export const feedExposureRepository = new FeedExposureRepository();
