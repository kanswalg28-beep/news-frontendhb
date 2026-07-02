// api/admin/subscribers.js - Newsletter subscribers management

const { supabase } = require('../../db/client');
const TABLE = 'subscribers';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

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
    // Support pagination
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabase
      .from(TABLE)
      .select('email, subscribed_at, source', { count: 'exact' })
      .order('subscribed_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    return res.json({
      subscribers: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (err) {
    console.error('Subscribers fetch error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch subscribers' });
  }
};