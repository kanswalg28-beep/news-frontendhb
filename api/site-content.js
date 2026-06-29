// api/site-content.js — Public read of CMS-controlled site-wide text blocks.
// Returns: { [key]: value } flattened for easy hydration in app.js.
//
// Public on purpose: any block shown on the home page is, by definition,
// public. Auth-gated writes live in api/admin/site-content.js.

const { supabase } = require('../db/client');

module.exports = async (req, res) => {
  // Public CORS — same-origin by default, but allow cross-origin CDN caching
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // If Supabase isn't configured yet, return empty payload so the page falls
  // back to its baked-in HTML slots instead of failing the request outright.
  if (!supabase) return res.json({});

  try {
    const { data, error } = await supabase
      .from('site_content')
      .select('key,value');
    if (error) throw error;
    const out = {};
    for (const row of data || []) out[row.key] = row.value;
    // Light CDN-aware cache hint — content is editorial, changes rarely but
    // we don't want stale content if a CMS editor just hit save.
    res.setHeader('CDN-Cache-Control', 'public, max-age=15');
    return res.json(out);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'site_content read failed' });
  }
};
