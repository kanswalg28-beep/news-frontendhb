const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase = null;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    '[supabase] SUPABASE_URL / SUPABASE_*_KEY env vars are not set. ' +
      'Set them in Vercel project settings. Client left as null.'
  );
} else {
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
}

module.exports = { supabase };
