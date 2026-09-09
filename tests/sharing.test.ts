import { describe, expect, it } from 'vitest';
import {
  authorizeShareAccess,
  type ShareGrant,
} from '../packages/domain/src/index';
const grant: ShareGrant = {
  id: 'shr_syntheticgrant00001',
  ownerUserId: 'usr_syntheticconsumer001',
  recipientRef: 'rcp_syntheticrecipient01',
  resourceType: 'consultation_report',
  resourceId: 'rpt_syntheticreport0001',
  purposeVersionId: 'pur_syntheticsharing001',
  status: 'active',
  version: 1,
  grantedAt: '2026-01-01T00:00:00.000Z',
  expiresAt: '2026-01-08T00:00:00.000Z',
  revokedAt: null,
};
const request = {
  grant,
  recipientRef: grant.recipientRef,
  resourceType: grant.resourceType,
  resourceId: grant.resourceId,
  purposeVersionId: grant.purposeVersionId,
  evaluatedAt: '2026-01-02T00:00:00.000Z',
};
describe('share authorization', () => {
  it('allows only the exact active grant context', () =>
    expect(authorizeShareAccess(request)).toEqual({ allowed: true }));
  it.each([
    [{ recipientRef: 'rcp_anotherrecipient0001' }, 'grant_mismatch'],
    [{ resourceId: 'rpt_anotherreport000001' }, 'grant_mismatch'],
    [{ purposeVersionId: 'pur_anotherpurpose00001' }, 'purpose_mismatch'],
    [
      {
        grant: {
          ...grant,
          status: 'revoked',
          revokedAt: '2026-01-02T00:00:00.000Z',
        },
      },
      'grant_inactive',
    ],
    [{ evaluatedAt: grant.expiresAt }, 'grant_expired'],
  ])('denies mismatched or inactive access', (override, reason) =>
    expect(
      authorizeShareAccess({ ...request, ...override } as typeof request),
    ).toEqual({ allowed: false, reason }),
  );
});
