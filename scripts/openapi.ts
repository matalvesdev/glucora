import { isDeepStrictEqual } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { buildApp } from '../services/api/src/app';
import { createLogger } from '../packages/observability/src/index';
const app = buildApp({
  checkReadiness: async () => {},
  logger: createLogger('silent'),
});
await app.ready();
const serialized = JSON.stringify(app.swagger(), null, 2) + '\n';
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
