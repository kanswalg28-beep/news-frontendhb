// api/admin/instagram/simulate.js - Simulate Instagram webhook for testing

const { supabase } = require('../../db/client');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const mockCaptions = [
  "Why Bangalore VCs are funding edge-computing soil sensors instead of basic water pipelines for dryland farmers.",
  "A food delivery aggregator app rolls out a 2-minute wellness checkup for delivery riders to optimize their performance while avoiding basic medical insurance liabilities.",
  "A consulting giant HR team pioneers the revolutionary strategy of scheduling pre-meetings to prepare for the planning sessions.",
  "Ministry of Digital Coordination launches a new digital dashboard to track the progress of other digital dashboards.",
  "Legacy prime-time newsroom holds a 1-hour panel debate on whether social media comedy reels are destroying journalistic objectivity."
];

const mockShortcodes = ["CP84tADtE4g", "C-19t_5uF6n", "C5y2G42t7gB", "C844oV6t9gA", "C9-y4x2t1a8"];

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
    // Log simulation start
    await supabase.from('instagram_logs').insert({
      message: '[Simulate] Manual simulation triggered by admin',
      created_at: new Date().toISOString()
    });

    // Pick random mock data
    const idx = Math.floor(Math.random() * mockCaptions.length);
    const shortcode = mockShortcodes[idx];
    const caption = mockCaptions[idx];

    const mediaId = `ig_reel_${Date.now()}`;
    const permalink = `https://www.instagram.com/p/${shortcode}/`;

    // If GEMINI_API_KEY is set, use real AI to generate satirical article
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    let articleData = null;

    if (GEMINI_API_KEY) {
      try {
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ 
          model: "gemini-3.5-flash",
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
        
        articleData = {
          ...aiOutput,
          authortype: 'instagram',
          author: 'Instagram Reel → HB AI',
          originalsource: 'Instagram Reel',
          originalurl: permalink,
          imageurl: './assets/hero-bg.png',
          publishdate: new Date().toISOString(),
          timeago: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }) + ' IST'
        };
      } catch (aiErr) {
        console.error('Gemini simulation failed:', aiErr);
        // Fall through to mock
      }
    }

    // Fallback mock article
    if (!articleData) {
      const regions = ['indian', 'world', 'uk'];
      const categories = ['Politics', 'Tech', 'Finance', 'Entertainment', 'Health'];
      
      articleData = {
        category: categories[Math.floor(Math.random() * categories.length)],
        region: regions[Math.floor(Math.random() * regions.length)],
        aiHeadline: `Simulated: ${caption.slice(0, 60)}...`,
        aiSummary: `This simulated article was generated from Instagram reel ${shortcode}. ${caption}`,
        biasAudit: 'Simulation bypasses real AI audit — this is a test article.',
        fullBlog: `<p class="blog-lead">Simulation mode active. Original Instagram caption: "${caption}"</p><p>This article was generated by the Instagram automation simulator for testing purposes.</p>`,
        authortype: 'instagram',
        author: 'Instagram Reel → HB AI (Simulated)',
        originalsource: 'Instagram Reel',
        originalurl: permalink,
        imageurl: './assets/hero-bg.png',
        publishdate: new Date().toISOString(),
        timeago: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }) + ' IST'
      };
    }

    // Insert into articles table
    const { data: saved, error } = await supabase
      .from('articles')
      .insert(articleData)
      .select()
      .single();

    if (error) throw error;

    await supabase.from('instagram_logs').insert({
      message: `[Simulate] Created article: ${saved.aiheadline}`,
      created_at: new Date().toISOString()
    });

    return res.json({ 
      message: 'Simulation executed successfully',
      article: saved
    });

  } catch (err) {
    console.error('Simulation error:', err);
    await supabase.from('instagram_logs').insert({
      message: `[Simulate] Error: ${err.message}`,
      created_at: new Date().toISOString()
    });
    return res.status(500).json({ error: err.message || 'Simulation failed' });
  }
};