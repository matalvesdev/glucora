import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['services/api/src/server.ts'],
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
    'pg',
    'pino',
    'zod',
    '@sinclair/typebox',
  ],
});
