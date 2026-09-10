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

export interface ConsentPurposeVersion {
  readonly id: string;
  readonly status: 'draft' | 'published' | 'retired';
  readonly effectiveFrom: string | null;
  readonly retiredAt: string | null;
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
  current(
    userId: string,
    purposeVersionId: string,
  ): Promise<ConsentEvent | null>;
}

export type AuthorizationDenialReason =
  | 'unauthenticated'
  | 'account_inactive'
  | 'subject_mismatch'
  | 'purpose_unavailable'
  | 'consent_required';

export type AuthorizationDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: AuthorizationDenialReason };

export interface ConsumerCapabilityContext {
  readonly actor: AuthenticatedActor | null;
  readonly account: UserAccount | null;
  readonly subjectUserId: string;
  readonly purpose: ConsentPurposeVersion | null;
  readonly currentConsent: ConsentEvent | null;
  readonly evaluatedAt: string;
}

export function authorizeConsumerCapability(
  context: ConsumerCapabilityContext,
): AuthorizationDecision {
  if (!context.actor) return { allowed: false, reason: 'unauthenticated' };
  if (!context.account || context.account.status !== 'active')
    return { allowed: false, reason: 'account_inactive' };
  if (
    context.actor.id !== context.account.id ||
    context.actor.id !== context.subjectUserId
  )
    return { allowed: false, reason: 'subject_mismatch' };
  const purpose = context.purpose;
  const evaluatedAt = Date.parse(context.evaluatedAt);
  const effectiveFrom = purpose?.effectiveFrom
    ? Date.parse(purpose.effectiveFrom)
    : Number.NaN;
  const retiredAt = purpose?.retiredAt ? Date.parse(purpose.retiredAt) : null;
  if (
    !purpose ||
    purpose.status !== 'published' ||
    !purpose.effectiveFrom ||
    !Number.isFinite(evaluatedAt) ||
    !Number.isFinite(effectiveFrom) ||
    effectiveFrom > evaluatedAt ||
    (retiredAt !== null &&
      (!Number.isFinite(retiredAt) || retiredAt <= evaluatedAt))
  )
    return { allowed: false, reason: 'purpose_unavailable' };
  const consentOccurredAt = context.currentConsent
    ? Date.parse(context.currentConsent.occurredAt)
    : Number.NaN;
  if (
    !context.currentConsent ||
    context.currentConsent.userId !== context.subjectUserId ||
    context.currentConsent.purposeVersionId !== purpose.id ||
    context.currentConsent.decision !== 'granted' ||
    !Number.isFinite(consentOccurredAt) ||
    consentOccurredAt > evaluatedAt
  )
    return { allowed: false, reason: 'consent_required' };
  return { allowed: true };
}

export type AuditActorType = 'consumer' | 'system';
export type AuditOutcome = 'succeeded' | 'denied' | 'failed';

export interface AuditEvent {
  readonly id: string;
  readonly eventKey: string;
  readonly actorType: AuditActorType;
  readonly actorId: string | null;
  readonly subjectId: string | null;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly action: string;
  readonly outcome: AuditOutcome;
  readonly requestId: string | null;
  readonly retentionPolicyRef: string;
  readonly occurredAt: string;
  readonly recordedAt: string;
}

export type RecordAuditEvent = Omit<AuditEvent, 'recordedAt'>;

export interface AuditRepository {
  record(input: RecordAuditEvent): Promise<AuditEvent>;
  historyForResource(
    resourceType: string,
    resourceId: string,
  ): Promise<AuditEvent[]>;
}

export * from './observation';
export * from './context-event';
export * from './timeline';
export * from './consultation';
export * from './privacy-request';
export * from './sharing';
export * from './ai';
export * from './feedback';
