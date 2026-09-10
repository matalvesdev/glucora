import type { ConsumerCapabilityContext, ObservationFactClass } from './index';

export type ClinicalRisk = 'R0' | 'R1' | 'R2' | 'R3' | 'R4';
export interface EvidenceRef {
  readonly id: string;
  readonly corpusVersion: string;
  readonly authorityTier: string;
}
export interface ApprovedCorpusDocument {
  readonly id: string;
  readonly corpusVersion: string;
  readonly sourceRef: string;
  readonly authorityTier: string;
  readonly jurisdiction: string;
  readonly publishedAt: string;
  readonly reviewedAt: string;
  readonly approvalRef: string;
  readonly content: string;
}
export interface ApprovedCorpusQuery {
  readonly corpusVersion: string;
  readonly terms: readonly string[];
  readonly limit: number;
}
export interface ApprovedCorpusPort {
  retrieve(
    query: ApprovedCorpusQuery,
  ): Promise<readonly ApprovedCorpusDocument[]>;
}
export type CorpusValidationFailure =
  | 'invalid_query'
  | 'too_many_documents'
  | 'wrong_corpus_version'
  | 'missing_approval_metadata'
  | 'invalid_review_metadata';
export type ValidatedCorpusRetrieval =
  | {
      readonly valid: true;
      readonly documents: readonly ApprovedCorpusDocument[];
      readonly evidence: readonly EvidenceRef[];
    }
  | { readonly valid: false; readonly reason: CorpusValidationFailure };

export function validateCorpusRetrieval(
  query: ApprovedCorpusQuery,
  documents: readonly ApprovedCorpusDocument[],
): ValidatedCorpusRetrieval {
  if (
    !query.corpusVersion.trim() ||
    query.terms.length === 0 ||
    query.terms.some((term) => !term.trim()) ||
    !Number.isInteger(query.limit) ||
    query.limit < 1 ||
    query.limit > 20
  )
    return { valid: false, reason: 'invalid_query' };
  if (documents.length > query.limit)
    return { valid: false, reason: 'too_many_documents' };
  if (documents.some((item) => item.corpusVersion !== query.corpusVersion))
    return { valid: false, reason: 'wrong_corpus_version' };
  if (
    documents.some(
      (item) =>
        !item.id.trim() ||
        !item.sourceRef.trim() ||
        !item.authorityTier.trim() ||
        !item.jurisdiction.trim() ||
        !item.approvalRef.trim(),
    )
  )
    return { valid: false, reason: 'missing_approval_metadata' };
  if (
    documents.some((item) => {
      const published = Date.parse(item.publishedAt);
      const reviewed = Date.parse(item.reviewedAt);
      return (
        !Number.isFinite(published) ||
        !Number.isFinite(reviewed) ||
        reviewed < published
      );
    })
  )
    return { valid: false, reason: 'invalid_review_metadata' };
  return {
    valid: true,
    documents,
    evidence: documents.map(({ id, corpusVersion, authorityTier }) => ({
      id,
      corpusVersion,
      authorityTier,
    })),
  };
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
