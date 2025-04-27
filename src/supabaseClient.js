import { createClient } from '@supabase/supabase-js';

// These will be set by the environment variables
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: null, // Use in-memory session storage for compatibility
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

export function getSupabaseClient() {
  return supabase;
}

// Fetch all rows from a table
export async function fetchTableData(tableName) {
  const client = getSupabaseClient();
  const { data, error } = await client.from(tableName).select('*');
  if (error) throw error;
  return data;
}

// Infer columns from the first row
export async function fetchTableColumnsFromRows(tableName) {
  const client = getSupabaseClient();
  const { data, error } = await client.from(tableName).select('*').limit(1);
  if (error) throw error;
  if (!data || !data[0]) return [];
  return Object.keys(data[0]);
}
