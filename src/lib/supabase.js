import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
}

// Default client — respects RLS (use for normal operations)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client — bypasses RLS (use for ingestion, migrations, admin ops)
// Only available when SUPABASE_SERVICE_ROLE_KEY is set
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;
