import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type {
  DataExportSectionPort,
  PrivacyRequest,
} from '../packages/domain/src/index';
import { buildStructuredExportArtifact } from '../services/api/src/modules/privacy/build-export-artifact';

const request: PrivacyRequest = {
  id: 'dsr_syntheticexport0001',
  userId: 'usr_syntheticconsumer001',
  kind: 'export',
  scope: 'all_user_data',
  status: 'in_review',
  version: 2,
  requestedAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};
const section = (userId = request.userId): DataExportSectionPort => ({
  sectionId: 'observations',
  loadForSubject: vi.fn().mockResolvedValue({
    sectionId: 'observations',
    records: [
      {
        id: 'obs_syntheticmeasure0001',
        subjectUserId: userId,
        resourceType: 'observation',
        resourceVersion: '1',
        provenanceRefs: ['prv_syntheticorigin001'],
        data: { unit: 'synthetic_unit', value: '123.45' },
      },
    ],
  }),
});

describe('structured user data export', () => {
  it('builds a deterministic artifact with provenance and checksum', async () => {
    const artifact = await buildStructuredExportArtifact({
      request,
      generatedAt: '2026-01-03T00:00:00.000Z',
      sections: [section()],
    });
    const text = new TextDecoder().decode(artifact.bytes);
    expect(artifact).toMatchObject({
      schemaVersion: 'glucora-export/1',
      privacyRequestId: request.id,
      mediaType: 'application/json',
      recordCount: 1,
    });
    expect(artifact.sha256).toBe(
      createHash('sha256').update(artifact.bytes).digest('hex'),
    );
    expect(JSON.parse(text)).toMatchObject({
      subjectUserId: request.userId,
      sections: [{ records: [{ provenanceRefs: ['prv_syntheticorigin001'] }] }],
    });
  });

  it('rejects cross-user records before producing an artifact', async () => {
    await expect(
      buildStructuredExportArtifact({
        request,
        generatedAt: '2026-01-03T00:00:00.000Z',
        sections: [section('usr_syntheticconsumer002')],
      }),
    ).rejects.toThrow('Invalid export record');
  });

  it('rejects ineligible requests and duplicate sections', async () => {
    await expect(
      buildStructuredExportArtifact({
        request: { ...request, status: 'requested' },
        generatedAt: '2026-01-03T00:00:00.000Z',
        sections: [section()],
      }),
    ).rejects.toThrow('not eligible');
    const duplicate = section();
    await expect(
      buildStructuredExportArtifact({
        request,
        generatedAt: '2026-01-03T00:00:00.000Z',
        sections: [duplicate, duplicate],
      }),
    ).rejects.toThrow('Invalid export plan');
  });
});
