// admin/articles.js – Serverless API for CMS article CRUD operations
// Uses Supabase client (db/client.js) for persistence
// Basic Auth optional – configured via ADMIN_USERNAME and ADMIN_PASSWORD env vars

const { supabase } = require('../../db/client');

// Simple Basic Auth helper (optional)
function basicAuth(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return false;
  const token = authHeader.split(' ')[1] || '';
  const decoded = Buffer.from(token, 'base64').toString();
  const [user, pass] = decoded.split(':');
  return (
    user === process.env.ADMIN_USERNAME &&
    pass === process.env.ADMIN_PASSWORD
  );
}

module.exports = async (req, res) => {
  // Optional auth – if env vars are set, enforce auth
  if (process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) {
    if (!basicAuth(req)) {
      res.setHeader('WWW-Authenticate', 'Basic realm="CMS Admin"');
      return res.status(401).json({ error: 'Authentication required' });
    }
  }

  const { method, query, body } = req;
  const articleId = query.id; // for PUT/DELETE routes like /api/admin/articles/:id

  try {
    if (method === 'GET') {
      // Return all custom articles (admin authored)
      const { data, error } = await supabase.from('articles').select('*');
      if (error) throw error;
      return res.json(data);
    }

    if (method === 'POST') {
      // Create new article – client supplies fields used by admin UI
      const resolvedPublishDate = body.publishdate ? new Date(body.publishdate).toISOString() : new Date().toISOString();
      const payload = {
        ...body,
        authortype: 'admin', // mark as admin editorial
        author: 'CMS Admin',
        publishdate: resolvedPublishDate,
        timeago: new Date(resolvedPublishDate).toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }) + ' IST'
      };
      const { data, error } = await supabase
        .from('articles')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (method === 'PUT' && articleId) {
      // Update existing article
      const updatePayload = { ...body };
      if (updatePayload.publishdate) {
        updatePayload.publishdate = new Date(updatePayload.publishdate).toISOString();
        updatePayload.timeago = new Date(updatePayload.publishdate).toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }) + ' IST';
      }
      const { data, error } = await supabase
        .from('articles')
        .update(updatePayload)
        .eq('id', articleId)
        .select()
        .single();
      if (error) throw error;
      return res.json(data);
    }

    if (method === 'DELETE' && articleId) {
      const { data, error } = await supabase
        .from('articles')
        .delete()
        .eq('id', articleId)
        .select();
      if (error) throw error;
      return res.json({ success: true, deletedId: articleId, deleted: data });
    }

    // Unsupported method/path
    res.setHeader('Allow', 'GET,POST,PUT,DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('admin/articles API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
