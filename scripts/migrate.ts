import { resolve } from 'node:path';
import { readConfig } from '../packages/config/src/index';
import { migrate } from './migration-runner';
try {
  await migrate(
    readConfig(process.env).DATABASE_URL,
    resolve('infrastructure/migrations'),
  );
  console.info('Migrations applied.');
} catch {
  console.error(
    'Migration failed; verify connection, migration history and checksums. No raw database error is logged.',
  );
  process.exitCode = 1;
}
