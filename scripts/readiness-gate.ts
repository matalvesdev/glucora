import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const requiredGates = [
  'product',
  'clinical',
  'compliance',
  'security',
  'operations',
] as const;
type GateStatus = 'PASS' | 'PASS_WITH_CONDITIONS' | 'HOLD' | 'BLOCKED';
interface Gate {
  readonly status: GateStatus;
  readonly owner_ref: string | null;
  readonly evidence_refs: readonly string[];
  readonly condition_ref?: string;
  readonly condition_due_at?: string;
}
export interface ReadinessResult {
  readonly ready: boolean;
  readonly enrollmentEnabled: boolean;
  readonly failures: readonly string[];
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function evaluatePrivateBetaGate(value: unknown): ReadinessResult {
  const failures: string[] = [];
  if (
    !object(value) ||
    value.version !== 1 ||
    typeof value.enrollment_enabled !== 'boolean' ||
    !object(value.gates)
  )
    return {
      ready: false,
      enrollmentEnabled: false,
      failures: ['invalid_gate_document'],
    };
  for (const name of requiredGates) {
    const candidate = value.gates[name];
    if (
      !object(candidate) ||
      !['PASS', 'PASS_WITH_CONDITIONS', 'HOLD', 'BLOCKED'].includes(
        String(candidate.status),
      )
    ) {
      failures.push(`${name}:invalid`);
      continue;
    }
    const gate = candidate as unknown as Gate;
    if (
      !gate.owner_ref ||
      !Array.isArray(gate.evidence_refs) ||
      gate.evidence_refs.length === 0
    )
      failures.push(`${name}:missing_evidence_or_owner`);
    if (!['PASS', 'PASS_WITH_CONDITIONS'].includes(gate.status))
      failures.push(`${name}:${gate.status.toLowerCase()}`);
    if (
      gate.status === 'PASS_WITH_CONDITIONS' &&
      (!gate.condition_ref ||
        !gate.condition_due_at ||
        !Number.isFinite(Date.parse(gate.condition_due_at)))
    )
      failures.push(`${name}:invalid_conditions`);
  }
  const enrollmentEnabled = value.enrollment_enabled;
  if (!enrollmentEnabled) failures.push('enrollment:disabled');
  return { ready: failures.length === 0, enrollmentEnabled, failures };
}
async function main() {
  const path =
    process.argv[2] && !process.argv[2]!.startsWith('--')
      ? process.argv[2]!
      : 'docs/operations/private-beta-gate.json';
  const expectHold = process.argv.includes('--expect-hold');
  const result = evaluatePrivateBetaGate(
    JSON.parse(await readFile(path, 'utf8')) as unknown,
  );
  process.stdout.write(
    JSON.stringify({
      ready: result.ready,
      enrollment_enabled: result.enrollmentEnabled,
      failures: result.failures,
    }) + '\n',
  );
  if (expectHold) {
    if (result.ready || result.enrollmentEnabled) process.exitCode = 1;
    return;
  }
  if (!result.ready) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
