export interface AuthenticatedActor {
  readonly id: string;
  readonly kind: 'consumer';
}

export interface IdentityPort<RequestContext> {
  authenticate(context: RequestContext): Promise<AuthenticatedActor | null>;
}

export interface UserAccount {
  readonly id: string;
  readonly status: 'active' | 'disabled';
  readonly locale: string;
  readonly timezone: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface UserAccountRepository {
  findById(id: string): Promise<UserAccount | null>;
}

export type ConsentDecision = 'granted' | 'denied' | 'revoked';

export interface ConsentEvent {
  readonly id: string;
  readonly userId: string;
  readonly purposeVersionId: string;
  readonly decision: ConsentDecision;
  readonly channel: string;
  readonly idempotencyKey: string;
  readonly occurredAt: string;
  readonly recordedAt: string;
}

export interface RecordConsentDecision {
  readonly id: string;
  readonly userId: string;
  readonly purposeVersionId: string;
  readonly decision: ConsentDecision;
  readonly channel: string;
  readonly idempotencyKey: string;
  readonly occurredAt: string;
}

export interface ConsentRepository {
  record(input: RecordConsentDecision): Promise<ConsentEvent>;
  history(userId: string, purposeVersionId: string): Promise<ConsentEvent[]>;
}
