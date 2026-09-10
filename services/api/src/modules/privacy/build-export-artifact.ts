import { createHash } from 'node:crypto';
import type {
  DataExportRecord,
  DataExportSectionPort,
  PrivacyRequest,
  StructuredExportArtifact,
} from '@glucora/domain';

const identifier = /^[a-z][a-z0-9_]{2,63}$/;

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stable(item)]),
    );
  return value;
}

function recordKey(record: DataExportRecord): string {
  return `${record.resourceType}:${record.id}:${record.resourceVersion}`;
}

export async function buildStructuredExportArtifact(input: {
  readonly request: PrivacyRequest;
  readonly generatedAt: string;
  readonly sections: readonly DataExportSectionPort[];
}): Promise<StructuredExportArtifact> {
  const { request, generatedAt, sections } = input;
  if (request.kind !== 'export' || request.status !== 'in_review')
    throw new Error('Export request is not eligible for fulfillment');
  const generated = Date.parse(generatedAt);
  if (
    !Number.isFinite(generated) ||
    generated < Date.parse(request.updatedAt) ||
    sections.length === 0 ||
    new Set(sections.map(({ sectionId }) => sectionId)).size !==
      sections.length ||
    sections.some(({ sectionId }) => !identifier.test(sectionId))
  )
    throw new Error('Invalid export plan');

  const loaded = [];
  const recordKeys = new Set<string>();
  for (const port of sections) {
    const section = await port.loadForSubject(request.userId);
    if (section.sectionId !== port.sectionId)
      throw new Error('Invalid export section');
    for (const record of section.records) {
      const key = recordKey(record);
      if (
        record.subjectUserId !== request.userId ||
        !identifier.test(record.resourceType) ||
        !record.id.trim() ||
        !record.resourceVersion.trim() ||
        recordKeys.has(key)
      )
        throw new Error('Invalid export record');
      recordKeys.add(key);
    }
    loaded.push({
      sectionId: section.sectionId,
      records: [...section.records].sort((left, right) =>
        recordKey(left).localeCompare(recordKey(right)),
      ),
    });
  }
  loaded.sort((left, right) => left.sectionId.localeCompare(right.sectionId));
  const document = stable({
    schemaVersion: 'glucora-export/1',
    privacyRequestId: request.id,
    subjectUserId: request.userId,
    generatedAt,
    sections: loaded,
  });
  const bytes = new TextEncoder().encode(JSON.stringify(document));
  return {
    schemaVersion: 'glucora-export/1',
    privacyRequestId: request.id,
    generatedAt,
    mediaType: 'application/json',
    fileName: `glucora-export-${request.id}.json`,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes,
    recordCount: recordKeys.size,
  };
}
