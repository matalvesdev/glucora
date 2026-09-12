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
