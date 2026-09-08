import { readConfig } from '@glucora/config';
import { createLogger } from '@glucora/observability';
import { buildApp } from './app';
import { createDatabase } from './database';
const logger = createLogger();
try {
  const config = readConfig(process.env);
  const database = createDatabase(config.DATABASE_URL);
  const app = buildApp({
    checkReadiness: database.checkReadiness,
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
