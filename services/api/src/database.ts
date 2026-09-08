import pg from 'pg';
export function createDatabase(connectionString: string) {
  const pool = new pg.Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 2000,
    idleTimeoutMillis: 10000,
    statement_timeout: 2000,
    query_timeout: 2500,
    application_name: 'glucora-api',
  });
  // Pool errors must not emit raw connection details or terminate the process.
  pool.on('error', () => {});
  return {
    async checkReadiness() {
      const result = await pool.query<{ version: string }>(
        "SELECT version FROM glucora_meta.schema_migrations WHERE version = '0001_foundation'",
      );
      if (result.rowCount !== 1) throw new Error('Schema not ready');
    },
    close: () => pool.end(),
  };
}
