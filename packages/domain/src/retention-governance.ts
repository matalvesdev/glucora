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
