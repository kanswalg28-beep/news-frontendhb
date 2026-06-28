// api/admin/site-content.js — Upsert CMS-controlled site_content rows.
// Auth: reuses the Basic Auth pattern from api/admin/articles.js.
//       ADMIN_USERNAME + ADMIN_PASSWORD env vars gate access when set.
//
// Request body: { updates: [{ key: string, value: any }, ...] }
// Response:     { ok: true, updated: [...] }  on success
//
// Allowed keys (whitelist — refuse anything outside this set):
//   hero, ledger_intro, manifesto, rhetoric, podcast, poll,
//   featured, standards, footer

const { supabase } = require('../../db/client');

function basicAuth(req) {
  const h = req.headers && req.headers['authorization'];
  if (!h) return false;
  const decoded = Buffer.from((h.split(' ')[1] || ''), 'base64').toString();
  const i = decoded.indexOf(':');
  if (i < 0) return false;
  const u = decoded.slice(0, i);
  const p = decoded.slice(i + 1);
  return (
    !!process.env.ADMIN_USERNAME &&
    !!process.env.ADMIN_PASSWORD &&
    u === process.env.ADMIN_USERNAME &&
    p === process.env.ADMIN_PASSWORD
  );
}

const ALLOWED_KEYS = new Set([
  'hero',
  'ledger_intro',
  'manifesto',
  'rhetoric',
  'podcast',
  'poll',
  'featured',
  'standards',
  'footer',
]);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD && !basicAuth(req)) {
    res.setHeader('WWW-Authenticate', 'Basic realm="CMS Admin"');
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { updates } = req.body || {};
  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ error: 'No updates provided' });
  }
  for (const u of updates) {
    if (!u || typeof u.key !== 'string' || !ALLOWED_KEYS.has(u.key)) {
      return res.status(400).json({ error: 'Invalid or disallowed key: ' + (u && u.key) });
    }
    if (u.value === undefined) {
      return res.status(400).json({ error: 'Missing value for key: ' + u.key });
    }
  }

  if (!supabase) {
    return res.status(503).json({ error: 'Supabase not configured' });
  }

  try {
    const rows = updates.map(u => ({
      key: u.key,
      value: u.value,
      updated_at: new Date().toISOString(),
    }));
    const { data, error } = await supabase
      .from('site_content')
      .upsert(rows, { onConflict: 'key' })
      .select();
    if (error) throw error;
    return res.json({ ok: true, updated: data });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'site_content upsert failed' });
  }
};
