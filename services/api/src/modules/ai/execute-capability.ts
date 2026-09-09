import {
  authorizeConsumerCapability,
  type AiAbstentionReason,
  type AiCapabilityRegistry,
  type AiExecutionContext,
  type ModelGateway,
} from '@glucora/domain';

export type AiExecutionResult =
  | {
      readonly status: 'completed';
      readonly output: unknown;
      readonly trace: {
        readonly capabilityId: string;
        readonly bundleVersion: string;
        readonly providerRef: string;
        readonly modelRef: string;
        readonly usageUnits: number;
        readonly evidenceIds: readonly string[];
      };
    }
  | {
      readonly status: 'abstained';
      readonly reason: AiAbstentionReason;
      readonly output: unknown;
    };

export async function executeAiCapability(input: {
  readonly capabilityId: string;
  readonly registry: AiCapabilityRegistry;
  readonly gateway: ModelGateway;
  readonly execution: AiExecutionContext;
}): Promise<AiExecutionResult> {
  const capability = input.registry.get(input.capabilityId);
  if (!capability)
    return {
      status: 'abstained',
      reason: 'capability_unavailable',
      output: null,
    };
  const abstain = (reason: AiAbstentionReason): AiExecutionResult => ({
    status: 'abstained',
    reason,
    output: capability.fallback(reason),
  });
  if (!['R0', 'R1'].includes(capability.risk))
    return abstain('risk_not_automatable');
  if (!authorizeConsumerCapability(input.execution.authorization).allowed)
    return abstain('access_denied');
  const evidence = input.execution.evidence;
  if (
    evidence.length < capability.minimumEvidence ||
    (capability.requiredCorpus !== null &&
      evidence.some((item) => item.corpusVersion !== capability.requiredCorpus))
  )
    return abstain('insufficient_evidence');
  if ((await input.gateway.health()) !== 'available')
    return abstain('model_unavailable');
  let generated;
  try {
    generated = await input.gateway.generateStructured({
      capabilityId: capability.id,
      bundleVersion: capability.bundleVersion,
      context: input.execution.context,
      evidence,
      allowedTools: capability.allowedTools,
    });
  } catch {
    return abstain('model_unavailable');
  }
  if (!capability.validateOutput(generated.output))
    return abstain('invalid_output');
  if (!capability.guardOutput(generated.output))
    return abstain('guard_blocked');
  return {
    status: 'completed',
    output: generated.output,
    trace: {
      capabilityId: capability.id,
      bundleVersion: capability.bundleVersion,
      providerRef: generated.providerRef,
      modelRef: generated.modelRef,
      usageUnits: generated.usageUnits,
      evidenceIds: evidence.map(({ id }) => id),
    },
  };
}
