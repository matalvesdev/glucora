import { describe, expect, it } from 'vitest';
import {
  excludeContestedResourceIds,
  type OutputContestation,
} from '../packages/domain/src/index';
const contestation: OutputContestation = {
  id: 'fbk_syntheticcontest0001',
  userId: 'usr_syntheticconsumer001',
  resourceType: 'ai_output',
  resourceId: 'aio_syntheticoutput0001',
  resourceVersion: 'bundle-test-1',
  reason: 'inaccurate',
  status: 'open',
  occurredAt: '2026-01-01T00:00:00.000Z',
};
describe('output contestation', () => {
  it('excludes an openly contested output from later reuse', () =>
    expect(
      excludeContestedResourceIds(
        [{ id: 'aio_syntheticoutput0001' }, { id: 'aio_syntheticoutput0002' }],
        [contestation],
      ),
    ).toEqual([{ id: 'aio_syntheticoutput0002' }]));
  it('does not treat absence of contestation as approval', () =>
    expect(
      excludeContestedResourceIds([{ id: 'aio_syntheticoutput0002' }], []),
    ).toEqual([{ id: 'aio_syntheticoutput0002' }]));
});
