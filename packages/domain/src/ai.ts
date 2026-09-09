import type { ConsumerCapabilityContext, ObservationFactClass } from './index';

export type ClinicalRisk = 'R0' | 'R1' | 'R2' | 'R3' | 'R4';
export interface EvidenceRef {
  readonly id: string;
  readonly corpusVersion: string;
  readonly authorityTier: string;
}
export interface AiContextItem {
  readonly id: string;
  readonly factClass: ObservationFactClass;
  readonly provenanceId: string;
}
export interface AiCapability<Output> {
  readonly id: string;
  readonly intendedUse: string;
  readonly risk: ClinicalRisk;
  readonly bundleVersion: string;
  readonly owner: string;
  readonly requiredCorpus: string | null;
  readonly minimumEvidence: number;
  readonly allowedTools: readonly string[];
  validateOutput(value: unknown): value is Output;
  guardOutput(value: Output): boolean;
  fallback(reason: AiAbstentionReason): Output;
}
export type AiAbstentionReason =
  | 'capability_unavailable'
  | 'risk_not_automatable'
  | 'access_denied'
  | 'insufficient_evidence'
  | 'model_unavailable'
  | 'invalid_output'
  | 'guard_blocked';
export interface StructuredGenerationRequest {
  readonly capabilityId: string;
  readonly bundleVersion: string;
  readonly context: readonly AiContextItem[];
  readonly evidence: readonly EvidenceRef[];
  readonly allowedTools: readonly string[];
}
export interface StructuredGenerationResult {
  readonly output: unknown;
  readonly providerRef: string;
  readonly modelRef: string;
  readonly usageUnits: number;
}
export interface ModelGateway {
  generateStructured(
    request: StructuredGenerationRequest,
  ): Promise<StructuredGenerationResult>;
  health(): Promise<'available' | 'unavailable'>;
}
export interface AiExecutionContext {
  readonly authorization: ConsumerCapabilityContext;
  readonly context: readonly AiContextItem[];
  readonly evidence: readonly EvidenceRef[];
}

export class AiCapabilityRegistry {
  readonly #capabilities = new Map<string, AiCapability<unknown>>();
  register<Output>(capability: AiCapability<Output>) {
    if (this.#capabilities.has(capability.id))
      throw new Error('Duplicate AI capability');
    this.#capabilities.set(capability.id, capability as AiCapability<unknown>);
  }
  get(id: string) {
    return this.#capabilities.get(id) ?? null;
  }
}
