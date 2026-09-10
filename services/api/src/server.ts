import { readConfig } from '@glucora/config';
import { createLogger } from '@glucora/observability';
import { buildApp } from './app';
import { createDatabase } from './database';
import {
  createDevelopmentIdentityAdapter,
  createDisabledIdentityAdapter,
} from './modules/identity/identity-adapter';
const logger = createLogger();
try {
  const config = readConfig(process.env);
  const database = createDatabase(config.DATABASE_URL);
  const identity =
    config.AUTH_ADAPTER === 'development'
      ? createDevelopmentIdentityAdapter()
      : createDisabledIdentityAdapter();
  const app = buildApp({
    checkReadiness: database.checkReadiness,
    identity,
    users: database.users,
    privacyRequests: database.privacyRequests,
    ...(config.PRIVACY_REQUEST_RETENTION_POLICY_REF
      ? {
          privacyRequestPolicy: {
            retentionPolicyRef: config.PRIVACY_REQUEST_RETENTION_POLICY_REF,
          },
        }
      : {}),
    supportRequests: database.supportRequests,
    ...(config.SUPPORT_REQUEST_RETENTION_POLICY_REF
      ? {
          supportRequestPolicy: {
            retentionPolicyRef: config.SUPPORT_REQUEST_RETENTION_POLICY_REF,
          },
        }
      : {}),
    logger: createLogger(config.LOG_LEVEL),
  });
  app.addHook('onClose', async () => database.close());
  for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.once(signal, () => {
      const deadline = setTimeout(() => process.exit(1), 10000);
      deadline.unref();
      void app.close().then(
        () => {
          clearTimeout(deadline);
        },
        () => {
          process.exitCode = 1;
        },
      );
    });
  await app.listen({ host: config.HOST, port: config.PORT });
} catch {
  logger.fatal(
    { event: 'startup_failed' },
    'API startup failed; verify configuration and port availability.',
  );
  process.exitCode = 1;
}
