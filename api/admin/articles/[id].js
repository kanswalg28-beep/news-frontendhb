// admin/articles/[id].js – Serverless API for updating/deleting a specific article
// Uses Supabase client (db/client.js) for persistence
// Optional Basic Auth same as parent endpoint
// CSRF protection via X-CSRF-Token header
// HTML sanitization on fullblog field

const { supabase } = require('../../../db/client');

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

// Simple CSRF validation
function validateCsrf(req) {
  const csrf = req.headers['x-csrf-token'];
  return !!csrf;
}

// HTML sanitization for fullblog field
function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') return '';
  
  const allowedTags = ['p', 'b', 'i', 'em', 'strong', 'blockquote', 'a', 'ul', 'ol', 'li', 'h2', 'h3', 'br', 'hr'];
  const allowedAttrs = {
    'a': ['href', 'target', 'rel'],
    'blockquote': ['class']
  };
  
  let sanitized = html;
  
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/on\w+="[^"]*"/gi, '');
  sanitized = sanitized.replace(/on\w+='[^']*'/gi, '');
  sanitized = sanitized.replace(/javascript:/gi, '');
  
  const tagRegex = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
  sanitized = sanitized.replace(tagRegex, (match, tagName) => {
    if (allowedTags.includes(tagName.toLowerCase())) {
      return match.replace(/\s+\w+="[^"]*"/g, (attr) => {
        const attrName = attr.match(/^\s+(\w+)=/)[1];
        if (allowedAttrs[tagName.toLowerCase()]?.includes(attrName.toLowerCase())) {
          return attr;
        }
        return '';
      });
    }
    return '';
  });
  
  return sanitized;
}

module.exports = async (req, res) => {
  // Enforce auth if env vars set
  if (process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) {
    if (!basicAuth(req)) {
      res.setHeader('WWW-Authenticate', 'Basic realm="CMS Admin"');
      return res.status(401).json({ error: 'Authentication required' });
    }
  }

  const { method, query, body } = req;
  const articleId = query.id;

  if (!articleId) {
    return res.status(400).json({ error: 'Missing article ID' });
  }

  try {
    if (method === 'PUT') {
      // CSRF validation
      if (!validateCsrf(req)) {
        return res.status(403).json({ error: 'CSRF token missing or invalid' });
      }
      
      const updatePayload = { ...body, fullblog: sanitizeHtml(body.fullblog || '') };
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
      if (!data) return res.status(404).json({ error: 'Article not found' });
      return res.json(data);
    }

    if (method === 'DELETE') {
      // CSRF validation
      if (!validateCsrf(req)) {
        return res.status(403).json({ error: 'CSRF token missing or invalid' });
      }
      
      const { data, error } = await supabase
        .from('articles')
        .delete()
        .eq('id', articleId)
        .select();
      if (error) throw error;
      if (!data || !Array.isArray(data) || data.length === 0)
        return res.status(404).json({ error: 'Article not found' });
      return res.json({ success: true, deletedId: articleId, deleted: data });
    }

    // Unsupported method
    res.setHeader('Allow', 'PUT,DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('admin/articles/[id] API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
