import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'infrastructure/gcp/README.md',
  'infrastructure/gcp/versions.tf',
  'infrastructure/gcp/variables.tf',
  'infrastructure/gcp/main.tf',
  'infrastructure/gcp/outputs.tf',
  'infrastructure/gcp/terraform.tfvars.example',
  'render.yaml',
  '.github/workflows/sandbox-health.yml',
  '.github/workflows/codeql.yml',
  'scripts/check-sandbox-health.mjs',
];

const contents = await Promise.all(
  requiredFiles.map(async (file) => ({
    file,
    content: await readFile(resolve(root, file), 'utf8'),
  })),
);
const byFile = new Map(contents.map(({ file, content }) => [file, content]));
const main = byFile.get('infrastructure/gcp/main.tf');
const variables = byFile.get('infrastructure/gcp/variables.tf');
const versions = byFile.get('infrastructure/gcp/versions.tf');
const readme = byFile.get('infrastructure/gcp/README.md');
const render = byFile.get('render.yaml');
const sandboxMonitor = byFile.get('.github/workflows/sandbox-health.yml');
const codeql = byFile.get('.github/workflows/codeql.yml');
const sandboxHealthScript = byFile.get('scripts/check-sandbox-health.mjs');

const expectations = [
  [variables, 'default     = false', 'resource creation safety switch'],
  [variables, 'default     = "southamerica-east1"', 'ADR-050 region'],
  [versions, 'hashicorp/google', 'Google provider pin'],
  [main, 'deletion_protection = true', 'Cloud SQL deletion protection'],
  [
    main,
    'transaction_log_retention_days = var.transaction_log_retention_days',
    'reviewed database recovery input',
  ],
  [
    main,
    'public_access_prevention    = "enforced"',
    'bucket public access prevention',
  ],
  [main, 'force_destroy               = false', 'bucket deletion protection'],
  [main, 'INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER', 'private Cloud Run ingress'],
  [main, 'oidc_token', 'Scheduler OIDC authentication'],
  [main, 'age = 90', 'backup deletion deadline'],
  [readme, 'não cria recursos', 'no-apply documentation'],
  [render, 'plan: free', 'free sandbox API plan'],
  [render, 'autoDeployTrigger: off', 'manual sandbox deployment'],
  [render, 'healthCheckPath: /v1/ready', 'database-aware health check'],
  [render, 'DATABASE_URL', 'external PostgreSQL configuration'],
  [render, 'sync: false', 'secret prompt configuration'],
  [sandboxMonitor, "cron: '*/15 * * * *'", 'sandbox monitor schedule'],
  [sandboxMonitor, 'secrets.SANDBOX_API_URL', 'masked sandbox URL input'],
  [sandboxMonitor, 'timeout-minutes: 2', 'bounded sandbox monitor runtime'],
  [sandboxHealthScript, "url.protocol !== 'https:'", 'HTTPS monitor boundary'],
  [sandboxHealthScript, "redirect: 'error'", 'redirect rejection'],
  [sandboxHealthScript, "'/v1/health'", 'liveness monitor'],
  [sandboxHealthScript, "'/v1/ready'", 'readiness monitor'],
  [codeql, 'security-events: write', 'CodeQL result permission'],
  [codeql, 'actions: read', 'CodeQL workflow metadata permission'],
  [codeql, 'languages: javascript-typescript', 'TypeScript SAST language'],
  [codeql, 'queries: security-extended', 'extended security query suite'],
  [codeql, 'timeout-minutes: 15', 'bounded CodeQL runtime'],
  [
    codeql,
    'github/codeql-action/init@7999b86c43a865dc79d8923397f35af22de63401',
    'pinned CodeQL action',
  ],
];

for (const [content, expected, label] of expectations) {
  if (!content?.includes(expected)) {
    throw new Error(`Infrastructure check failed: missing ${label}.`);
  }
}

if (main.includes('allUsers') || main.includes('0.0.0.0/0')) {
  throw new Error('Infrastructure check failed: public access is forbidden.');
}

if (
  render.includes('AUTH_ADAPTER\n        value: development') ||
  render.includes('DATABASE_URL\n        value:')
) {
  throw new Error(
    'Infrastructure check failed: unsafe sandbox authentication or database secret.',
  );
}

console.log(
  `Infrastructure contract check passed (${requiredFiles.length} files).`,
);
