export type RetentionHoldEventType = 'applied' | 'released';
export interface RetentionHoldEvent {
  readonly id: string;
  readonly userId: string;
  readonly holdRef: string;
  readonly eventType: RetentionHoldEventType;
  readonly reasonCode: string;
  readonly responsibleRef: string;
  readonly evidenceRef: string;
  readonly occurredAt: string;
  readonly reviewAt: string;
  readonly expiresAt: string;
}
export interface RetentionHoldRepository {
  record(event: RetentionHoldEvent): Promise<RetentionHoldEvent>;
  listForHold(
    userId: string,
    holdRef: string,
  ): Promise<readonly RetentionHoldEvent[]>;
}

export interface HealthDataDeletionDeadlines {
  readonly activeSystemsBy: string;
  readonly backupsBy: string;
}

const utcTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function calculateHealthDataDeletionDeadlines(
  revocationOrDeletionAt: string,
): HealthDataDeletionDeadlines | null {
  if (!utcTimestamp.test(revocationOrDeletionAt)) return null;
  const anchor = Date.parse(revocationOrDeletionAt);
  if (
    !Number.isFinite(anchor) ||
    new Date(anchor).toISOString() !== revocationOrDeletionAt
  )
    return null;
  const day = 24 * 60 * 60 * 1000;
  return {
    activeSystemsBy: new Date(anchor + 30 * day).toISOString(),
    backupsBy: new Date(anchor + 90 * day).toISOString(),
  };
}

export function isRetentionHoldActive(
  events: readonly RetentionHoldEvent[],
  holdRef: string,
  evaluatedAt = new Date().toISOString(),
): boolean {
  const matching = events
    .filter(({ holdRef: value }) => value === holdRef)
    .sort((left, right) => {
      const byTime = Date.parse(left.occurredAt) - Date.parse(right.occurredAt);
      return byTime || left.id.localeCompare(right.id);
    });
  const latest = matching.at(-1);
  return (
    latest?.eventType === 'applied' &&
    Number.isFinite(Date.parse(evaluatedAt)) &&
    Date.parse(latest.reviewAt) > Date.parse(latest.occurredAt) &&
    Date.parse(latest.expiresAt) > Date.parse(latest.reviewAt) &&
    Date.parse(latest.expiresAt) > Date.parse(evaluatedAt)
  );
}
