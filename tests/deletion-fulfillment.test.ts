import { describe, expect, it, vi } from 'vitest';
import {
  runDeletionFulfillment,
  runAndRecordDeletionFulfillment,
  type DeletionTargetPort,
  type PrivacyRequest,
} from '../packages/domain/src/index';

const request: PrivacyRequest = {
  id: 'dsr_syntheticdeletion01',
  userId: 'usr_syntheticconsumer001',
  kind: 'deletion',
  scope: 'all_user_data',
  status: 'in_review',
  version: 2,
  requestedAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};
const target = (
  targetId: string,
  targetClass: DeletionTargetPort['targetClass'],
  outcome: 'deleted' | 'retained' = 'deleted',
): DeletionTargetPort => ({
  targetId,
  targetClass,
  fulfill: vi.fn().mockResolvedValue({
    targetId,
    targetClass,
    outcome,
    reasonCode:
      outcome === 'deleted' ? 'deletion_confirmed' : 'legal_hold_documented',
    evidenceRef: `evidence-${targetId}`,
    recordedAt: '2026-01-02T01:00:00.000Z',
  }),
});

describe('deletion fulfillment boundary', () => {
  it('collects evidence across canonical, projection, vendor and backup targets', async () => {
    const targets = [
      target('canonical_records', 'canonical'),
      target('timeline_projection', 'projection'),
      target('synthetic_vendor', 'vendor'),
      target('backup_lifecycle', 'backup', 'retained'),
    ];
    await expect(
      runDeletionFulfillment(request, targets),
    ).resolves.toMatchObject({
      privacyRequestId: request.id,
      complete: true,
      receipts: [
        { targetClass: 'canonical', outcome: 'deleted' },
        { targetClass: 'projection', outcome: 'deleted' },
        { targetClass: 'vendor', outcome: 'deleted' },
        { targetClass: 'backup', outcome: 'retained' },
      ],
    });
    expect(targets[0]!.fulfill).toHaveBeenCalledWith({
      privacyRequestId: request.id,
      userId: request.userId,
    });
  });

  it('keeps the request incomplete for a retained target without a documented legal hold', async () => {
    const retained: DeletionTargetPort = {
      ...target('backup_lifecycle', 'backup', 'retained'),
      fulfill: vi.fn().mockResolvedValue({
        targetId: 'backup_lifecycle',
        targetClass: 'backup',
        outcome: 'retained',
        reasonCode: 'retention_pending',
        evidenceRef: 'evidence-backup',
        recordedAt: '2026-01-02T01:00:00.000Z',
      }),
    };
    await expect(
      runDeletionFulfillment(request, [retained]),
    ).resolves.toMatchObject({
      complete: false,
      receipts: [{ outcome: 'retained', reasonCode: 'retention_pending' }],
    });
  });

  it('converts adapter exceptions to a safe failure code', async () => {
    const failing: DeletionTargetPort = {
      targetId: 'synthetic_vendor',
      targetClass: 'vendor',
      fulfill: vi.fn().mockRejectedValue(new Error('secret vendor response')),
    };
    const report = await runDeletionFulfillment(request, [failing]);
    expect(report).toMatchObject({
      complete: false,
      receipts: [{ outcome: 'failed', reasonCode: 'adapter_failure' }],
    });
    expect(JSON.stringify(report)).not.toContain('secret vendor response');
  });

  it('persists every safe receipt before returning the report', async () => {
    const records: unknown[] = [];
    const report = await runAndRecordDeletionFulfillment(
      request,
      [target('canonical_records', 'canonical')],
      { record: async (value) => (records.push(value), value) },
      () => 'drc_syntheticrecorded001',
    );
    expect(report.complete).toBe(true);
    expect(records).toEqual([
      expect.objectContaining({
        id: 'drc_syntheticrecorded001',
        privacyRequestId: request.id,
        userId: request.userId,
        targetId: 'canonical_records',
      }),
    ]);
  });

  it('rejects an ineligible request or ambiguous target plan', async () => {
    await expect(
      runDeletionFulfillment({ ...request, kind: 'export' }, [
        target('canonical_records', 'canonical'),
      ]),
    ).rejects.toThrow('not eligible');
    const duplicate = target('same_target', 'vendor');
    await expect(
      runDeletionFulfillment(request, [duplicate, duplicate]),
    ).rejects.toThrow('Invalid deletion target plan');
  });
});
