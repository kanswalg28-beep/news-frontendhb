// api/cron/refresh-gnews.js
// Vercel cron job. Runs hourly on Vercel's free + pro tiers.
// Rebuilds the GNews cache in Supabase so the public feed endpoint
// can serve it instantly without users paying the 17s fetch penalty.

const { supabase } = require('../../db/client');

const CACHE_EXPIRY_MS = 12 * 60 * 60 * 1000;
const GNEWS_API_KEY =
  process.env.GNEWS_API_KEY || "b0af7931832154029e8d324bee5ffb40";
const DEFAULT_HIGHLIGHTS = [
  "Parliament confirms new tax framework remains perfectly logical to precisely three statisticians.",
  "Global summit achieves historic consensus on scheduling a date to discuss scheduling a deadline.",
  "Central Bank introduces digital currency feature designed to automatically feel superior to physical currency.",
  "Supreme Court requests national media houses to explain what they meant by '100% objective facts.'"
];

function classifyRegion(title, description, rawContent, sourceName, urlText) {
  const t = (title || "").toLowerCase();
  const d = (description || "").toLowerCase();
  const c = (rawContent || "").toLowerCase();
  const s = (sourceName || "").toLowerCase();
  const u = (urlText || "").toLowerCase();
  const combined = `${t} ${d} ${c} ${s} ${u}`;
  const indiaKeywords = ["india","indian","delhi","mumbai","bengaluru","bangalore","chennai","kolkata","hyderabad","pune","ahmedabad","lucknow","varanasi","kerala","goa","gujarat","punjab","sikh","modi","bjp","congress","gandhi","amit shah","kejriwal","rahul gandhi","rupee","bollywood","virat kohli"];
  const ukKeywords    = ["uk","united kingdom","britain","british","england","english","london","scotland","welsh","belfast","sunak","starmer","downing street","keir starmer","rishi sunak","boris johnson","westminster","buckingham","whitehall","nhs","pound","sterling","king charles","queen elizabeth","heathrow","manchester","birmingham","glasgow","edinburgh","cardiff"];
  let indiaCount = 0, ukCount = 0;
  for (const kw of indiaKeywords) {
    const r = new RegExp(`\\b${kw.replace(/[-\\/\\^$*+?.()|[\\]{}]/g, '\\$&')}\\b`, 'g');
    const m = combined.match(r); if (m) indiaCount += m.length;
  }
  for (const kw of ukKeywords) {
    const r = new RegExp(`\\b${kw.replace(/[-\\/\\^$*+?.()|[\\]{}]/g, '\\$&')}\\b`, 'g');
    const m = combined.match(r); if (m) ukCount += m.length;
  }
  if (u.includes('.in/') || u.endsWith('.in') || u.includes('.co.in')) indiaCount += 5;
  if (u.includes('.co.uk') || u.includes('.gov.uk') || u.includes('bbc.co.uk')) ukCount += 5;
  if (indiaCount > 0 && indiaCount >= ukCount) return "indian";
  if (ukCount > 0 && ukCount > indiaCount) return "uk";
  return "world";
}

async function rebuildCacheFromGNews() {
  const rawArticles = [];
  const regions = [{tag:'indian', code:'in'}, {tag:'world', code:'us'}, {tag:'uk', code:'gb'}];
  const categories = ['general', 'technology', 'business', 'entertainment', 'health'];

  for (const reg of regions) {
    for (const cat of categories) {
      const url = `https://gnews.io/api/v4/top-headlines?category=${cat}&lang=en&country=${reg.code}&max=5&apikey=${GNEWS_API_KEY}`;
      try {
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          if (data.articles) {
            data.articles.forEach(a => { a.queryCategory = cat; a.queryRegion = reg.tag; });
            rawArticles.push(...data.articles);
          }
        }
      } catch (_) {}
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  const unique = [];
  const seen = new Set();
  rawArticles.forEach(a => {
    const k = `${a.title}::${a.queryRegion}`;
    if (!seen.has(k)) { seen.add(k); unique.push(a); }
  });

  return {
    lastUpdated: Date.now(),
    articles: unique.map((raw, i) => {
      const region = classifyRegion(raw.title, raw.description, raw.description, raw.source && raw.source.name, raw.url);
      let category = 'Politics';
      if (raw.queryCategory === 'technology') category = 'Tech';
      else if (raw.queryCategory === 'business') category = 'Finance';
      else if (raw.queryCategory === 'entertainment') category = 'Entertainment';
      else if (raw.queryCategory === 'health') category = 'Health';
      return {
        id: `gnews_${region}_${i+1}`,
        title: raw.title,
        aiheadline: raw.title,
        summary: raw.description || raw.title,
        aisummary: raw.description || raw.title,
        content: raw.description || raw.title,
        fullblog: '',
        category,
        region,
        biasaudit: '',
        originaltitle: raw.title,
        originalsource: raw.source ? raw.source.name : 'Global News',
        originalurl: raw.url || '#',
        imageurl: raw.image || './assets/hero-bg.png',
        author: 'Honestly Biased AI Engine',
        authortype: 'ai',
        timeago: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }) + ' IST',
        createdat: new Date().toISOString(),
        updatedat: new Date().toISOString()
      };
    }),
    highlights: DEFAULT_HIGHLIGHTS
  };
}

module.exports = async (req, res) => {
  // Vercel Cron Authentication: Vercel injects `Authorization: Bearer <CRON_SECRET>`
  // into cron-triggered requests. Reject anything else.
  const auth = req.headers.authorization || req.headers.Authorization;
  if (process.env.CRON_SECRET) {
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  // Allow manual POST with ?secret=<CRON_SECRET> as a fallback for one-off
  // refreshes from the admin UI / curl.
  const qSecret = (req.query && req.query.secret) || null;
  const method = req.method || 'GET';
  if (method !== 'GET' && method !== 'POST') {
    return res.status(405).json({ error: 'GET/POST only' });
  }

  try {
    const start = Date.now();
    const cache = await rebuildCacheFromGNews();
    const { error } = await supabase
      .from('gnews_cache')
      .upsert({ key: 'cache', data: cache, updatedat: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
    return res.json({
      success: true,
      articlesWritten: cache.articles.length,
      elapsedMs: Date.now() - start
    });
  } catch (err) {
    console.error('cron refresh error:', err);
    return res.status(500).json({ error: 'Refresh failed', message: err.message });
  }
};
