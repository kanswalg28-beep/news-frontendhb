// api/admin/instagram/config.js - Instagram automation configuration
// Handles connect/disconnect, RSS URL, and polling config

const { supabase } = require('../../db/client');
const TABLE = 'instagram_config';

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Auth check
  if (process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      res.setHeader('WWW-Authenticate', 'Basic realm="CMS Admin"');
      return res.status(401).json({ error: 'Authentication required' });
    }
    try {
      const decoded = Buffer.from(authHeader.split(' ')[1], 'base64').toString();
      const [user, pass] = decoded.split(':');
      if (user !== process.env.ADMIN_USERNAME || pass !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    } catch (e) {
      return res.status(401).json({ error: 'Invalid auth header' });
    }
  }

  if (!supabase) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    if (req.method === 'GET') {
      // Fetch current config
      const { data, error } = await supabase.from(TABLE).select('*').limit(1).single();
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
      
      const config = data || { connected: false, handle: '', rssUrl: '', updatedAt: null };
      
      // Fetch recent logs
      const { data: logs } = await supabase
        .from('instagram_logs')
        .select('message, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      
      return res.json({ 
        config,
        logs: logs ? logs.map(l => `${l.created_at} ${l.message}`).reverse() : []
      });
    }

    if (req.method === 'POST') {
      const { handle, rssUrl, connected } = req.body || {};
      
      // Validate RSS URL if provided (SSRF prevention)
      if (rssUrl && connected !== false) {
        try {
          const url = new URL(rssUrl);
          if (!['http:', 'https:'].includes(url.protocol)) {
            return res.status(400).json({ error: 'RSS URL must use HTTP or HTTPS' });
          }
          // Block private IPs (basic SSRF prevention)
          const hostname = url.hostname;
          if (hostname === 'localhost' || 
              hostname.match(/^10\./) || 
              hostname.match(/^192\.168\./) || 
              hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./) ||
              hostname.match(/^127\./) ||
              hostname.match(/^169\.254\./)) {
            return res.status(400).json({ error: 'Private/loopback IPs not allowed in RSS URL' });
          }
        } catch (e) {
          return res.status(400).json({ error: 'Invalid RSS URL format' });
        }
      }

      // Validate handle format
      if (connected && handle && !handle.startsWith('@')) {
        return res.status(400).json({ error: 'Instagram handle must start with @' });
      }

      const updates = {
        handle: connected ? handle : '',
        rss_url: connected ? rssUrl : '',
        connected: !!connected,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from(TABLE)
        .upsert(updates, { onConflict: 'id' }) // assumes single-row table with id=1
        .select()
        .single();

      if (error) throw error;

      // Log the action
      await supabase.from('instagram_logs').insert({
        message: connected ? `Connected handle: ${handle}` : 'Disconnected Instagram automation',
        created_at: new Date().toISOString()
      });

      return res.json({ ok: true, config: data });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Instagram config error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
};