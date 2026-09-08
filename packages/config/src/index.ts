import { z } from 'zod';
const optionalValue = (value: unknown) => (value === '' ? undefined : value);
const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .refine((v) => {
      try {
        return ['postgres:', 'postgresql:'].includes(new URL(v).protocol);
      } catch {
        return false;
      }
    }),
  NODE_ENV: z.preprocess(
    optionalValue,
    z.enum(['development', 'test', 'production']).default('development'),
  ),
  PORT: z.preprocess(
    optionalValue,
    z.coerce.number().int().min(1).max(65535).default(3001),
  ),
  HOST: z.preprocess(optionalValue, z.string().min(1).default('127.0.0.1')),
  LOG_LEVEL: z.preprocess(
    optionalValue,
    z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'silent'])
      .default('info'),
  ),
});
export function readConfig(env: Record<string, string | undefined>) {
  const result = envSchema.safeParse(env);
  if (!result.success)
    throw new Error(
      'Invalid configuration: ' +
        [...new Set(result.error.issues.map((i) => i.path.join('.')))].join(
          ', ',
        ),
    );
  return result.data;
}
