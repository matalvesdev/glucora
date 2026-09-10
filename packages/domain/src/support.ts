export type SupportRequestCategory =
  | 'account_access'
  | 'privacy_rights'
  | 'data_quality'
  | 'sharing'
  | 'unsafe_output'
  | 'technical_issue';

export interface SupportRequest {
  readonly id: string;
  readonly userId: string;
  readonly category: SupportRequestCategory;
  readonly status: 'submitted';
  readonly createdAt: string;
}

export interface CreateSupportRequest {
  readonly request: SupportRequest;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly audit: {
    readonly id: string;
    readonly requestId: string;
    readonly retentionPolicyRef: string;
    readonly occurredAt: string;
  };
}

export interface SupportRequestRepository {
  create(input: CreateSupportRequest): Promise<SupportRequest>;
  listOwn(
    userId: string,
    page: {
      readonly limit: number;
      readonly before?: {
        readonly createdAt: string;
        readonly requestId: string;
      };
    },
  ): Promise<readonly SupportRequest[]>;
}
