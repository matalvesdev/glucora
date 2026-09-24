export type ConsultationQuestionKey =
  'review_records' | 'discuss_routine' | 'clarify_next_steps';
export type ConsultationQuestionAction = 'added' | 'removed';
export interface ConsultationQuestionEvent {
  readonly id: string;
  readonly reportId: string;
  readonly userId: string;
  readonly questionKey: ConsultationQuestionKey;
  readonly action: ConsultationQuestionAction;
  readonly version: number;
  readonly occurredAt: string;
}
export interface RecordConsultationQuestionEvent {
  readonly event: ConsultationQuestionEvent;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly audit: {
    readonly id: string;
    readonly requestId: string;
    readonly retentionPolicyRef: string;
    readonly occurredAt: string;
  };
}
export interface ConsultationQuestionRepository {
  record(
    input: RecordConsultationQuestionEvent,
  ): Promise<ConsultationQuestionEvent>;
  listSelected(
    reportId: string,
    userId: string,
  ): Promise<readonly ConsultationQuestionEvent[]>;
}
