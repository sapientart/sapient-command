import 'dotenv/config';
import { supabase } from '../src/lib/supabase.js';

async function testConnection() {
  console.log('Testing Supabase connection...');
  console.log(`URL: ${process.env.SUPABASE_URL}`);

  // Query a table that may not exist — we just want to confirm
  // the client connects and Supabase responds without auth errors.
  const { data, error } = await supabase.from('_test_ping').select('*').limit(1);

  if (error) {
    // PostgREST returns PGRST116 or a "not found in schema cache" message
    // when the table doesn't exist. This still proves the connection works.
    const isTableNotFound =
      error.code === '42P01' ||
      error.code === 'PGRST116' ||
      error.message?.includes('schema cache');

    if (isTableNotFound) {
      console.log('Connection successful!');
      console.log('(Table does not exist yet, which is expected — Supabase responded correctly)');
      process.exit(0);
    }

    console.error('Connection failed:', error.message);
    console.error('Error code:', error.code);
    process.exit(1);
  }

  console.log('Connection successful! Data:', data);
  process.exit(0);
}

testConnection();
