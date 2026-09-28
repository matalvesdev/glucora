import { defineConfig } from 'tsup';
export default defineConfig({
  entry: {
    server: 'services/api/src/server.ts',
    migrate: 'scripts/migrate.ts',
  },
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  outDir: 'services/api/dist',
  splitting: false,
  clean: true,
  noExternal: [/^@glucora\//],
  external: [
    'fastify',
    '@fastify/swagger',
    '@fastify/helmet',
    '@fastify/rate-limit',
    'pg',
    'pino',
    'zod',
    '@sinclair/typebox',
  ],
});
