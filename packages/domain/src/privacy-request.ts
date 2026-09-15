export type PrivacyRequestKind = 'access' | 'export' | 'deletion';
export type PrivacyRequestStatus =
  | 'requested'
  | 'identity_verification_required'
  | 'in_review'
  | 'fulfilled'
  | 'partially_fulfilled'
  | 'denied'
  | 'cancelled';

export interface PrivacyRequest {
  readonly id: string;
  readonly userId: string;
  readonly kind: PrivacyRequestKind;
  readonly scope: 'all_user_data';
  readonly status: PrivacyRequestStatus;
  readonly version: number;
  readonly requestedAt: string;
  readonly updatedAt: string;
}

export interface PrivacyRequestEvent {
  readonly id: string;
  readonly requestId: string;
  readonly userId: string;
  readonly fromStatus: PrivacyRequestStatus | null;
  readonly toStatus: PrivacyRequestStatus;
  readonly reasonCode: string;
  readonly occurredAt: string;
}

const transitions: Readonly<
  Record<PrivacyRequestStatus, readonly PrivacyRequestStatus[]>
> = {
  requested: ['identity_verification_required', 'in_review', 'cancelled'],
  identity_verification_required: ['in_review', 'denied', 'cancelled'],
  in_review: ['fulfilled', 'partially_fulfilled', 'denied', 'cancelled'],
  fulfilled: [],
  partially_fulfilled: [],
  denied: [],
  cancelled: [],
};

export function canTransitionPrivacyRequest(
  from: PrivacyRequestStatus,
  to: PrivacyRequestStatus,
): boolean {
  return transitions[from].includes(to);
}

export interface CreatePrivacyRequest {
  readonly request: PrivacyRequest;
  readonly event: PrivacyRequestEvent;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly audit: {
    readonly id: string;
    readonly requestId: string;
    readonly retentionPolicyRef: string;
    readonly occurredAt: string;
  };
}

export interface TransitionPrivacyRequest {
  readonly requestId: string;
  readonly userId: string;
  readonly expectedVersion: number;
  readonly event: PrivacyRequestEvent;
  readonly audit: {
    readonly id: string;
    readonly requestId: string;
    readonly retentionPolicyRef: string;
    readonly occurredAt: string;
    readonly actorType?: 'consumer' | 'system';
    readonly actorId?: string | null;
  };
}

export interface PrivacyRequestRepository {
  create(input: CreatePrivacyRequest): Promise<PrivacyRequest>;
  transition(input: TransitionPrivacyRequest): Promise<PrivacyRequest>;
  findById(id: string, userId: string): Promise<PrivacyRequest | null>;
  history(id: string, userId: string): Promise<readonly PrivacyRequestEvent[]>;
  listOwn(
    userId: string,
    page: {
      readonly limit: number;
      readonly before?: {
        readonly requestedAt: string;
        readonly requestId: string;
      };
    },
  ): Promise<readonly PrivacyRequest[]>;
}
