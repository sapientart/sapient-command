import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('Missing DATABASE_URL environment variable');
}

export const sql = postgres(databaseUrl, { ssl: 'require' });
