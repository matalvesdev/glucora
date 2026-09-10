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
