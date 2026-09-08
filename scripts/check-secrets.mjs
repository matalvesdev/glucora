import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /gh[pousr]_[A-Za-z0-9]{30,}/,
  /postgres(?:ql)?:\/\/[^\s:]+:[^\s@${]+@/,
];
const failures = [];
for (const file of files) {
  if (/^\.env(?:\.|$)/.test(file) && file !== '.env.example') {
    failures.push(file);
    continue;
  }
  if (
    file.startsWith('docs/source-of-truth/') ||
    file === 'scripts/check-secrets.mjs'
  )
    continue;
  const content = readFileSync(file, 'utf8');
  if (patterns.some((p) => p.test(content))) failures.push(file);
}
if (failures.length) {
  console.error('Potential secrets in: ' + failures.join(', '));
  process.exitCode = 1;
} else
  console.info(
    'Tracked files checked for common credential patterns (baseline heuristic, not a full security audit).',
  );
