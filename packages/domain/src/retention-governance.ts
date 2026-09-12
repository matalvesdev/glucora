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
}
export interface RetentionHoldRepository {
  record(event: RetentionHoldEvent): Promise<RetentionHoldEvent>;
}

export function isRetentionHoldActive(
  events: readonly RetentionHoldEvent[],
  holdRef: string,
): boolean {
  const matching = events
    .filter(({ holdRef: value }) => value === holdRef)
    .sort((left, right) => {
      const byTime = Date.parse(left.occurredAt) - Date.parse(right.occurredAt);
      return byTime || left.id.localeCompare(right.id);
    });
  return matching.at(-1)?.eventType === 'applied';
}
