const PERSISTENT_DEDUP_TABS = new Set(['recommend', 'local']);

const FEED_TYPE_KEYS: Record<string, string> = {
  answer: 'answer',
  answers: 'answer',
  article: 'article',
  articles: 'article',
  pin: 'pin',
  pins: 'pin',
  question: 'question',
  questions: 'question',
};

export interface FeedIdentitySource {
  id?: string | number | null;
  isIdStable?: boolean;
  type?: string | null;
}

export function supportsPersistentFeedDedup(tab: string): boolean {
  return PERSISTENT_DEDUP_TABS.has(tab);
}

export function getFeedContentKey(item: FeedIdentitySource): string | null {
  if (item.isIdStable === false) return null;
  const id = item.id?.toString().trim();
  const type = item.type ? FEED_TYPE_KEYS[item.type] : undefined;
  if (!id || !type) return null;
  return `${type}:${id}`;
}

export function getInMemoryFeedKey(item: FeedIdentitySource): string | null {
  const contentKey = getFeedContentKey(item);
  if (contentKey) return contentKey;

  const id = item.id?.toString().trim();
  return id ? `unknown:${id}` : null;
}

export function getFeedDedupScope(accountKey: string, tab: string): string {
  return `${accountKey}:${tab}`;
}
