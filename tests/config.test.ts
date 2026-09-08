import { describe, it, expect } from 'vitest';
import { readConfig } from '../packages/config/src/index';
describe('environment boundary', () => {
  it('fails closed without database configuration', () =>
    expect(() => readConfig({})).toThrow('DATABASE_URL'));
  it('does not echo secrets in validation errors', () => {
    expect(() =>
      readConfig({ DATABASE_URL: 'invalid-secret-value', PORT: 'not-a-port' }),
    ).toThrow('Invalid configuration: DATABASE_URL, PORT');
  });
  it.each(['0', '65536', 'abc'])('rejects invalid port %s', (PORT) =>
    expect(() =>
      readConfig({ DATABASE_URL: 'postgresql://localhost/glucora', PORT }),
    ).toThrow('PORT'),
  );
  it('handles empty optional .env values and validates protocol', () => {
    expect(
      readConfig({ DATABASE_URL: 'postgresql://localhost/glucora', PORT: '' })
        .PORT,
    ).toBe(3001);
    expect(() =>
      readConfig({ DATABASE_URL: 'https://localhost/glucora' }),
    ).toThrow('DATABASE_URL');
  });
  it('prevents the development identity adapter in production', () => {
    expect(() =>
      readConfig({
        DATABASE_URL: 'postgresql://localhost/glucora',
        NODE_ENV: 'production',
        AUTH_ADAPTER: 'development',
      }),
    ).toThrow('AUTH_ADAPTER');
  });
});
