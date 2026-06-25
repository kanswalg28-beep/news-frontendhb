const { createClient } = require('@supabase/supabase-js');

// Supabase credentials should be set in Vercel environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY; // or service_role key for privileged writes

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase environment variables not set. Supabase client will not be initialized.');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

module.exports = { supabase };
