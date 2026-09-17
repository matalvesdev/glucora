import { describe, expect, it, vi } from 'vitest';
import {
  AiCapabilityRegistry,
  validateAiCapabilityDefinition,
  type AiCapability,
  type AiExecutionContext,
  type ModelGateway,
} from '../packages/domain/src/index';
import { executeAiCapability } from '../services/api/src/modules/ai/execute-capability';
type Output = { summary: string; limitations: string[] };
const capability: AiCapability<Output> = {
  id: 'timeline_summary',
  intendedUse: 'Synthetic descriptive summary',
  risk: 'R1',
  bundleVersion: 'bundle-test-1',
  owner: 'synthetic-owner',
  requiredCorpus: 'corpus-test-1',
  minimumEvidence: 1,
  allowedTools: [],
  validateOutput: (value): value is Output =>
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Output).summary === 'string' &&
    Array.isArray((value as Output).limitations),
  guardOutput: (value) => !/(diagnos|dose|insulin)/i.test(value.summary),
  fallback: (reason) => ({
    summary: 'Resumo indisponível.',
    limitations: [reason],
  }),
};
const auth = {
  actor: { id: 'usr_syntheticconsumer001', kind: 'consumer' as const },
  account: {
    id: 'usr_syntheticconsumer001',
    status: 'active' as const,
    locale: 'pt-BR',
    timezone: 'America/Sao_Paulo',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  subjectUserId: 'usr_syntheticconsumer001',
  purpose: {
    id: 'pur_syntheticai0000001',
    status: 'published' as const,
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    retiredAt: null,
  },
  currentConsent: {
    id: 'cne_syntheticai0000001',
    userId: 'usr_syntheticconsumer001',
    purposeVersionId: 'pur_syntheticai0000001',
    decision: 'granted' as const,
    channel: 'synthetic',
    idempotencyKey: 'test',
    occurredAt: '2026-01-01T00:00:00.000Z',
    recordedAt: '2026-01-01T00:00:00.000Z',
  },
  evaluatedAt: '2026-01-02T00:00:00.000Z',
};
const execution: AiExecutionContext = {
  authorization: auth,
  context: [
    {
      id: 'tli_syntheticitem0001',
      factClass: 'declaration',
      provenanceId: 'prv_syntheticorigin001',
    },
  ],
  evidence: [
    {
      id: 'evd_syntheticevidence001',
      corpusVersion: 'corpus-test-1',
      authorityTier: 'synthetic',
    },
  ],
};
const registry = () => {
  const value = new AiCapabilityRegistry();
  value.register(capability);
  return value;
};
const gateway = (output: unknown): ModelGateway => ({
  health: vi.fn().mockResolvedValue('available'),
  generateStructured: vi.fn().mockResolvedValue({
    output,
    providerRef: 'provider-test',
    modelRef: 'model-test',
    usageUnits: 1,
  }),
});
describe('AI runtime safety pipeline', () => {
  it('rejects malformed capability definitions before registry activation', () => {
    expect(validateAiCapabilityDefinition(capability)).toEqual([]);
    expect(
      validateAiCapabilityDefinition({
        ...capability,
        id: 'invalid id',
        minimumEvidence: -1,
        allowedTools: ['safe_tool', 'safe_tool'],
      }),
    ).toEqual(
      expect.arrayContaining([
        'invalid_capability_id',
        'invalid_minimum_evidence',
        'invalid_allowed_tools',
      ]),
    );
    expect(() =>
      new AiCapabilityRegistry().register({ ...capability, owner: '' }),
    ).toThrow('Invalid AI capability');
  });

  it('returns structured output with minimal trace metadata', async () =>
    expect(
      executeAiCapability({
        capabilityId: capability.id,
        registry: registry(),
        gateway: gateway({
          summary: 'Há registros no período.',
          limitations: ['Descritivo.'],
        }),
        execution,
      }),
    ).resolves.toMatchObject({
      status: 'completed',
      trace: { evidenceIds: ['evd_syntheticevidence001'] },
    }));
  it.each([
    [
      {
        execution: {
          ...execution,
          authorization: { ...auth, currentConsent: null },
        },
      },
      'access_denied',
    ],
    [{ execution: { ...execution, evidence: [] } }, 'insufficient_evidence'],
    [{ gateway: gateway({ text: 'wrong' }) }, 'invalid_output'],
    [
      {
        gateway: gateway({
          summary: 'Ajuste a dose de insulina.',
          limitations: [],
        }),
      },
      'guard_blocked',
    ],
  ])(
    'abstains safely for invalid execution conditions',
    async (override, reason) =>
      expect(
        executeAiCapability({
          capabilityId: capability.id,
          registry: registry(),
          gateway: gateway({ summary: 'ok', limitations: [] }),
          execution,
          ...override,
        } as Parameters<typeof executeAiCapability>[0]),
      ).resolves.toMatchObject({ status: 'abstained', reason }),
  );
  it('never automates R2 or higher', async () => {
    const high = { ...capability, id: 'high_risk', risk: 'R3' as const };
    const value = registry();
    value.register(high);
    expect(
      await executeAiCapability({
        capabilityId: high.id,
        registry: value,
        gateway: gateway({ summary: 'ok', limitations: [] }),
        execution,
      }),
    ).toMatchObject({ status: 'abstained', reason: 'risk_not_automatable' });
  });
});
