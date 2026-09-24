export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export interface DataExportRecord {
  readonly id: string;
  readonly subjectUserId: string;
  readonly resourceType: string;
  readonly resourceVersion: string;
  readonly provenanceRefs: readonly string[];
  readonly data: { readonly [key: string]: JsonValue };
}

export interface DataExportSection {
  readonly sectionId: string;
  readonly records: readonly DataExportRecord[];
}

export interface DataExportSectionPort {
  readonly sectionId: string;
  loadForSubject(userId: string): Promise<DataExportSection>;
}

export interface StructuredExportArtifact {
  readonly schemaVersion: 'glucora-export/1';
  readonly privacyRequestId: string;
  readonly generatedAt: string;
  readonly mediaType: 'application/json';
  readonly fileName: string;
  readonly sha256: string;
  readonly bytes: Uint8Array;
  readonly recordCount: number;
}

export interface ExportDeliveryReceipt {
  readonly id: string;
  readonly requestId: string;
  readonly userId: string;
  readonly sha256: string;
  readonly recordCount: number;
  readonly generatedAt: string;
  readonly acknowledgedAt: string | null;
}

export interface ExportDeliveryRepository {
  recordGenerated(receipt: ExportDeliveryReceipt): Promise<void>;
  acknowledgeAndFulfill(input: {
    readonly deliveryId: string;
    readonly requestId: string;
    readonly userId: string;
    readonly sha256: string;
    readonly acknowledgedAt: string;
    readonly eventId: string;
    readonly auditId: string;
    readonly auditRequestId: string;
    readonly retentionPolicyRef: string;
  }): Promise<import('./privacy-request').PrivacyRequest>;
}
