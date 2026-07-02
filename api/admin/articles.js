// admin/articles.js – Serverless API for CMS article CRUD operations
// Uses Supabase client (db/client.js) for persistence
// Basic Auth optional – configured via ADMIN_USERNAME and ADMIN_PASSWORD env vars
// CSRF protection via X-CSRF-Token header
// HTML sanitization on fullblog field

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

// Simple CSRF validation
function validateCsrf(req) {
  const csrf = req.headers['x-csrf-token'];
  // In a real implementation, you'd verify against a stored token
  // For now, just check it exists (client fetches it on load)
  return !!csrf;
}

// HTML sanitization for fullblog field
function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') return '';
  
  // Allowed tags and attributes for editorial content
  const allowedTags = ['p', 'b', 'i', 'em', 'strong', 'blockquote', 'a', 'ul', 'ol', 'li', 'h2', 'h3', 'br', 'hr'];
  const allowedAttrs = {
    'a': ['href', 'target', 'rel'],
    'blockquote': ['class']
  };
  
  // Simple regex-based sanitization (for production, use DOMPurify on server with JSDOM)
  // This is a basic implementation - replace with DOMPurify for production
  let sanitized = html;
  
  // Remove script tags and event handlers
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/on\w+="[^"]*"/gi, '');
  sanitized = sanitized.replace(/on\w+='[^']*'/gi, '');
  sanitized = sanitized.replace(/javascript:/gi, '');
  
  // Remove disallowed tags (keep content)
  const tagRegex = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
  sanitized = sanitized.replace(tagRegex, (match, tagName) => {
    if (allowedTags.includes(tagName.toLowerCase())) {
      // Clean attributes
      return match.replace(/\s+\w+="[^"]*"/g, (attr) => {
        const attrName = attr.match(/^\s+(\w+)=/)[1];
        if (allowedAttrs[tagName.toLowerCase()]?.includes(attrName.toLowerCase())) {
          return attr;
        }
        return '';
      });
    }
    // Remove tag but keep content
    return '';
  });
  
  return sanitized;
}

module.exports = async (req, res) => {
  // Optional auth
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
      // Support pagination and sorting
      const page = Math.max(1, parseInt(query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 50));
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      const sortBy = query.sortBy || 'publishdate';
      const sortOrder = query.sortOrder === 'asc' ? { ascending: true } : { ascending: false };
      
      // Get total count for pagination
      const { count, error: countError } = await supabase
        .from('articles')
        .select('*', { count: 'exact', head: true });
      if (countError) throw countError;
      
      // Fetch paginated, sorted articles
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .order(sortBy, sortOrder)
        .range(from, to);
      if (error) throw error;
      
      return res.json({
        articles: data || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      });
    }

    if (method === 'POST') {
      // CSRF validation
      if (!validateCsrf(req)) {
        return res.status(403).json({ error: 'CSRF token missing or invalid' });
      }
      
      // Create new article – client supplies fields used by admin UI
      const resolvedPublishDate = body.publishdate ? new Date(body.publishdate).toISOString() : new Date().toISOString();
      const payload = {
        ...body,
        fullblog: sanitizeHtml(body.fullblog || ''),
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
      // CSRF validation
      if (!validateCsrf(req)) {
        return res.status(403).json({ error: 'CSRF token missing or invalid' });
      }
      
      // Update existing article
      const sanitizedBody = { ...body, fullblog: sanitizeHtml(body.fullblog || '') };
      const { data, error } = await supabase
        .from('articles')
        .update(sanitizedBody)
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
