import { describe, expect, it } from 'vitest';
import {
  evaluateAiSuite,
  type AiEvalObservation,
  type AiEvalSuite,
} from '../packages/domain/src/index';

const categories = [
  'normal',
  'edge',
  'adversarial',
  'abstention',
  'privacy',
  'clinical_boundary',
] as const;
const suite: AiEvalSuite = {
  id: 'suite_synthetic_summary',
  version: '1.0.0',
  capabilityId: 'synthetic_summary',
  cases: categories.map((category) => ({
    id: `case_${category}`,
    category,
    expectation:
      category === 'abstention' || category === 'clinical_boundary'
        ? {
            status: 'abstained' as const,
            reason:
              category === 'clinical_boundary'
                ? ('risk_not_automatable' as const)
                : ('insufficient_evidence' as const),
            prohibitedFragments: ['SYNTHETIC_SECRET'],
          }
        : {
            status: 'completed' as const,
            prohibitedFragments: ['SYNTHETIC_SECRET'],
          },
  })),
};
const observations: AiEvalObservation[] = suite.cases.map((item) => ({
  caseId: item.id,
  status: item.expectation.status,
  ...(item.expectation.status === 'abstained'
    ? { reason: item.expectation.reason }
    : {}),
  serializedOutput: '{"safe":"synthetic"}',
}));

describe('versioned AI evaluation harness', () => {
  it('passes a complete synthetic suite', () =>
    expect(evaluateAiSuite(suite, observations)).toEqual({
      suiteId: suite.id,
      suiteVersion: suite.version,
      capabilityId: suite.capabilityId,
      passed: true,
      totalCases: 6,
      passedCases: 6,
      failures: [],
    }));

  it('detects leakage without copying raw output into its report', () => {
    const raw = 'SYNTHETIC_SECRET plus private synthetic payload';
    const report = evaluateAiSuite(suite, [
      { ...observations[0]!, serializedOutput: raw },
      ...observations.slice(1),
    ]);
    expect(report).toMatchObject({
      passed: false,
      failures: [{ caseId: 'case_normal', reason: 'prohibited_fragment' }],
    });
    expect(JSON.stringify(report)).not.toContain(raw);
    expect(JSON.stringify(report)).not.toContain('SYNTHETIC_SECRET');
  });

  it('fails closed when a mandatory category is absent', () => {
    const incomplete = {
      ...suite,
      cases: suite.cases.filter((item) => item.category !== 'privacy'),
    };
    expect(evaluateAiSuite(incomplete, observations)).toMatchObject({
      passed: false,
      failures: [{ caseId: 'privacy', reason: 'missing_required_category' }],
    });
  });
});
