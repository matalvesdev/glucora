import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
const password = randomBytes(24).toString('hex');
try {
  await writeFile(
    '.env.local',
    `DATABASE_URL=postgresql://glucora:${password}@127.0.0.1:55432/glucora\nPOSTGRES_PASSWORD=${password}\nNODE_ENV=development\n`,
    { flag: 'wx', mode: 0o600 },
  );
  console.info('.env.local created with generated local credentials.');
} catch (error) {
  if (error.code === 'EEXIST')
    console.info('.env.local already exists; preserved.');
  else throw error;
}
