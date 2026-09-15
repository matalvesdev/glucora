import type {
  PrivacyRequest,
  PrivacyRequestRepository,
  TransitionPrivacyRequest,
} from './privacy-request';
import {
  isRetentionHoldActive,
  type RetentionHoldRepository,
} from './retention-governance';

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
  readonly legalHoldRef: string | null;
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
  listForRequest(
    privacyRequestId: string,
    userId: string,
  ): Promise<readonly PersistedDeletionTargetReceipt[]>;
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
const requiredDeletionTargetClasses: readonly DeletionTargetClass[] = [
  'canonical',
  'projection',
  'vendor',
  'backup',
];

function hasRequiredDeletionTargetClasses(
  targets: readonly Pick<DeletionTargetPort, 'targetClass'>[],
): boolean {
  const classes = new Set(targets.map(({ targetClass }) => targetClass));
  return requiredDeletionTargetClasses.every((targetClass) =>
    classes.has(targetClass),
  );
}

function validReceipt(
  port: Pick<DeletionTargetPort, 'targetId' | 'targetClass'>,
  receipt: DeletionTargetReceipt,
): boolean {
  return (
    receipt.targetId === port.targetId &&
    receipt.targetClass === port.targetClass &&
    reasonCodePattern.test(receipt.reasonCode) &&
    Number.isFinite(Date.parse(receipt.recordedAt)) &&
    (receipt.outcome === 'failed' || Boolean(receipt.evidenceRef?.trim())) &&
    (receipt.outcome === 'retained'
      ? receipt.reasonCode === 'legal_hold_documented' &&
        Boolean(receipt.legalHoldRef?.trim())
      : receipt.legalHoldRef === null)
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
              legalHoldRef: null,
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
        legalHoldRef: null,
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

export async function runRetentionAwareDeletionFulfillment(
  request: PrivacyRequest,
  targets: readonly DeletionTargetPort[],
  holds: RetentionHoldRepository,
  evaluatedAt: string,
): Promise<DeletionFulfillmentReport> {
  const report = await runDeletionFulfillment(request, targets);
  const retained = await Promise.all(
    report.receipts.map(async (receipt) => {
      if (receipt.outcome !== 'retained' || !receipt.legalHoldRef) return false;
      const events = await holds.listForHold(
        request.userId,
        receipt.legalHoldRef,
      );
      return (
        events.every(
          (event) =>
            event.userId === request.userId &&
            event.reasonCode === 'legal_hold_documented',
        ) && isRetentionHoldActive(events, receipt.legalHoldRef, evaluatedAt)
      );
    }),
  );
  return {
    ...report,
    complete: report.receipts.every(
      (receipt, index) => receipt.outcome === 'deleted' || retained[index],
    ),
  };
}

export async function reconcilePersistedDeletionFulfillment(
  request: PrivacyRequest,
  targets: readonly Pick<DeletionTargetPort, 'targetId' | 'targetClass'>[],
  persisted: readonly PersistedDeletionTargetReceipt[],
  holds: RetentionHoldRepository,
  evaluatedAt: string,
): Promise<DeletionFulfillmentReport> {
  if (request.kind !== 'deletion' || request.status !== 'in_review')
    throw new Error('Deletion request is not eligible for fulfillment');
  if (
    targets.length === 0 ||
    new Set(targets.map(({ targetId }) => targetId)).size !== targets.length ||
    !hasRequiredDeletionTargetClasses(targets)
  )
    throw new Error('Invalid deletion target plan');
  const receipts = targets.map((target) => {
    const matching = persisted
      .filter(
        (receipt) =>
          receipt.privacyRequestId === request.id &&
          receipt.userId === request.userId &&
          receipt.targetId === target.targetId &&
          receipt.targetClass === target.targetClass,
      )
      .sort(
        (left, right) =>
          Date.parse(right.recordedAt) - Date.parse(left.recordedAt) ||
          right.id.localeCompare(left.id),
      );
    const latest = matching[0];
    return latest && validReceipt(target, latest) ? latest : null;
  });
  const retained = await Promise.all(
    receipts.map(async (receipt) => {
      if (!receipt || receipt.outcome !== 'retained' || !receipt.legalHoldRef)
        return false;
      const events = await holds.listForHold(
        request.userId,
        receipt.legalHoldRef,
      );
      return (
        events.every(
          (event) =>
            event.userId === request.userId &&
            event.reasonCode === 'legal_hold_documented',
        ) && isRetentionHoldActive(events, receipt.legalHoldRef, evaluatedAt)
      );
    }),
  );
  return {
    privacyRequestId: request.id,
    complete: receipts.every(
      (receipt, index) =>
        Boolean(receipt) && (receipt!.outcome === 'deleted' || retained[index]),
    ),
    receipts: receipts.filter(
      (receipt): receipt is PersistedDeletionTargetReceipt => receipt !== null,
    ),
  };
}

export function buildVerifiedDeletionTransition(input: {
  readonly request: PrivacyRequest;
  readonly report: DeletionFulfillmentReport;
  readonly eventId: string;
  readonly auditId: string;
  readonly auditRequestId: string;
  readonly retentionPolicyRef: string;
  readonly occurredAt: string;
}): TransitionPrivacyRequest {
  if (
    input.request.kind !== 'deletion' ||
    input.request.status !== 'in_review' ||
    !input.report.complete ||
    input.report.privacyRequestId !== input.request.id ||
    !hasRequiredDeletionTargetClasses(input.report.receipts)
  )
    throw new Error('Deletion fulfillment is not eligible for transition');
  return {
    requestId: input.request.id,
    userId: input.request.userId,
    expectedVersion: input.request.version,
    event: {
      id: input.eventId,
      requestId: input.request.id,
      userId: input.request.userId,
      fromStatus: 'in_review',
      toStatus: 'fulfilled',
      reasonCode: 'deletion_fulfillment_verified',
      occurredAt: input.occurredAt,
    },
    audit: {
      id: input.auditId,
      requestId: input.auditRequestId,
      retentionPolicyRef: input.retentionPolicyRef,
      occurredAt: input.occurredAt,
      actorType: 'system',
      actorId: null,
    },
  };
}

export async function finalizeVerifiedDeletion(input: {
  readonly request: PrivacyRequest;
  readonly targets: readonly Pick<
    DeletionTargetPort,
    'targetId' | 'targetClass'
  >[];
  readonly receipts: DeletionTargetReceiptRepository;
  readonly holds: RetentionHoldRepository;
  readonly requests: PrivacyRequestRepository;
  readonly eventId: string;
  readonly auditId: string;
  readonly auditRequestId: string;
  readonly retentionPolicyRef: string;
  readonly occurredAt: string;
}): Promise<PrivacyRequest> {
  const report = await reconcilePersistedDeletionFulfillment(
    input.request,
    input.targets,
    await input.receipts.listForRequest(input.request.id, input.request.userId),
    input.holds,
    input.occurredAt,
  );
  return input.requests.transition(
    buildVerifiedDeletionTransition({ ...input, report }),
  );
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
