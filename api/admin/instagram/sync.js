// api/admin/instagram/sync.js - Manual Instagram sync trigger

const { supabase } = require('../../db/client');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
    // Fetch current config
    const { data: config } = await supabase
      .from('instagram_config')
      .select('*')
      .limit(1)
      .single();

    if (!config || !config.connected) {
      return res.status(400).json({ error: 'Instagram not connected' });
    }

    // Log sync start
    await supabase.from('instagram_logs').insert({
      message: '[Sync] Manual sync triggered by admin',
      created_at: new Date().toISOString()
    });

    // Here you would implement actual Instagram RSS/JSON feed polling
    // For now, we'll simulate success
    await supabase.from('instagram_logs').insert({
      message: '[Sync] Polling RSS feed... (simulated)',
      created_at: new Date().toISOString()
    });

    // In production: fetch RSS, parse items, create articles via gemini
    // For now, just return success
    
    await supabase.from('instagram_logs').insert({
      message: '[Sync] Completed successfully (simulated)',
      created_at: new Date().toISOString()
    });

    return res.json({ 
      message: 'Sync executed (simulated). Check logs for details.',
      syncedAt: new Date().toISOString()
    });

  } catch (err) {
    console.error('Instagram sync error:', err);
    await supabase.from('instagram_logs').insert({
      message: `[Sync] Error: ${err.message}`,
      created_at: new Date().toISOString()
    });
    return res.status(500).json({ error: err.message || 'Sync failed' });
  }
};