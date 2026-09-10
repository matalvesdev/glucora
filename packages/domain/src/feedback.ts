export type ContestationReason =
  'inaccurate' | 'unsafe' | 'irrelevant' | 'missing_context' | 'unclear';
export interface OutputContestation {
  readonly id: string;
  readonly userId: string;
  readonly resourceType: 'ai_output' | 'consultation_report';
  readonly resourceId: string;
  readonly resourceVersion: string;
  readonly reason: ContestationReason;
  readonly status: 'open';
  readonly occurredAt: string;
}
export interface OutputContestationRepository {
  record(
    value: OutputContestation,
    audit: {
      readonly id: string;
      readonly requestId: string;
      readonly retentionPolicyRef: string;
      readonly occurredAt: string;
    },
  ): Promise<OutputContestation>;
  listOpen(
    userId: string,
    resourceType: OutputContestation['resourceType'],
    resourceIds: readonly string[],
  ): Promise<readonly OutputContestation[]>;
}

export function excludeContestedResourceIds<T extends { readonly id: string }>(
  items: readonly T[],
  contestations: readonly OutputContestation[],
): readonly T[] {
  const blocked = new Set(
    contestations
      .filter(({ status }) => status === 'open')
      .map(({ resourceId }) => resourceId),
  );
  return items.filter(({ id }) => !blocked.has(id));
}
