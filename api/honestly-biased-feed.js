const { supabase } = require('../db/client');

const CACHE_EXPIRY_MS = 12 * 60 * 60 * 1000; // 12 hours
const GNEWS_API_KEY = process.env.GNEWS_API_KEY || "b0af7931832154029e8d324bee5ffb40";
const DEFAULT_HIGHLIGHTS = [
  "Parliament confirms new tax framework remains perfectly logical to precisely three statisticians.",
  "Global summit achieves historic consensus on scheduling a date to discuss scheduling a deadline.",
  "Central Bank introduces digital currency feature designed to automatically feel superior to physical currency.",
  "Supreme Court requests national media houses to explain what they meant by '100% objective facts.'"
];

// Cache the latest refresh-in-flight so we only do ONE GNews burst at a time.
let refreshInFlight = null;

async function getCache() {
  const { data, error } = await supabase
    .from('gnews_cache')
    .select('data, updatedat')
    .eq('key', 'cache')
    .single();
  if (error || !data) return null;
  return data.data || null;
}

async function setCache(cache) {
  await supabase
    .from('gnews_cache')
    .upsert({ key: 'cache', data: cache, updatedat: new Date().toISOString() }, { onConflict: 'key' });
}

async function getCustomArticles() {
  const { data } = await supabase
    .from('articles')
    .select('*');
  return data || [];
}

function classifyRegion(title, description, rawContent, sourceName, urlText) {
  const titleText = (title || "").toLowerCase();
  const descText = (description || "").toLowerCase();
  const contentText = (rawContent || "").toLowerCase();
  const srcNameText = (sourceName || "").toLowerCase();
  const urlStr = (urlText || "").toLowerCase();

  const indiaKeywords = ["india","indian","delhi","mumbai","bengaluru","bangalore","chennai","kolkata","hyderabad","pune","ahmedabad","lucknow","varanasi","kerala","goa","gujarat","punjab","sikh","modi","bjp","congress","gandhi","amit shah","kejriwal","rahul gandhi","rupee","bollywood","virat kohli"];
  const ukKeywords = ["uk","united kingdom","britain","british","england","english","london","scotland","welsh","belfast","sunak","starmer","downing street","keir starmer","rishi sunak","boris johnson","westminster","buckingham","whitehall","nhs","pound","sterling","king charles","queen elizabeth","heathrow","manchester","birmingham","glasgow","edinburgh","cardiff"];
  const berkshireKeywords = ["berkshire", "reading", "slough", "maidenhead", "windsor", "newbury", "bracknell", "wokingham", "earley", "woodley", "twenty", "crowthorne", "sandhurst", "thames valley", "m4 corridor", "royal borough", "legoland", "microsoft reading", "oracle reading", "berkshire county", "west berkshire"];

  let indiaCount = 0, ukCount = 0, berkshireCount = 0;
  const combined = `${titleText} ${descText} ${contentText} ${srcNameText} ${urlStr}`;
  
  indiaKeywords.forEach(kw => { 
    const r = new RegExp(`\\b${kw.replace(/[-\\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'g'); 
    const m = combined.match(r); 
    if (m) indiaCount += m.length; 
  });
  
  ukKeywords.forEach(kw => { 
    const r = new RegExp(`\\b${kw.replace(/[-\\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'g'); 
    const m = combined.match(r); 
    if (m) ukCount += m.length; 
  });
  
  berkshireKeywords.forEach(kw => { 
    const r = new RegExp(`\\b${kw.replace(/[-\\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'g'); 
    const m = combined.match(r); 
    if (m) berkshireCount += m.length; 
  });
  
  if (urlStr.includes('.in/') || urlStr.endsWith('.in') || urlStr.includes('.co.in')) indiaCount += 5;
  if (urlStr.includes('.co.uk') || urlStr.includes('.gov.uk') || urlStr.includes('bbc.co.uk')) ukCount += 5;
  if (urlStr.includes('berkshire') || urlStr.includes('reading') || urlStr.includes('windsor')) berkshireCount += 5;
  
  if (indiaCount > 0 && indiaCount >= ukCount && indiaCount >= berkshireCount) return "indian";
  if (ukCount > 0 && ukCount > indiaCount && ukCount >= berkshireCount) return "uk";
  if (berkshireCount > 0 && berkshireCount > indiaCount && berkshireCount > ukCount) return "berkshire";
  return "world";
}

// Build cache by hitting GNews. Long-running (15 sequential calls).
// Only called from the background refresh path.
async function rebuildCacheFromGNews() {
  const rawArticles = [];
  const regions = [{tag:'indian', code:'in'}, {tag:'world', code:'us'}, {tag:'uk', code:'gb'}, {tag:'berkshire', code:'berkshire'}];
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
      } catch (_) { /* skip this region/cat */ }
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Dedup by title+region
  const unique = [];
  const seen = new Set();
  rawArticles.forEach(a => {
    const k = `${a.title}::${a.queryRegion}`;
    if (!seen.has(k)) { seen.add(k); unique.push(a); }
  });

  const cache = {
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
        publishdate: raw.publishedAt ? new Date(raw.publishedAt).toISOString() : new Date().toISOString(),
        timeago: new Date(raw.publishedAt || Date.now()).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }) + ' IST',
        createdat: new Date().toISOString(),
        updatedat: new Date().toISOString()
      };
    }),
    highlights: DEFAULT_HIGHLIGHTS
  };
  return cache;
}

// Trigger a cache rebuild, but share the promise so concurrent requests
// don't each trigger their own slow burst.
function triggerBackgroundRefresh() {
  if (refreshInFlight) return refreshInFlight;
  console.log("📡 Triggering background GNews cache refresh");
  refreshInFlight = (async () => {
    try {
      const newCache = await rebuildCacheFromGNews();
      await setCache(newCache);
      return newCache;
    } catch (e) {
      console.error('Background refresh failed:', e && e.message ? e.message : e);
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

module.exports = async (req, res) => {
  try {
    // FAST PATH: serve whatever is in the cache NOW. Never blocks on GNews.
    const cache = await getCache();
    const customArticles = await getCustomArticles();

    const GNEWS_ENABLED = false; // Set to true to re-enable in future

    if (!GNEWS_ENABLED) {
      return res.json({
        rhetoricMeter: {
          hyperbolePercentage: "84.2%",
          yoyGrowth: "+12.4%",
          aiAnalysis: "Prime-time coverage monitored today reveals a severe spike in hyperbolic sensationalism as legacy newsrooms attempt to mask policy concessions behind corporate volume."
        },
        articles: customArticles,
        highlights: DEFAULT_HIGHLIGHTS
      });
    }

    if (!cache || !cache.articles || cache.articles.length === 0) {
      // No cache yet. Return custom articles only so the page is never empty.
      // Kick off a background refresh; the next request will have a populated cache.
      triggerBackgroundRefresh();
      return res.json({
        rhetoricMeter: {
          hyperbolePercentage: "84.2%",
          yoyGrowth: "+12.4%",
          aiAnalysis: "No live feed cached yet — background refresh in progress. Showing your curated CMS articles."
        },
        articles: customArticles,
        highlights: DEFAULT_HIGHLIGHTS
      });
    }

    const ageMs = Date.now() - (cache.lastUpdated || 0);
    if (ageMs >= CACHE_EXPIRY_MS) {
      // Cache stale — trigger a background refresh so the NEXT request is fresh,
      // but STILL return the current cache now so this request is fast.
      triggerBackgroundRefresh();
    }

    const allArticles = customArticles.concat(cache.articles || []);

    return res.json({
      rhetoricMeter: {
        hyperbolePercentage: "84.2%",
        yoyGrowth: "+12.4%",
        aiAnalysis: "Prime-time coverage monitored today reveals a severe spike in hyperbolic sensationalism as legacy newsrooms attempt to mask policy concessions behind corporate volume."
      },
      articles: allArticles,
      highlights: cache.highlights || DEFAULT_HIGHLIGHTS
    });
  } catch (err) {
    console.error('Endpoint error:', err);
    res.status(500).json({ error: 'Internal server error assembling content feed' });
  }
};