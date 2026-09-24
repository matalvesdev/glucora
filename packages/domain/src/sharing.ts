export interface ShareGrant {
  readonly id: string;
  readonly ownerUserId: string;
  readonly recipientRef: string;
  readonly resourceType: 'consultation_report';
  readonly resourceId: string;
  readonly purposeVersionId: string;
  readonly status: 'active' | 'revoked';
  readonly version: number;
  readonly grantedAt: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
}

export type ShareAccessDecision =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly reason:
        | 'grant_mismatch'
        | 'grant_inactive'
        | 'grant_expired'
        | 'purpose_mismatch';
    };

export function authorizeShareAccess(input: {
  readonly grant: ShareGrant | null;
  readonly recipientRef: string;
  readonly resourceType: ShareGrant['resourceType'];
  readonly resourceId: string;
  readonly purposeVersionId: string;
  readonly evaluatedAt: string;
}): ShareAccessDecision {
  const grant = input.grant;
  if (
    !grant ||
    grant.recipientRef !== input.recipientRef ||
    grant.resourceType !== input.resourceType ||
    grant.resourceId !== input.resourceId
  )
    return { allowed: false, reason: 'grant_mismatch' };
  if (grant.purposeVersionId !== input.purposeVersionId)
    return { allowed: false, reason: 'purpose_mismatch' };
  if (grant.status !== 'active')
    return { allowed: false, reason: 'grant_inactive' };
  const evaluated = Date.parse(input.evaluatedAt),
    expires = Date.parse(grant.expiresAt),
    granted = Date.parse(grant.grantedAt);
  if (
    !Number.isFinite(evaluated) ||
    !Number.isFinite(expires) ||
    !Number.isFinite(granted) ||
    evaluated < granted ||
    evaluated >= expires
  )
    return { allowed: false, reason: 'grant_expired' };
  return { allowed: true };
}

export interface ShareGrantRepository {
  create(grant: ShareGrant, audit: ShareAudit): Promise<ShareGrant>;
  revoke(
    id: string,
    ownerUserId: string,
    expectedVersion: number,
    revokedAt: string,
    audit: ShareAudit,
  ): Promise<ShareGrant>;
  findById(id: string, ownerUserId: string): Promise<ShareGrant | null>;
  listOwn(
    ownerUserId: string,
    input?: { readonly limit: number; readonly before?: string },
  ): Promise<ShareGrant[]>;
}
export interface ShareAudit {
  readonly id: string;
  readonly requestId: string;
  readonly retentionPolicyRef: string;
  readonly occurredAt: string;
}
