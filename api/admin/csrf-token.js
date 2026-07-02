// api/admin/csrf-token.js - CSRF token generation for admin panel
// Returns a cryptographically secure token for form submission validation

const crypto = require('crypto');

module.exports = async (req, res) => {
  // CORS for admin panel
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Generate a secure random token
    const token = crypto.randomBytes(32).toString('hex');
    
    // In production, you'd store this in a session/redis with expiry
    // For now, we return it and the client includes it in X-CSRF-Token header
    // Server validates by checking the token exists (stateless approach with short expiry)
    // Better: use signed cookies or JWT for true CSRF protection
    
    return res.json({ 
      token,
      expiresIn: 3600 // 1 hour
    });
  } catch (err) {
    console.error('CSRF token generation failed:', err);
    return res.status(500).json({ error: 'Failed to generate CSRF token' });
  }
};