import type { ReviewQueueItem } from "@/lib/types";

interface QueueDb {
  items: Map<string, ReviewQueueItem>;
}

declare global {
  // eslint-disable-next-line no-var
  var __gmatReviewQueueDb__: QueueDb | undefined;
}

function getQueueDb(): QueueDb {
  if (!global.__gmatReviewQueueDb__) {
    global.__gmatReviewQueueDb__ = {
      items: new Map<string, ReviewQueueItem>(),
    };
  }

  return global.__gmatReviewQueueDb__;
}

export function seedQueueItem(item: ReviewQueueItem): void {
  getQueueDb().items.set(item.id, item);
}

export function getQueueItem(queueId: string): ReviewQueueItem | null {
  return getQueueDb().items.get(queueId) ?? null;
}

export function upsertQueueItem(item: ReviewQueueItem): void {
  getQueueDb().items.set(item.id, item);
}

export function listQueueItems(): ReviewQueueItem[] {
  return Array.from(getQueueDb().items.values()).sort((a, b) =>
    a.next_review_at.localeCompare(b.next_review_at),
  );
}

export function seedQueueItems(items: ReviewQueueItem[]): void {
  global.__gmatReviewQueueDb__ = {
    items: new Map(items.map((item) => [item.id, item])),
  };
}

export function resetQueueStoreForTests(): void {
  global.__gmatReviewQueueDb__ = {
    items: new Map<string, ReviewQueueItem>(),
  };
}
