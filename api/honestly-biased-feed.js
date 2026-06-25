const fetch = require('node-fetch');
const { supabase } = require('../db/client');
const path = require('path');

// Reuse helper functions from original mock-server (you may extract them to a shared module)
const CACHE_EXPIRY_MS = 12 * 60 * 60 * 1000; // 12 hours
const GNEWS_API_KEY = process.env.GNEWS_API_KEY || "b0af7931832154029e8d324bee5ffb40";
const defaultHighlights = [
  "Parliament confirms new tax framework remains perfectly logical to precisely three statisticians.",
  "Global summit achieves historic consensus on scheduling a date to discuss scheduling a deadline.",
  "Central Bank introduces digital currency feature designed to automatically feel superior to physical currency.",
  "Supreme Court requests national media houses to explain what they meant by '100% objective facts.'"
];

// Helper to get cache from Supabase
async function getCache() {
  const { data, error } = await supabase.from('gnews_cache').select('data').eq('key', 'cache').single();
  if (error || !data) return null;
  return data.data;
}

// Helper to upsert cache into Supabase
async function setCache(cache) {
  await supabase.from('gnews_cache').upsert({ key: 'cache', data: cache }, { onConflict: 'key' });
}

// Reuse classification logic (copy from original file)
function classifyRegion(title, description, rawContent, sourceName, urlText) {
  const titleText = (title || "").toLowerCase();
  const descText = (description || "").toLowerCase();
  const contentText = (rawContent || "").toLowerCase();
  const srcNameText = (sourceName || "").toLowerCase();
  const urlStr = (urlText || "").toLowerCase();
  const combinedText = `${titleText} ${descText} ${contentText} ${srcNameText} ${urlStr}`;
  const indiaKeywords = ["india","indian","delhi","mumbai","bengaluru","bangalore","chennai","kolkata","hyderabad","pune","ahmedabad","lucknow","varanasi","kerala","goa","gujarat","punjab","sikh","modi","bjp","congress","gandhi","amit shah","kejriwal","rahul gandhi","tvk","isro","rupee","bollywood","virat kohli","dhoni","rohit sharma","ipl","bcci"];
  const ukKeywords = ["uk","united kingdom","britain","british","england","english","london","scotland","scottish","wales","welsh","northern ireland","londoner","sunak","starmer","downing street","keir starmer","rishi sunak","boris johnson","westminster","buckingham","whitehall","nhs","pound","sterling","£","king charles","queen elizabeth","heathrow","gatwick","manchester","birmingham","leeds","glasgow","edinburgh","cardiff","belfast"];
  let indiaCount = 0, ukCount = 0;
  indiaKeywords.forEach(kw => { const regex = new RegExp(`\\b${kw.replace(/[-/\\^$*+?.()|[\\]{}]/g, '\\$&')}\\b`, 'g'); const matches = combinedText.match(regex); if (matches) indiaCount += matches.length; });
  ukKeywords.forEach(kw => { const regex = new RegExp(`\\b${kw.replace(/[-/\\^$*+?.()|[\\]{}]/g, '\\$&')}\\b`, 'g'); const matches = combinedText.match(regex); if (matches) ukCount += matches.length; });
  if (urlStr.includes('.in/') || urlStr.endsWith('.in') || urlStr.includes('.co.in')) indiaCount += 5;
  if (urlStr.includes('.co.uk') || urlStr.includes('.org.uk') || urlStr.includes('.gov.uk') || urlStr.includes('bbc.co.uk')) ukCount += 5;
  const indianSources = ["times of india","the hindu","indian express","hindustantimes","livemint","moneycontrol","ndtv","indiatoday","news18","new indian express","timesofindia"];
  const ukSources = ["bbc","the guardian","telegraph","independent","daily mail","mirror","sky news","bbc news"];
  indianSources.forEach(src => { if (srcNameText.includes(src) || urlStr.includes(src.replace(/\s+/g, ""))) indiaCount += 3; });
  ukSources.forEach(src => { if (srcNameText.includes(src) || urlStr.includes(src.replace(/\s+/g, ""))) ukCount += 3; });
  if (indiaCount > 0 && indiaCount >= ukCount) return "indian";
  if (ukCount > 0 && ukCount > indiaCount) return "uk";
  return "world";
}

// Fetch GNews and process (similar to original)
async function fetchAndAuditGNews() {
  let cache = await getCache();
  if (!cache) cache = { lastUpdated: 0, articles: [], highlights: defaultHighlights };
  const now = Date.now();
  if (cache.articles.length && (now - cache.lastUpdated) < CACHE_EXPIRY_MS) {
    console.log("⚡ Using fresh Supabase cache for GNews");
    return cache.articles;
  }
  console.log("📡 Cache expired, fetching GNews");
  try {
    const rawArticles = [];
    const regionsConfig = [{ tag: 'indian', code: 'in' }, { tag: 'world', code: 'us' }, { tag: 'uk', code: 'gb' }];
    const categories = ['general', 'technology', 'business', 'entertainment', 'health'];
    for (const reg of regionsConfig) {
      for (const cat of categories) {
        const url = `https://gnews.io/api/v4/top-headlines?category=${cat}&lang=en&country=${reg.code}&max=5&apikey=${GNEWS_API_KEY}`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          if (data.articles) {
            data.articles.forEach(a => { a.queryCategory = cat; a.queryRegion = reg.tag; });
            rawArticles.push(...data.articles);
          }
        }
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    const unique = [];
    const seen = new Set();
    rawArticles.forEach(a => {
      const key = `${a.title}::${a.queryRegion}`;
      if (!seen.has(key)) { seen.add(key); unique.push(a); }
    });
    const updated = [];
    for (let i = 0; i < unique.length; i++) {
      const raw = unique[i];
      const tempArticle = {
        id: i + 1,
        title: raw.title,
        source: raw.source ? raw.source.name : "Global News",
        rawContent: raw.description || raw.title,
        category: raw.queryCategory === 'technology' ? 'Tech' : raw.queryCategory === 'business' ? 'Finance' : raw.queryCategory === 'entertainment' ? 'Entertainment' : raw.queryCategory === 'health' ? 'Health' : 'Politics'
      };
      const aiOutput = {
        category: tempArticle.category,
        aiHeadline: tempArticle.title,
        aiSummary: tempArticle.rawContent,
        biasAudit: "",
        fullBlog: "",
        region: classifyRegion(raw.title, raw.description, raw.description, raw.source?.name, raw.url)
      };
      updated.push({
        id: `gnews_${aiOutput.region}_${i + 1}`,
        category: aiOutput.category,
        region: aiOutput.region,
        aiHeadline: aiOutput.aiHeadline,
        aiSummary: aiOutput.aiSummary,
        biasAudit: aiOutput.biasAudit,
        fullBlog: aiOutput.fullBlog,
        originalSource: tempArticle.source,
        originalTitle: raw.title,
        timeAgo: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }) + ' IST',
        author: "Honestly Biased AI Engine (Mock)",
        authorType: "ai",
        imageUrl: raw.image || "./assets/hero-bg.png",
        originalUrl: raw.url || "#"
      });
    }
    cache.lastUpdated = now;
    cache.articles = updated;
    await setCache(cache);
    return updated;
  } catch (e) {
    console.error('❌ fetchAndAuditGNews error:', e);
    return cache.articles || [];
  }
}

module.exports = async (req, res) => {
  try {
    const processedArticles = await fetchAndAuditGNews();
    // Load custom articles from Supabase
    const { data: customArticles } = await supabase.from('articles').select('*');
    const allArticles = (customArticles || []).concat(processedArticles);
    const rhetoricMeterData = {
      hyperbolePercentage: "84.2%",
      yoyGrowth: "+12.4%",
      aiAnalysis: "Prime-time coverage monitored today reveals a severe spike in hyperbolic sensationalism as legacy newsrooms attempt to mask policy concessions behind corporate volume."
    };
    res.json({
      rhetoricMeter: rhetoricMeterData,
      articles: allArticles,
      highlights: defaultHighlights
    });
  } catch (err) {
    console.error('Endpoint error:', err);
    res.status(500).json({ error: 'Internal server error assembling content feed' });
  }
};
