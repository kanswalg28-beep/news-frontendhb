// api/admin/instagram.js - Instagram automation: config, sync, simulate

const { supabase } = require('../../db/client');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const CONFIG_TABLE = 'instagram_config';
const LOGS_TABLE = 'instagram_logs';

const mockCaptions = [
  "Why Bangalore VCs are funding edge-computing soil sensors instead of basic water pipelines for dryland farmers.",
  "A food delivery aggregator app rolls out a 2-minute wellness checkup for delivery riders to optimize their performance while avoiding basic medical insurance liabilities.",
  "A consulting giant HR team pioneers the revolutionary strategy of scheduling pre-meetings to prepare for the planning sessions.",
  "Ministry of Digital Coordination launches a new digital dashboard to track the progress of other digital dashboards.",
  "Legacy prime-time newsroom holds a 1-hour panel debate on whether social media comedy reels are destroying journalistic objectivity."
];

const mockShortcodes = ["CP84tADtE4g", "C-19t_5uF6n", "C5y2G42t7gB", "C844oV6t9gA", "C9-y4x2t1a8"];

async function logMessage(message) {
  if (!supabase) return;
  try {
    await supabase.from(LOGS_TABLE).insert({
      message,
      created_at: new Date().toISOString()
    });
  } catch (e) {
    console.error('Log insert failed:', e);
  }
}

function validateAuth(req) {
  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) return true;
  
  const authHeader = req.headers['authorization'];
  if (!authHeader) return false;
  
  try {
    const decoded = Buffer.from(authHeader.split(' ')[1], 'base64').toString();
    const [user, pass] = decoded.split(':');
    return user === process.env.ADMIN_USERNAME && pass === process.env.ADMIN_PASSWORD;
  } catch (e) {
    return false;
  }
}

function validateCsrf(req) {
  return !!req.headers['x-csrf-token'];
}

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

async function generateArticleFromCaption(caption, shortcode) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) return null;
  
  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      You are the Head Editorial AI for "Honestly Biased", an independent Indian media platform.
      Transform this Instagram reel caption into a satirical news article.
      
      Instagram Caption: "${caption}"
      Shortcode: ${shortcode}
      
      Return JSON:
      {
        "category": "Politics|Tech|Finance|Entertainment|Health",
        "region": "indian|world|uk",
        "aiHeadline": "Satirical headline",
        "aiSummary": "2-sentence summary with bias",
        "biasAudit": "1-sentence structural critique",
        "fullBlog": "Full HTML blog post (3-4 paragraphs)"
      }
    `;

    const result = await model.generateContent(prompt);
    const aiOutput = JSON.parse(result.response.text());
    
    return {
      ...aiOutput,
      authortype: 'instagram',
      author: 'Instagram Reel → HB AI',
      originalsource: 'Instagram Reel',
      originalurl: `https://www.instagram.com/p/${shortcode}/`,
      imageurl: './assets/hero-bg.png',
      publishdate: new Date().toISOString(),
      timeago: new Date().toLocaleTimeString('en-IN', { 
        timeZone: 'Asia/Kolkata', 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: true 
      }) + ' IST'
    };
  } catch (err) {
    console.error('Gemini generation failed:', err);
    return null;
  }
}

async function createMockArticle(shortcode, caption) {
  const regions = ['indian', 'world', 'uk'];
  const categories = ['Politics', 'Tech', 'Finance', 'Entertainment', 'Health'];
  
  return {
    category: categories[Math.floor(Math.random() * categories.length)],
    region: regions[Math.floor(Math.random() * regions.length)],
    aiHeadline: `Simulated: ${caption.slice(0, 60)}...`,
    aiSummary: `This simulated article was generated from Instagram reel ${shortcode}. ${caption}`,
    biasAudit: 'Simulation bypasses real AI audit — this is a test article.',
    fullBlog: `<p class="blog-lead">Simulation mode active. Original Instagram caption: "${caption}"</p><p>This article was generated by the Instagram automation simulator for testing purposes.</p>`,
    authortype: 'instagram',
    author: 'Instagram Reel → HB AI (Simulated)',
    originalsource: 'Instagram Reel',
    originalurl: `https://www.instagram.com/p/${shortcode}/`,
    imageurl: './assets/hero-bg.png',
    publishdate: new Date().toISOString(),
    timeago: new Date().toLocaleTimeString('en-IN', { 
      timeZone: 'Asia/Kolkata', 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: true 
    }) + ' IST'
  };
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Auth check
  if (!validateAuth(req)) {
    res.setHeader('WWW-Authenticate', 'Basic realm="CMS Admin"');
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!supabase) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  // Route based on path (e.g., /api/admin/instagram/sync) or action parameter
  const url = req.url || '';
  const method = req.method;
  let action = req.query.action || req.body?.action;
  
  // Extract action from path: /api/admin/instagram/config, /api/admin/instagram/sync, /api/admin/instagram/simulate
  const pathMatch = url.match(/\/api\/admin\/instagram\/(config|sync|simulate)/);
  if (pathMatch) {
    action = pathMatch[1];
  }

  try {
    // GET /api/admin/instagram?action=config - Get config + logs
    if (method === 'GET' && action === 'config') {
      const { data, error } = await supabase.from(CONFIG_TABLE).select('*').limit(1).single();
      if (error && error.code !== 'PGRST116') throw error;
      
      const config = data || { connected: false, handle: '', rssUrl: '', updatedAt: null };
      
      const { data: logs } = await supabase
        .from(LOGS_TABLE)
        .select('message, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      
      return res.json({ 
        config,
        logs: logs ? logs.map(l => `${l.created_at} ${l.message}`).reverse() : []
      });
    }

    // POST /api/admin/instagram?action=config - Update config
    if (method === 'POST' && action === 'config') {
      const { handle, rssUrl, connected } = req.body || {};
      
      // Validate RSS URL (SSRF prevention)
      if (rssUrl && connected !== false) {
        try {
          const url = new URL(rssUrl);
          if (!['http:', 'https:'].includes(url.protocol)) {
            return res.status(400).json({ error: 'RSS URL must use HTTP or HTTPS' });
          }
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
        .from(CONFIG_TABLE)
        .upsert(updates, { onConflict: 'id' })
        .select()
        .single();

      if (error) throw error;

      await logMessage(connected ? `Connected handle: ${handle}` : 'Disconnected Instagram automation');
      return res.json({ ok: true, config: data });
    }

    // POST /api/admin/instagram?action=sync - Manual sync
    if (method === 'POST' && action === 'sync') {
      if (!validateCsrf(req)) {
        return res.status(403).json({ error: 'CSRF token missing' });
      }

      const { data: config } = await supabase
        .from(CONFIG_TABLE)
        .select('*')
        .limit(1)
        .single();

      if (!config || !config.connected) {
        return res.status(400).json({ error: 'Instagram not connected' });
      }

      await logMessage('[Sync] Manual sync triggered by admin');
      await logMessage('[Sync] Polling RSS feed... (simulated)');
      
      // In production: fetch RSS, parse items, create articles via Gemini
      // For now, simulate success
      await logMessage('[Sync] Completed successfully (simulated)');
      
      return res.json({ 
        message: 'Sync executed (simulated). Check logs for details.',
        syncedAt: new Date().toISOString()
      });
    }

    // POST /api/admin/instagram?action=simulate - Simulate webhook
    if (method === 'POST' && action === 'simulate') {
      if (!validateCsrf(req)) {
        return res.status(403).json({ error: 'CSRF token missing' });
      }

      await logMessage('[Simulate] Manual simulation triggered by admin');

      const idx = Math.floor(Math.random() * mockCaptions.length);
      const shortcode = mockShortcodes[idx];
      const caption = mockCaptions[idx];

      // Try AI generation, fallback to mock
      let articleData = await generateArticleFromCaption(caption, shortcode);
      if (!articleData) {
        articleData = await createMockArticle(shortcode, caption);
      }

      const { data: saved, error } = await supabase
        .from('articles')
        .insert(articleData)
        .select()
        .single();

      if (error) throw error;

      await logMessage(`[Simulate] Created article: ${saved.aiheadline}`);
      
      return res.json({ 
        message: 'Simulation executed successfully',
        article: saved
      });
    }

    // Unsupported action
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Invalid action. Use ?action=config|sync|simulate' });

  } catch (err) {
    console.error('Instagram API error:', err);
    await logMessage(`[Error] ${err.message}`);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
};