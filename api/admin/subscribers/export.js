// api/admin/subscribers/export.js - CSV export of newsletter subscribers

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
    // Fetch all subscribers (no pagination for export)
    const { data, error } = await supabase
      .from(TABLE)
      .select('email, subscribed_at, source')
      .order('subscribed_at', { ascending: false });

    if (error) throw error;

    // Generate CSV
    const csvHeader = 'Email,Subscribed At (UTC),Subscribed At (IST),Source\n';
    const csvRows = (data || []).map(sub => {
      const utcDate = new Date(sub.subscribed_at);
      const istDate = new Date(utcDate.getTime() + 5.5 * 60 * 60 * 1000);
      return `"${sub.email}","${utcDate.toISOString()}","${istDate.toISOString()}","${sub.source || 'website'}"`;
    }).join('\n');

    const csv = csvHeader + csvRows;

    // Set headers for file download
    const filename = `honestlybiased-subscribers-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    return res.send(csv);

  } catch (err) {
    console.error('Export error:', err);
    return res.status(500).json({ error: err.message || 'Export failed' });
  }
};