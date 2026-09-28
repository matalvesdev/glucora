import { isDeepStrictEqual } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { buildApp } from '../services/api/src/app';
import { createLogger } from '../packages/observability/src/index';
const app = buildApp({
  checkReadiness: async () => {},
  logger: createLogger('silent'),
});
await app.ready();
const document = app.swagger();
for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
  if (!pathItem) continue;
  for (const operation of Object.values(pathItem)) {
    if (
      typeof operation !== 'object' ||
      operation === null ||
      !('responses' in operation)
    )
      continue;
    const responses = operation.responses as Record<string, unknown>;
    const exempt = path === '/v1/health' || path === '/v1/ready';
    if (exempt ? '429' in responses : !('429' in responses))
      throw new Error(`OpenAPI rate-limit response mismatch for ${path}.`);
  }
}
const serialized = JSON.stringify(document, null, 2) + '\n';
const file = 'packages/contracts/openapi.json';
if (process.argv.includes('--write')) await writeFile(file, serialized);
else if (
  !isDeepStrictEqual(
    JSON.parse(await readFile(file, 'utf8')),
    JSON.parse(serialized),
  )
)
  throw new Error(
    'OpenAPI drift: run pnpm openapi:generate and review contract.',
  );
await app.close();
