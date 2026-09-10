import { describe, expect, it } from 'vitest';
import { evaluatePrivateBetaGate } from '../scripts/readiness-gate';
const approved = {
  version: 1,
  enrollment_enabled: true,
  gates: Object.fromEntries(
    ['product', 'clinical', 'compliance', 'security', 'operations'].map(
      (name) => [
        name,
        {
          status: 'PASS',
          owner_ref: `${name}-owner`,
          evidence_refs: [`${name}-evidence`],
        },
      ],
    ),
  ),
};
describe('private beta readiness gate', () => {
  it('accepts only complete evidence and enabled enrollment', () =>
    expect(evaluatePrivateBetaGate(approved)).toEqual({
      ready: true,
      enrollmentEnabled: true,
      failures: [],
    }));
  it('holds when enrollment is disabled', () =>
    expect(
      evaluatePrivateBetaGate({ ...approved, enrollment_enabled: false }),
    ).toMatchObject({
      ready: false,
      failures: expect.arrayContaining(['enrollment:disabled']),
    }));
  it('holds without authority or evidence', () => {
    const value = structuredClone(approved);
    value.gates.clinical = { status: 'HOLD', owner_ref: '', evidence_refs: [] };
    expect(evaluatePrivateBetaGate(value)).toMatchObject({
      ready: false,
      failures: expect.arrayContaining([
        'clinical:missing_evidence_or_owner',
        'clinical:hold',
      ]),
    });
  });
  it('requires accountable dated conditions', () => {
    const value = structuredClone(approved);
    value.gates.operations = {
      status: 'PASS_WITH_CONDITIONS',
      owner_ref: 'ops-owner',
      evidence_refs: ['ops-evidence'],
    };
    expect(evaluatePrivateBetaGate(value).failures).toContain(
      'operations:invalid_conditions',
    );
  });
  it('fails closed for malformed documents', () =>
    expect(evaluatePrivateBetaGate({})).toEqual({
      ready: false,
      enrollmentEnabled: false,
      failures: ['invalid_gate_document'],
    }));
});
