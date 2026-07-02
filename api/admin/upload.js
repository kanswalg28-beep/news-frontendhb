// api/admin/upload.js - Server-side image upload to Supabase Storage
// Replaces client-side base64 data URLs with proper CDN-hosted images

const { supabase } = require('../../db/client');

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const BUCKET = 'article-images'; // Must exist in Supabase Storage

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Basic auth check (same pattern as other admin endpoints)
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
    return res.status(503).json({ error: 'Storage not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.' });
  }

  try {
    // Parse multipart form data
    // Note: Vercel serverless functions need special handling for multipart
    // For simplicity, we'll use a basic parser - in production use busboy or formidable
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return res.status(400).json({ error: 'Content-Type must be multipart/form-data' });
    }

    // Simple multipart parser for serverless (handles single file)
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    const body = buffer.toString('binary');
    
    // Extract boundary
    const boundaryMatch = contentType.match(/boundary=([^;]+)/);
    if (!boundaryMatch) return res.status(400).json({ error: 'No boundary in multipart' });
    const boundary = boundaryMatch[1];
    
    // Parse parts
    const parts = body.split(`--${boundary}`).map(p => p.trim()).filter(p => p && p !== '--');
    
    let fileBuffer = null;
    let fileName = null;
    let fileType = null;
    
    for (const part of parts) {
      const headerEnd = part.indexOf('\r\n\r\n');
      if (headerEnd === -1) continue;
      const headers = part.slice(0, headerEnd);
      const content = part.slice(headerEnd + 4);
      
      if (headers.includes('name="image"')) {
        // Extract filename and content-type from headers
        const fileNameMatch = headers.match(/filename="([^"]+)"/);
        const contentTypeMatch = headers.match(/Content-Type: ([^\r\n]+)/);
        
        fileName = fileNameMatch ? fileNameMatch[1] : 'upload';
        fileType = contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream';
        
        // Convert content to buffer (remove trailing \r\n)
        const cleanContent = content.endsWith('\r\n') ? content.slice(0, -2) : content;
        fileBuffer = Buffer.from(cleanContent, 'binary');
      }
    }
    
    if (!fileBuffer) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    
    // Validate
    if (!ALLOWED_TYPES.includes(fileType)) {
      return res.status(400).json({ error: `Invalid file type: ${fileType}. Allowed: ${ALLOWED_TYPES.join(', ')}` });
    }
    if (fileBuffer.length > MAX_SIZE) {
      return res.status(400).json({ error: `File too large: ${(fileBuffer.length/1024/1024).toFixed(2)}MB. Max: ${MAX_SIZE/1024/1024}MB` });
    }
    
    // Generate unique filename
    const ext = fileName.split('.').pop().toLowerCase();
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 10);
    const storagePath = `articles/${timestamp}-${random}.${ext}`;
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: fileType,
        cacheControl: '3600',
        upsert: false
      });
    
    if (error) {
      console.error('Supabase upload error:', error);
      // If bucket doesn't exist, try to create it
      if (error.message.includes('not found') || error.message.includes('does not exist')) {
        const { error: createError } = await supabase.storage.createBucket(BUCKET, { public: true });
        if (createError) {
          return res.status(500).json({ error: `Bucket creation failed: ${createError.message}` });
        }
        // Retry upload
        const { data: retryData, error: retryError } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, fileBuffer, { contentType: fileType, cacheControl: '3600' });
        if (retryError) return res.status(500).json({ error: retryError.message });
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
        return res.json({ url: urlData.publicUrl, path: storagePath });
      }
      return res.status(500).json({ error: error.message });
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    
    return res.json({ 
      url: urlData.publicUrl,
      path: storagePath,
      size: fileBuffer.length,
      type: fileType
    });
    
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: err.message || 'Upload failed' });
  }
};