import type { PrivacyRequest } from './privacy-request';

export type DeletionTargetClass =
  'canonical' | 'projection' | 'vendor' | 'backup';
export type DeletionTargetOutcome =
  'deleted' | 'retained' | 'pending' | 'failed';

export interface DeletionTargetReceipt {
  readonly targetId: string;
  readonly targetClass: DeletionTargetClass;
  readonly outcome: DeletionTargetOutcome;
  readonly reasonCode: string;
  readonly evidenceRef: string | null;
  readonly recordedAt: string;
}

export interface PersistedDeletionTargetReceipt extends DeletionTargetReceipt {
  readonly id: string;
  readonly privacyRequestId: string;
  readonly userId: string;
}

export interface DeletionTargetReceiptRepository {
  record(
    input: PersistedDeletionTargetReceipt,
  ): Promise<PersistedDeletionTargetReceipt>;
}

export interface DeletionTargetPort {
  readonly targetId: string;
  readonly targetClass: DeletionTargetClass;
  fulfill(input: {
    readonly privacyRequestId: string;
    readonly userId: string;
  }): Promise<DeletionTargetReceipt>;
}

export interface DeletionFulfillmentReport {
  readonly privacyRequestId: string;
  readonly complete: boolean;
  readonly receipts: readonly DeletionTargetReceipt[];
}

const reasonCodePattern = /^[a-z][a-z0-9_]{2,63}$/;

function validReceipt(
  port: DeletionTargetPort,
  receipt: DeletionTargetReceipt,
): boolean {
  return (
    receipt.targetId === port.targetId &&
    receipt.targetClass === port.targetClass &&
    reasonCodePattern.test(receipt.reasonCode) &&
    Number.isFinite(Date.parse(receipt.recordedAt)) &&
    (receipt.outcome === 'failed' || Boolean(receipt.evidenceRef?.trim()))
  );
}

export async function runDeletionFulfillment(
  request: PrivacyRequest,
  targets: readonly DeletionTargetPort[],
): Promise<DeletionFulfillmentReport> {
  if (request.kind !== 'deletion' || request.status !== 'in_review')
    throw new Error('Deletion request is not eligible for fulfillment');
  if (
    targets.length === 0 ||
    new Set(targets.map(({ targetId }) => targetId)).size !== targets.length
  )
    throw new Error('Invalid deletion target plan');

  const receipts: DeletionTargetReceipt[] = [];
  for (const target of targets) {
    try {
      const receipt = await target.fulfill({
        privacyRequestId: request.id,
        userId: request.userId,
      });
      receipts.push(
        validReceipt(target, receipt)
          ? receipt
          : {
              targetId: target.targetId,
              targetClass: target.targetClass,
              outcome: 'failed',
              reasonCode: 'invalid_adapter_receipt',
              evidenceRef: null,
              recordedAt: request.updatedAt,
            },
      );
    } catch {
      receipts.push({
        targetId: target.targetId,
        targetClass: target.targetClass,
        outcome: 'failed',
        reasonCode: 'adapter_failure',
        evidenceRef: null,
        recordedAt: request.updatedAt,
      });
    }
  }
  return {
    privacyRequestId: request.id,
    // A retained target requires lookup of its separate legal-hold ledger.
    // Until an executor performs that lookup, fail closed and keep the request open.
    complete: receipts.every(({ outcome }) => outcome === 'deleted'),
    receipts,
  };
}

export async function runAndRecordDeletionFulfillment(
  request: PrivacyRequest,
  targets: readonly DeletionTargetPort[],
  receipts: DeletionTargetReceiptRepository,
  newReceiptId: () => string,
): Promise<DeletionFulfillmentReport> {
  const report = await runDeletionFulfillment(request, targets);
  for (const receipt of report.receipts) {
    await receipts.record({
      id: newReceiptId(),
      privacyRequestId: request.id,
      userId: request.userId,
      ...receipt,
    });
  }
  return report;
}
