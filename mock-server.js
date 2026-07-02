/* ==========================================================================
   HONESTLY BIASED - PRODUCTION BACKEND SERVER WITH GEMINI API
   Technology: Node.js (Express)
   SDK: @google/generative-ai
   Description: Connects directly to the live Google Gemini API pipeline to
                audit corporate news feeds, rewrite headers satrically, and
                evaluate editorial narrative bias on-the-fly.
   ========================================================================== */

const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');
const compression = require('compression');
const { rateLimit } = require('express-rate-limit');
require('dotenv').config(); // Loads environment variables from a .env file if present

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// Enable gzip/brotli compression for public page speed optimization
app.use(compression());

// Define rate limiters for public endpoints
const publicApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 150, // limit each IP to 150 requests per windowMs
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: "Too many requests from this IP. Please try again after 15 minutes." }
});

const submissionLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    limit: 10, // limit each IP to 10 submissions per minute (votes/newsletters)
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: "Too many submissions. Please wait a minute and try again." }
});

const adminAuthLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    limit: 1000, // limit each IP to 1000 administrative requests per 10 minutes to support active dashboard polling
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: "Too many administrative requests. Access temporarily locked."
});

// Enable CORS for frontend accessibility during local development
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

app.use(express.json());

// Administrative Basic Authentication Middleware for CMS Locking
function basicAuth(req, res, next) {
    const adminUser = process.env.ADMIN_USERNAME || "admin";
    const adminPass = process.env.ADMIN_PASSWORD || "honestlybiased123";

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Honestly Biased CMS Admin"');
        return res.status(401).send('Authentication required.');
    }

    try {
        const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
        const user = auth[0];
        const pass = auth[1];

        if (user === adminUser && pass === adminPass) {
            return next();
        }
    } catch (err) {
        console.error("Authentication parsing failed:", err);
    }

    res.setHeader('WWW-Authenticate', 'Basic realm="Honestly Biased CMS Admin"');
    return res.status(401).send('Authentication credentials invalid.');
}

// Dedicated Admin CMS Portal Router: map /admin to serve admin.html
app.get('/admin', adminAuthLimiter, basicAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Serve static frontend template files directly from the Express server!
// This solves local browser CORS blocks when loading WebGL image textures.
app.use(express.static(__dirname));

// Gracefully redirect any accidental or malformed subdirectory requests for index.html back to the root
app.use((req, res, next) => {
    if (req.path.endsWith('/index.html') && req.path !== '/index.html') {
        console.log(`🔀 Redirecting accidental path request "${req.path}" to root /index.html`);
        return res.redirect('/index.html');
    }
    next();
});


// ==========================================================================
// 1. INITIALIZE LIVE GOOGLE GENERATIVE AI SDK
// ==========================================================================
const API_KEY = process.env.GEMINI_API_KEY;
let genAI = null;
let liveModel = null;

if (API_KEY) {
    console.log("🟢 GEMINI_API_KEY detected. Initializing live Google GenAI pipeline...");
    genAI = new GoogleGenerativeAI(API_KEY);
    
    // Using the cutting-edge 'gemini-3.5-flash' model requested by the user.
    liveModel = genAI.getGenerativeModel({
        model: "gemini-3.5-flash",
        generationConfig: { responseMimeType: "application/json" }
    });
} else {
    console.log("\n=============================================================");
    console.log("⚠️  WARNING: GEMINI_API_KEY environment variable is not defined.");
    console.log("👉 The server will automatically run in MOCK AI Fallback Mode.");
    console.log("👉 To enable live AI, run: $env:GEMINI_API_KEY='your_key' (Windows)");
    console.log("=============================================================\n");
}

// ==========================================================================
// 2. RAW NEWS FEED DATABASE (Ingestion input mock)
// ==========================================================================
const rawIncomingNews = [];

const defaultHighlights = [
    "Parliament confirms new tax framework will remain perfectly logical to precisely three statisticians.",
    "Global summit achieves historic consensus on scheduling a date to discuss scheduling a deadline.",
    "Central Bank introduces digital currency feature designed to automatically feel superior to physical currency.",
    "Supreme Court requests national media houses to explain what they meant by '100% objective facts.'"
];

// ==========================================================================
// 3. CORE AI RUNNER: PIPELINES TO THE LIVE GEMINI API
// ==========================================================================
async function runActualGeminiAPI(rawArticle) {
    if (!liveModel) return runMockGeminiAI(rawArticle);

    const systemPrompt = `
        You are the Head Editorial AI for "Honestly Biased", an independent digital media news commentary, media audit, and satire platform in India.
        Your brand critiques the traditional myth of "objective neutral news" by openly exposing the underlying corporate interest, operational spin, or policy loopholes, delivering transparent, sharp, wittily opinionated perspectives.

        Take this raw, dry news item:
        Original Source: ${rawArticle.source}
        Headline: "${rawArticle.title}"
        Details: "${rawArticle.rawContent}"

        Analyze the text and return a JSON object following this strict schema:
        {
            "category": "Politics" or "Tech" or "Finance" or "Entertainment" or "Health",
            "region": "indian" or "uk" or "world",
            "aiHeadline": "A highly sharp, wittily satirical, and self-aware headline rewriting the corporate spin",
            "aiSummary": "Facts summarized in exactly 2 sentences, written with transparent critical bias, dry humor, and absolute clarity",
            "biasAudit": "A 1-sentence analytical audit explaining the specific institutional or corporate bias/incentive in the original piece",
            "fullBlog": "A detailed, engaging satirical blog post of 3-4 paragraphs (approx 200-350 words) written with dry wit, deep-dive media critique, and transparent bias. Explain the structural incentives of the parties involved."
        }

        Classification instructions for the "region" property:
        - "indian": Assign ONLY if the news content is directly related to India (e.g. Indian politicians, Indian companies, Indian events, Indian cities, Indian culture, etc.)
        - "uk": Assign ONLY if the news content is directly related to Britain/UK (e.g. British politics, UK economy, London, UK organizations, etc.)
        - "world": Assign if the news is NOT directly related to India or the UK (e.g. US elections, European events, global science/technology news, etc.)

        Important: Return a clean JSON object. Do not wrap in markdown or backticks. Double check that keys match the schema exactly.
    `;

    try {
        console.log(`📡 Querying Gemini 3.5 Flash for Article ID ${rawArticle.id}...`);
        const result = await liveModel.generateContent(systemPrompt);
        const text = result.response.text();
        
        // Parse the strict JSON return
        const aiOutput = JSON.parse(text);
        console.log(`✨ Gemini processed successfully: "${aiOutput.aiHeadline}"`);
        return aiOutput;
    } catch (err) {
        if (err.status === 429 || (err.message && err.message.includes("429"))) {
            console.log(`⚠️  Gemini API Rate Limit Exceeded (429) for Article ID ${rawArticle.id}. Using mock fallback.`);
        } else {
            console.error(`❌ Gemini API call failed for Article ID ${rawArticle.id}. Using mock fallback.`, err.message || err);
        }
        return runMockGeminiAI(rawArticle);
    }
}

// ==========================================================================
// 4. MOCK FALLBACK: RUNS IF NO API KEY IS PROVIDED
// ==========================================================================
function runMockGeminiAI(rawArticle) {
    const simulationEngine = {
        1: {
            category: "Politics",
            aiHeadline: "FinMin Confirms New Tax Framework Remains Perfectly Logical to Precisely Three Statisticians",
            aiSummary: "The Ministry of Finance has successfully updated the national tax bureaucracy. The revised forms are designed to optimize reporting speeds, ensuring that only specialized algorithms can successfully file them.",
            biasAudit: "Ministers frame procedural hurdles as 'efficiency improvements' to mask standard operational overhead.",
            fullBlog: "<p class=\"blog-lead\">In a triumph of state-level planning, the Ministry of Finance has successfully completed its latest rewrite of the national tax codes.</p><p>While initial press coverage has lauded the change as an 'efficiency upgrade' meant to modernize the filings loop, a closer audit reveals the true intent: creating administrative compliance overhead that only specialized algorithms and multi-national accounting syndicates can successfully file.</p><p class=\"blog-analysis-heading\"><strong>The Honestly Biased Audit:</strong></p><blockquote>Ministers frame procedural hurdles as 'efficiency improvements' to mask standard operational overhead.</blockquote><p>By framing the increasing difficulty of citizen filing as a technical modernization, the department shifts the labor burden onto the individual taxpayer while simultaneously protecting the high-fee advisory market. Our tax systems remain completely logical—provided you hold a doctorate in advanced statistics.</p>"
        },
        2: {
            category: "Politics",
            aiHeadline: "Consent Under the Microscope: Startup Panic Climbs Over DPDP Compliance Hurdles",
            aiSummary: "Tech startups are suddenly discovering that acquiring 'explicit user consent' is a massive operational headache when they actually have to disclose their backend monetisation pipelines. The Bangalore tech hub is scrambling for regulatory loopholes.",
            biasAudit: "Corporate platforms frame user privacy compliance as an 'innovation tax' to protect high-margin ad trackers.",
            fullBlog: "<p class=\"blog-lead\">Bangalore's premium startup boardrooms are in a state of high operational alert this week following new DPDP directives.</p><p>For years, user consent was treated as a tiny checkbox at the bottom of a ten-page terms document. Now, as regulators require explicit, line-item disclosures of exactly which third-party brokers receive user data, startup founders are warning that privacy standards threaten the very survival of the local tech ecosystem.</p><p class=\"blog-analysis-heading\"><strong>The Honestly Biased Audit:</strong></p><blockquote>Corporate platforms frame user privacy compliance as an 'innovation tax' to protect high-margin ad trackers.</blockquote><p>The panic is not about paperwork, but about transparency. Disclosing to users that their search profiles are packaged and auctioned to corporate ad-tech networks exposes the high-margin monetisation strategies that underwrite startup valuations. Protecting user privacy is suddenly framed as an 'anti-innovation tax' by platforms whose primary innovation was evading regulation.</p>"
        },
        3: {
            category: "Tech",
            aiHeadline: "The Agri-Tech Bubble: Edge-Computing Moisture Sensors Sold to Farmers Lacking Basic Water Pipelines",
            aiSummary: "Venture capitalists have successfully dumped $40 million into high-tech soil monitoring sensors. The startup is prioritizing machine-learning algorithms over basic, physical water irrigation structures in drought districts.",
            biasAudit: "VC narrative prioritizes selling proprietary AI sensors to smallholders before sorting basic agricultural resources.",
            fullBlog: "<p class=\"blog-lead\">A venture-backed agri-tech startup has announced a landmark funding round to deploy smart edge-computing moisture sensors across regional drought belts.</p><p>The company claims its predictive AI models will allow smallholders to optimize water utilization by up to fifteen percent. What the press release carefully avoids mentioning is that the target agricultural districts currently lack functional water canals, basic storage reservoirs, or reliable power grids to run the sensors.</p><p class=\"blog-analysis-heading\"><strong>The Honestly Biased Audit:</strong></p><blockquote>VC narrative prioritizes selling proprietary AI sensors to smallholders before sorting basic agricultural resources.</blockquote><p>This is the classic techno-solutionist playbook: package basic resource scarcity as an analytics problem. It is far more profitable for silicon-valley syndicates to sell proprietary subscription software than it is to invest in concrete water pipes. The sensors will tell the farmer exactly how dry the soil is, in high-resolution detail, as if they needed a machine learning model to point out a dry ditch.</p>"
        }
    };

    return simulationEngine[rawArticle.id] || {
        category: rawArticle.category,
        aiHeadline: rawArticle.title,
        aiSummary: rawArticle.rawContent,
        biasAudit: "Corporate neutrality observed.",
        fullBlog: `<p class=\"blog-lead\">Looking past the raw news reports, we explore the structural implications of this story.</p><p>${rawArticle.rawContent}</p><p class=\"blog-analysis-heading\"><strong>The Honestly Biased Audit:</strong></p><blockquote>We note standard institutional spin in original press reporting.</blockquote><p>As details continue to emerge, we remain committed to auditing the narrative structures that shape contemporary public consciousness.</p>`
    };
}

// ==========================================================================
// 5. GOOGLE NEWS API INTEGRATION WITH PERSISTENT DISK CACHE
// ==========================================================================
const GNEWS_API_KEY = process.env.GNEWS_API_KEY || "b0af7931832154029e8d324bee5ffb40";
const CACHE_FILE_PATH = path.join(__dirname, 'gnews-cache.json');
const CACHE_EXPIRY_MS = 12 * 60 * 60 * 1000; // 12-hour persistent disk cache to prevent exceeding GNews 100 free query limits

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Programmatically classify an article's region based on content keywords and sources
function classifyRegion(title, description, rawContent, sourceName, urlText) {
    const titleText = (title || "").toLowerCase();
    const descText = (description || "").toLowerCase();
    const contentText = (rawContent || "").toLowerCase();
    const srcNameText = (sourceName || "").toLowerCase();
    const urlStr = (urlText || "").toLowerCase();

    const combinedText = `${titleText} ${descText} ${contentText} ${srcNameText} ${urlStr}`;

    // India indicators
    const indiaKeywords = [
        "india", "indian", "delhi", "mumbai", "bengaluru", "bangalore", "chennai", "kolkata", "hyderabad", "pune", "ahmedabad", "lucknow", "varanasi", "kerala", "goa", "gujarat", "punjab", "sikh",
        "modi", "bjp", "congress", "gandhi", "amit shah", "kejriwal", "rahul gandhi", "joseph vijay", "tvk", "isro", "rupee", "bollywood", "virat kohli", "dhoni", "rohit sharma", "ipl", "bcci"
    ];

    // UK/Britain indicators
    const ukKeywords = [
        "uk", "united kingdom", "britain", "british", "england", "english", "london", "scotland", "scottish", "wales", "welsh", "northern ireland", "londoner",
        "sunak", "starmer", "downing street", "keir starmer", "rishi sunak", "boris johnson", "westminster", "buckingham", "whitehall", "nhs", "pound", "sterling", "£",
        "king charles", "queen elizabeth", "heathrow", "gatwick", "manchester", "birmingham", "leeds", "glasgow", "edinburgh", "cardiff", "belfast"
    ];

    // Berkshire Local indicators
    const berkshireKeywords = [
        "berkshire", "reading", "slough", "maidenhead", "windsor", "newbury", "bracknell", "wokingham", "earley", "woodley", "twenty", "crowthorne", "sandhurst",
        "thames valley", "m4 corridor", "royal borough", "legoland", "microsoft reading", "oracle reading", "berkshire county", "west berkshire"
    ];

    let indiaCount = 0;
    indiaKeywords.forEach(kw => {
        const regex = new RegExp("\\b" + kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "\\b", "g");
        const matches = combinedText.match(regex);
        if (matches) indiaCount += matches.length;
    });

    let ukCount = 0;
    ukKeywords.forEach(kw => {
        const regex = new RegExp("\\b" + kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "\\b", "g");
        const matches = combinedText.match(regex);
        if (matches) ukCount += matches.length;
    });

    let berkshireCount = 0;
    berkshireKeywords.forEach(kw => {
        const regex = new RegExp("\\b" + kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "\\b", "g");
        const matches = combinedText.match(regex);
        if (matches) berkshireCount += matches.length;
    });

    // Domain and source specific weights
    if (urlStr.includes(".in/") || urlStr.endsWith(".in") || urlStr.includes(".co.in")) indiaCount += 5;
    if (urlStr.includes(".co.uk") || urlStr.includes(".org.uk") || urlStr.includes(".gov.uk") || urlStr.includes("bbc.co.uk")) ukCount += 5;
    if (urlStr.includes("berkshire") || urlStr.includes("reading") || urlStr.includes("windsor")) berkshireCount += 5;
    if (urlStr.includes(".in/") || urlStr.endsWith(".in") || urlStr.includes(".co.in")) indiaCount += 5;
    if (urlStr.includes(".co.uk") || urlStr.includes(".org.uk") || urlStr.includes(".gov.uk") || urlStr.includes("bbc.co.uk")) ukCount += 5;

    const indianSources = ["times of india", "the hindu", "indian express", "hindustantimes", "livemint", "moneycontrol", "ndtv", "indiatoday", "news18", "new indian express", "timesofindia"];
    const ukSources = ["bbc", "the guardian", "telegraph", "independent", "daily mail", "mirror", "sky news", "bbc news"];

    indianSources.forEach(src => {
        if (srcNameText.includes(src) || urlStr.includes(src.replace(/\s+/g, ""))) indiaCount += 3;
    });

    ukSources.forEach(src => {
        if (srcNameText.includes(src) || urlStr.includes(src.replace(/\s+/g, ""))) ukCount += 3;
    });

    const berkshireSources = ["reading chronicle", "berkshire live", "getreading", "windsor express", "newbury today", "the bracknell news", "wokingham paper"];
    berkshireSources.forEach(src => {
        if (srcNameText.includes(src) || urlStr.includes(src.replace(/\s+/g, ""))) berkshireCount += 3;
    });

    if (indiaCount > 0 && indiaCount >= ukCount && indiaCount >= berkshireCount) {
        return "indian";
    } else if (ukCount > 0 && ukCount > indiaCount && ukCount >= berkshireCount) {
        return "uk";
    } else if (berkshireCount > 0 && berkshireCount > indiaCount && berkshireCount > ukCount) {
        return "berkshire";
    } else {
        return "world";
    }
}

async function fetchAndAuditGNews() {
    let cacheData = { lastUpdated: 0, articles: [], highlights: defaultHighlights };

    // A. Read existing cache from disk
    if (fs.existsSync(CACHE_FILE_PATH)) {
        try {
            const fileContent = fs.readFileSync(CACHE_FILE_PATH, 'utf-8');
            cacheData = JSON.parse(fileContent);
            if (!cacheData.highlights) {
                cacheData.highlights = defaultHighlights;
            }
            // Migrate: re-classify articles dynamically based on our new strict rules
            if (cacheData.articles) {
                cacheData.articles = cacheData.articles.map(art => {
                    // Force Geopolitics category to Politics
                    if (art.category === 'Geopolitics') {
                        art.category = 'Politics';
                    }
                    if (art.authorType === 'ai' || art.authorType === 'instagram') {
                        const originalSource = art.originalSource || "";
                        const url = art.originalUrl || "";
                        const description = art.aiSummary || "";
                        const rawContent = art.fullBlog || "";
                        
                        art.region = classifyRegion(art.originalTitle || art.aiHeadline, description, rawContent, originalSource, url);
                    } else if (!art.region) {
                        art.region = 'indian';
                    }
                    return art;
                });
            }
            console.log(`📂 Read existing persistent cache from disk. Total cached articles: ${cacheData.articles.length}`);
        } catch (e) {
            console.error("❌ Failed to parse gnews-cache.json, resetting cache:", e);
        }
    }

    const now = Date.now();
    // OPTION TO DISABLE GNEWS FETCHING:
    const GNEWS_ENABLED = false; // Set to true to re-enable in future

    if (!GNEWS_ENABLED) {
        console.log("🔕 GNews API fetch is disabled. Serving custom/cached articles only.");
        return cacheData.articles.filter(a => a.authorType === 'admin' || a.authorType === 'instagram');
    }

    // B. Check if cache is still fresh (within 12 hours)
    if (cacheData.articles.length > 0 && (now - cacheData.lastUpdated < CACHE_EXPIRY_MS)) {
        console.log("⚡ Disk cache is fresh. Serving GNews articles from disk...");
        return cacheData.articles;
    }

    console.log("📡 Cache expired or missing. Fetching fresh articles from GNews API...");
    try {
        const rawArticles = [];
        
        // Config for regional editions (Indian, World, UK)
        const regionsConfig = [
            { tag: 'indian', code: 'in' },
            { tag: 'world', code: 'us' },
            { tag: 'uk', code: 'gb' }
        ];
        const categories = ['general', 'technology', 'business', 'entertainment', 'health'];
        
        for (const reg of regionsConfig) {
            for (const cat of categories) {
                const url = `https://gnews.io/api/v4/top-headlines?category=${cat}&lang=en&country=${reg.code}&max=5&apikey=${GNEWS_API_KEY}`;
                console.log(`📡 Requesting GNews top headlines for category: ${cat} in region: ${reg.tag}...`);
                const response = await fetch(url);
                if (response.ok) {
                    const data = await response.json();
                    if (data.articles) {
                        data.articles.forEach(art => {
                            art.queryCategory = cat;
                            art.queryRegion = reg.tag;
                        });
                        rawArticles.push(...data.articles);
                    }
                } else {
                    console.error(`❌ GNews API returned status ${response.status} for category ${cat} in region: ${reg.tag}`);
                }
                await sleep(1000); // Stagger request to prevent hitting rate-limit spikes
            }
        }

        console.log(`📥 Total raw GNews articles retrieved: ${rawArticles.length}`);

        if (rawArticles.length === 0) {
            console.log("⚠️ No articles returned from GNews. Serving old disk cache.");
            return cacheData.articles;
        }

        // De-duplicate articles by title and region
        const uniqueRawArticles = [];
        const titlesSeen = new Set();
        for (const art of rawArticles) {
            const key = `${art.title}::${art.queryRegion}`;
            if (!titlesSeen.has(key)) {
                titlesSeen.add(key);
                uniqueRawArticles.push(art);
            }
        }

        console.log(`🔍 Unique GNews articles to process: ${uniqueRawArticles.length}`);

        // C. Process unique articles one-by-one (staggered to avoid Gemini rate limits)
        const updatedArticles = [];
        
        for (let i = 0; i < uniqueRawArticles.length; i++) {
            const rawArt = uniqueRawArticles[i];
            
            // Check if this article was already audited in our previous cache to save Gemini quota!
            const existingAudit = cacheData.articles.find(a => a.originalTitle === rawArt.title);
            if (existingAudit) {
                console.log(`💾 Article already audited, loading and cloning from cache: "${rawArt.title}" for region ${existingAudit.region}`);
                const clonedAudit = {
                    ...existingAudit,
                    id: `gnews_${existingAudit.region}_${i + 1}`,
                    region: existingAudit.region
                };
                updatedArticles.push(clonedAudit);
                continue;
            }

            // Stagger Gemini queries by 1.5 seconds to strictly avoid 429 quota exhaustion (only if live AI is active)
            if (i > 0 && liveModel) {
                console.log(`⏳ Staggering Gemini pipeline... sleeping for 1.5s`);
                await sleep(1500);
            }

            // Map GNews query category to target UI brackets
            let targetCategory = 'Politics';
            if (rawArt.queryCategory === 'technology') targetCategory = 'Tech';
            else if (rawArt.queryCategory === 'business') targetCategory = 'Finance';
            else if (rawArt.queryCategory === 'entertainment') targetCategory = 'Entertainment';
            else if (rawArt.queryCategory === 'health') targetCategory = 'Health';
            else if (rawArt.queryCategory === 'general') {
                targetCategory = 'Politics';
            }

            // Prep the standard rawArticle structure for Gemini
            const tempArticle = {
                id: i + 1,
                title: rawArt.title,
                source: rawArt.source ? rawArt.source.name : "Global News",
                rawContent: rawArt.description || rawArt.title,
                category: targetCategory
            };

            // Call Gemini 3.5 Flash or Mock fallback
            const aiOutput = await runActualGeminiAPI(tempArticle);

            // Classify region using Gemini output if provided, or programmatic classifier
            let articleRegion = aiOutput.region;
            if (!articleRegion || !['indian', 'uk', 'world'].includes(articleRegion.toLowerCase().trim())) {
                articleRegion = classifyRegion(rawArt.title, rawArt.description, aiOutput.fullBlog, tempArticle.source, rawArt.url);
            } else {
                articleRegion = articleRegion.toLowerCase().trim();
            }

            const resolvedPublishDate = rawArt.publishedAt ? new Date(rawArt.publishedAt).toISOString() : new Date().toISOString();

            updatedArticles.push({
                id: `gnews_${articleRegion}_${i + 1}`,
                category: aiOutput.category || tempArticle.category || "Politics",
                region: articleRegion,
                aiHeadline: aiOutput.aiHeadline,
                aiSummary: aiOutput.aiSummary,
                biasAudit: aiOutput.biasAudit,
                fullBlog: aiOutput.fullBlog || "",
                originalSource: tempArticle.source,
                originalTitle: rawArt.title,
                timeAgo: new Date(resolvedPublishDate).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }) + " IST",
                author: "Honestly Biased AI Engine (Gemini)",
                authorType: "ai",
                imageUrl: rawArt.image || "./assets/hero-bg.png",
                originalUrl: rawArt.url || "#",
                publishdate: resolvedPublishDate
            });
        }

        // D. Save updated feed to disk cache, preserving custom admin/instagram articles
        const customArticles = cacheData.articles.filter(a => a.authorType === 'admin' || a.authorType === 'instagram');
        cacheData.lastUpdated = now;
        cacheData.articles = [...customArticles, ...updatedArticles];
        
        fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cacheData, null, 2), 'utf-8');
        console.log(`💾 Successfully updated and saved disk cache. Custom: ${customArticles.length}, GNews: ${updatedArticles.length}`);

        return cacheData.articles;

    } catch (err) {
        console.error("❌ Failed in fetchAndAuditGNews:", err);
        return cacheData.articles;
    }
}

// ==========================================================================
// 6. SERVER ENDPOINT: SERVING THE DYNAMIC FEED WITH CACHING
// ==========================================================================
app.get('/api/honestly-biased-feed', publicApiLimiter, async (req, res) => {
    try {
        console.log("📥 Incoming request for dynamic feed...");
        
        // Let fetchAndAuditGNews manage the disk caching and staggered Geminis!
        const processedArticles = await fetchAndAuditGNews();

        // Dynamic Rhetoric Sentiment Meter status
        const rhetoricMeterData = {
            hyperbolePercentage: "84.2%",
            yoyGrowth: "+12.4%",
            aiAnalysis: "Prime-time coverage monitored today reveals a severe spike in hyperbolic sensationalism as legacy newsrooms attempt to mask policy concessions behind corporate volume."
        };

        // Load ticker highlights
        let highlights = defaultHighlights;
        if (fs.existsSync(CACHE_FILE_PATH)) {
            try {
                const cacheData = JSON.parse(fs.readFileSync(CACHE_FILE_PATH, 'utf-8'));
                if (cacheData.highlights && cacheData.highlights.length > 0) {
                    highlights = cacheData.highlights;
                }
            } catch (e) {
                console.error("❌ Failed to parse cache for highlights feed response:", e);
            }
        }

        const cleanedArticles = processedArticles.map(art => {
            if (art.aiHeadline) {
                art.aiHeadline = art.aiHeadline.replace(/^Refracted:\s*/i, '');
            }
            return art;
        });

        res.json({
            rhetoricMeter: rhetoricMeterData,
            articles: cleanedArticles,
            highlights: highlights
        });
        
    } catch (error) {
        console.error("Endpoint failed to compile feed:", error);
        res.status(500).json({ error: "Internal server error assembling content feed" });
    }
});

// ==========================================================================
// 7. RESTFUL CMS ADMIN ENDPOINTS (Create, Update, Delete)
// ==========================================================================

// A. CREATE: Draft new custom editorial article
app.post('/api/admin/articles', adminAuthLimiter, basicAuth, (req, res) => {
    try {
        console.log("📥 Incoming POST request to create new custom article...");
        const { category, region, aiHeadline, aiSummary, biasAudit, originalSource, imageUrl, originalUrl, instagramShortcode, authorType, fullBlog, publishdate } = req.body;
        
        if (!aiHeadline || !aiSummary) {
            return res.status(400).json({ error: "Headline and Summary are required fields." });
        }

        let cacheData = { lastUpdated: Date.now(), articles: [] };
        if (fs.existsSync(CACHE_FILE_PATH)) {
            try {
                cacheData = JSON.parse(fs.readFileSync(CACHE_FILE_PATH, 'utf-8'));
            } catch (e) {
                console.error("❌ Failed to parse cache during POST:", e);
            }
        }

        const resolvedPublishDate = publishdate ? new Date(publishdate).toISOString() : new Date().toISOString();

        const newArticle = {
            id: `admin_${Date.now()}`,
            category: category || "Politics",
            region: region || "indian",
            aiheadline: aiHeadline,
            aisummary: aiSummary,
            biasaudit: biasAudit || "Direct Admin Commentary.",
            fullblog: fullBlog || "",
            originalsource: originalSource || "Honestly Biased Editorial Board",
            originaltitle: aiHeadline,
            timeago: new Date(resolvedPublishDate).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }) + " IST",
            author: authorType === "instagram" ? "Honestly Biased AI Engine (Instagram Ingestion)" : "Honestly Biased Editorial Board (Admin)",
            authortype: authorType || "admin",
            instagramShortcode: instagramShortcode || null,
            imageurl: imageUrl || "./assets/hero-bg.png",
            originalurl: originalUrl || "#",
            publishdate: resolvedPublishDate
        };

        cacheData.articles.unshift(newArticle); // Put custom editorials at the very front of the grid!
        fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cacheData, null, 2), 'utf-8');
        
        console.log(`✍️ Successfully created custom editorial: "${aiHeadline}"`);
        res.status(201).json(newArticle);
    } catch (err) {
        console.error("❌ Failed to create custom article:", err);
        res.status(500).json({ error: "Internal server error creating article." });
    }
});

// B. UPDATE: Edit existing article by ID (AI-generated or custom Admin editorial)
app.put('/api/admin/articles/:id', adminAuthLimiter, basicAuth, (req, res) => {
    try {
        const { id } = req.params;
        console.log(`📥 Incoming PUT request to update article ID: ${id}...`);
        const { category, region, aiHeadline, aiSummary, biasAudit, originalSource, imageUrl, originalUrl, instagramShortcode, authorType, fullBlog, publishdate } = req.body;

        if (!fs.existsSync(CACHE_FILE_PATH)) {
            return res.status(404).json({ error: "No article database found." });
        }

        let cacheData = JSON.parse(fs.readFileSync(CACHE_FILE_PATH, 'utf-8'));
        const articleIndex = cacheData.articles.findIndex(a => String(a.id) === String(id));

        if (articleIndex === -1) {
            return res.status(404).json({ error: "Article not found in database." });
        }

        // Update matching fields
        const target = cacheData.articles[articleIndex];
        target.category = category || target.category;
        target.region = region || target.region;
        target.aiheadline = aiHeadline || target.aiheadline || target.aiHeadline;
        target.aisummary = aiSummary || target.aisummary || target.aiSummary;
        target.biasaudit = biasAudit !== undefined ? biasAudit : (target.biasaudit || target.biasAudit);
        target.fullblog = fullBlog !== undefined ? fullBlog : (target.fullblog || target.fullBlog);
        target.originalsource = originalSource || target.originalsource || target.originalSource;
        target.imageurl = imageUrl || target.imageurl || target.imageUrl;
        target.originalurl = originalUrl || target.originalurl || target.originalUrl;
        target.instagramShortcode = instagramShortcode !== undefined ? instagramShortcode : target.instagramShortcode;
        target.authortype = authorType || target.authortype || target.authorType;
        if (publishdate !== undefined) {
            target.publishdate = publishdate ? new Date(publishdate).toISOString() : null;
            if (target.publishdate) {
                target.timeago = new Date(target.publishdate).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }) + " IST";
            }
        }
        if (target.authortype === "instagram") {
            target.author = "Honestly Biased AI Engine (Instagram Ingestion)";
        }

        fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cacheData, null, 2), 'utf-8');
        
        console.log(`💾 Successfully updated article ID: ${id} ("${target.aiHeadline}")`);
        res.json(target);
    } catch (err) {
        console.error("❌ Failed to update article:", err);
        res.status(500).json({ error: "Internal server error updating article." });
    }
});

// C. DELETE: Remove article by ID
app.delete('/api/admin/articles/:id', adminAuthLimiter, basicAuth, (req, res) => {
    try {
        const { id } = req.params;
        console.log(`📥 Incoming DELETE request to remove article ID: ${id}...`);

        if (!fs.existsSync(CACHE_FILE_PATH)) {
            return res.status(404).json({ error: "No article database found." });
        }

        let cacheData = JSON.parse(fs.readFileSync(CACHE_FILE_PATH, 'utf-8'));
        const initialLength = cacheData.articles.length;
        cacheData.articles = cacheData.articles.filter(a => String(a.id) !== String(id));

        if (cacheData.articles.length === initialLength) {
            return res.status(404).json({ error: "Article not found." });
        }

        fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cacheData, null, 2), 'utf-8');
        
        console.log(`🗑️ Successfully deleted article ID: ${id}`);
        res.json({ message: `Successfully removed article ID ${id}` });
    } catch (err) {
        console.error("❌ Failed to delete article:", err);
        res.status(500).json({ error: "Internal server error deleting article." });
    }
});

// ==========================================================================
// 8. AUTOMATED INSTAGRAM INGESTION WORKFLOW & API
// ==========================================================================
let connectedInstagramConfig = {
    handle: '',
    rssUrl: '',
    connected: false,
    connectedAt: null
};

let instagramLogs = [
    `[${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}] System Daemon Initialized. Waiting for account connection...`
];

function addInstagramLog(msg) {
    const timestamp = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    instagramLogs.push(`[${timestamp}] ${msg}`);
    if (instagramLogs.length > 50) instagramLogs.shift();
    console.log(`[IG AUTO] ${msg}`);
}

function parseRssFeed(xmlText) {
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xmlText)) !== null) {
        const itemContent = match[1];
        
        const extractField = (fieldName) => {
            const regexCdata = new RegExp(`<${fieldName}>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${fieldName}>`);
            const regexSimple = new RegExp(`<${fieldName}>([\\s\\S]*?)</${fieldName}>`);
            const mCdata = itemContent.match(regexCdata);
            if (mCdata) return mCdata[1].trim();
            const mSimple = itemContent.match(regexSimple);
            if (mSimple) return mSimple[1].trim();
            return '';
        };

        const title = extractField('title');
        const link = extractField('link');
        const description = extractField('description');

        items.push({ title, link, description });
    }
    return items;
}

async function pollRealInstagramFeed() {
    if (!connectedInstagramConfig.connected) return;
    
    if (!connectedInstagramConfig.rssUrl) {
        addInstagramLog(`Polling active for handle ${connectedInstagramConfig.handle}. No RSS Feed URL provided; waiting for updates.`);
        return;
    }

    addInstagramLog(`Syncing real Instagram posts for ${connectedInstagramConfig.handle}...`);
    try {
        const res = await fetch(connectedInstagramConfig.rssUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
            }
        });
        if (!res.ok) {
            addInstagramLog(`⚠️ Sync warning: RSS Feed returned status ${res.status}`);
            return;
        }
        const text = await res.text();
        let items = [];
        
        if (text.trim().startsWith('{')) {
            try {
                const data = JSON.parse(text);
                items = (data.items || []).map(i => ({
                    title: i.title || '',
                    link: i.url || i.external_url || '',
                    description: i.content_html || i.summary || i.title || ''
                }));
            } catch (je) {
                addInstagramLog(`❌ JSON Feed parse error: ${je.message}`);
            }
        } else {
            items = parseRssFeed(text);
        }

        if (items.length === 0) {
            addInstagramLog(`Sync checked: 0 posts returned in feed.`);
            return;
        }

        const latestPost = items[0];
        const postLink = latestPost.link || '';
        
        let shortcode = '';
        const shortcodeMatch = postLink.match(/\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
        if (shortcodeMatch) {
            shortcode = shortcodeMatch[1];
        } else {
            shortcode = 'C-' + Math.random().toString(36).substring(2, 11);
        }

        let caption = latestPost.description || latestPost.title || '';
        caption = caption.replace(/<[^>]*>/g, '').trim();

        let cacheData = { lastUpdated: Date.now(), articles: [] };
        if (fs.existsSync(CACHE_FILE_PATH)) {
            try {
                cacheData = JSON.parse(fs.readFileSync(CACHE_FILE_PATH, 'utf-8'));
            } catch (e) {}
        }
        
        const alreadyExists = cacheData.articles.some(art => 
            art.authorType === 'instagram' && 
            (art.instagramShortcode === shortcode || art.originalUrl === postLink)
        );

        if (alreadyExists) {
            addInstagramLog(`Sync checked: Latest post (${shortcode}) is already processed.`);
            return;
        }

        addInstagramLog(`🔔 NEW POST DETECTED: "${caption.substring(0, 40)}..."`);
        addInstagramLog(`Shortcode: ${shortcode}. Querying Gemini to write satirical chronicle...`);

        const aiOutput = await runInstagramGeminiAPI(caption, shortcode);

        const articleRegion = classifyRegion(caption || "Instagram Video Update", aiOutput.aiSummary, aiOutput.fullBlog, `Instagram (${connectedInstagramConfig.handle || '@honestlybiased'})`, postLink || `https://www.instagram.com/p/${shortcode}/`);

        const newArticle = {
            id: `instagram_${Date.now()}`,
            category: aiOutput.category || "Politics",
            region: articleRegion,
            aiHeadline: aiOutput.aiHeadline,
            aiSummary: aiOutput.aiSummary,
            biasAudit: aiOutput.biasAudit,
            fullBlog: aiOutput.fullBlog || "",
            originalSource: `Instagram (${connectedInstagramConfig.handle || '@honestlybiased'})`,
            originalTitle: caption || "Instagram Video Update",
            timeAgo: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }) + " IST",
            author: "Honestly Biased AI Engine (Instagram Ingestion)",
            authorType: "instagram",
            instagramShortcode: shortcode,
            imageUrl: "./assets/hero-bg.png",
            originalUrl: postLink || `https://www.instagram.com/p/${shortcode}/`
        };

        cacheData.articles.unshift(newArticle);
        fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cacheData, null, 2), 'utf-8');

        addInstagramLog(`✨ Auto-published Satirical Chronicle: "${aiOutput.aiHeadline}"`);

    } catch (err) {
        addInstagramLog(`❌ Error syncing Instagram feed: ${err.message}`);
    }
}

// Background scheduler polling loop
setInterval(() => {
    if (connectedInstagramConfig.connected) {
        pollRealInstagramFeed();
    }
}, 30000);

// Helper to run Gemini SATIRE conversion specifically for IG captions
async function runInstagramGeminiAPI(caption, shortcode) {
    if (!liveModel) return runMockInstagramGeminiAI(caption, shortcode);

    const systemPrompt = `
        You are the Head Editorial AI for "Honestly Biased", an independent digital media news commentary, media audit, and satire platform in India.
        We just ingested a new video post from our connected Instagram account.
        Raw Instagram Caption: "${caption}"
        
        Analyze the caption topic, critique the underlying corporate interest, policy spin, or social media performance, and return a satirical Honestly Biased blog article.
        Return a clean JSON object following this strict schema:
        {
            "category": "Politics" or "Tech" or "Finance" or "Entertainment" or "Health",
            "aiHeadline": "A highly sharp, wittily satirical, and self-aware headline rewriting the corporate spin or social narrative",
            "aiSummary": "Factual details summarized in exactly 2 sentences, written with transparent critical bias, dry humor, and absolute clarity",
            "biasAudit": "A 1-sentence analytical audit explaining the specific institutional or corporate bias/incentive in the original topic",
            "fullBlog": "A detailed satirical blog post of 3-4 paragraphs (approx 200-300 words) expanding on the Instagram update with commentary on the social and corporate factors at play."
        }

        Important: Return a clean JSON object. Do not wrap in markdown or backticks. Double check that keys match the schema exactly.
    `;

    try {
        console.log(`📡 Querying Gemini 3.5 Flash for Instagram translation...`);
        const result = await liveModel.generateContent(systemPrompt);
        const text = result.response.text();
        const aiOutput = JSON.parse(text);
        console.log(`✨ Gemini processed Instagram caption successfully: "${aiOutput.aiHeadline}"`);
        return aiOutput;
    } catch (err) {
        console.error(`❌ Gemini API call failed for Instagram caption. Using mock fallback.`, err.message || err);
        return runMockInstagramGeminiAI(caption, shortcode);
    }
}

function runMockInstagramGeminiAI(caption, shortcode) {
    const mockTopics = [
        {
            category: "Politics",
            aiHeadline: "Consensus Manufacturing 101: How to Turn Administrative Overlap into a 'Nation-Building Milestone'",
            aiSummary: "Bureaucratic departments have announced a new joint council to coordinate digital dashboards. The initiative is guaranteed to produce exactly 14 reports outlining the need for further coordination councils.",
            biasAudit: "PR departments frame routine departmental updates as historic achievements to justify budget allocations.",
            fullBlog: "<p class=\"blog-lead\">We have just witnessed a masterclass in bureaucratic narrative crafting.</p><p>The announcement of a joint council for digital dashboards is presented to the public as a groundbreaking modernization milestone. In reality, it establishes another layer of committee meetings whose only output is scheduling more meetings.</p><p class=\"blog-analysis-heading\"><strong>The Honestly Biased Audit:</strong></p><blockquote>PR departments frame routine departmental updates as historic achievements to justify budget allocations.</blockquote><p>By framing the simple task of getting two databases to speak to each other as a national milestone, administrative layers justify their headcount and budgets while ensuring no actual work is completed before the next fiscal review.</p>"
        },
        {
            category: "Tech",
            aiHeadline: "The Gig Economy Paradox: Delivery Apps Roll Out 'Wellness Initiatives' to Mask Low Compensation Rates",
            aiSummary: "Aggregator platforms have introduced micro-health checkups for independent riders at delivery depots. The program optimizes driver performance while carefully avoiding basic employee medical insurance liabilities.",
            biasAudit: "Silicon Valley clones wrap worker exploitation in the friendly language of 'partner wellness' and flexibility.",
            fullBlog: "<p class=\"blog-lead\">In a showcase of corporate benevolence, leading food delivery platforms have announced micro-health checkups for riders.</p><p>While corporate PR campaigns focus heavily on the friendly language of 'partner wellness', they are silent on the structural reality: riders have no access to basic medical insurance, paid leave, or fair base rates. Checking a driver's blood pressure at a depot ensures they can complete their shift, while keeping them classified as independent contractors to avoid legal liability.</p><p class=\"blog-analysis-heading\"><strong>The Honestly Biased Audit:</strong></p><blockquote>Silicon Valley clones wrap worker exploitation in the friendly language of 'partner wellness' and flexibility.</blockquote><p>It is far cheaper to distribute free vitamin supplements and check heart rates once a quarter than it is to pay a living wage or cover hospitalization. The 'wellness check' is not a benefit—it is an optimization strategy for the platform's human bandwidth.</p>"
        },
        {
            category: "Entertainment",
            aiHeadline: "Corporate HR Team Pioneers Revolutionary Strategy of Sending Planners to Coordinate Planning Sessions",
            aiSummary: "A global consulting house has announced a new 'Synergies taskforce' to review meeting agendas. The team will hold daily pre-meetings to align on key topics for the scheduled brainstorming events.",
            biasAudit: "Operational layers inflate meeting schedules to simulate progress and delay actual deliverable milestones.",
            fullBlog: "<p class=\"blog-lead\">In a breakthrough of organizational science, a leading global consulting house is introducing pre-meeting alignment sessions.</p><p>The 'Synergies taskforce' is tasked with auditing meeting schedules to reduce fatigue. Naturally, their first step is introducing a new daily status sync to prepare for the weekly brainstorming syncs, creating a flawless loop of self-perpetuating coordination.</p><p class=\"blog-analysis-heading\"><strong>The Honestly Biased Audit:</strong></p><blockquote>Operational layers inflate meeting schedules to simulate progress and delay actual deliverable milestones.</blockquote><p>When an organization's primary product is advice, the absolute worst outcome is running out of topics to discuss. By introducing meetings to plan meetings, consulting firms guarantee a perpetual pipeline of billable hours without ever risking the completion of a final report.</p>"
        }
    ];

    const idx = (caption ? caption.length : 0) % mockTopics.length;
    return mockTopics[idx];
}

// A. READ: Get connected handle and logs
app.get('/api/admin/instagram/config', adminAuthLimiter, basicAuth, (req, res) => {
    res.json({
        config: connectedInstagramConfig,
        logs: instagramLogs
    });
});

// B. WRITE: Update connected handle and RSS URL
app.post('/api/admin/instagram/config', adminAuthLimiter, basicAuth, (req, res) => {
    const { handle, rssUrl, connected } = req.body;
    
    connectedInstagramConfig.handle = handle || '';
    connectedInstagramConfig.rssUrl = rssUrl || '';
    connectedInstagramConfig.connected = !!connected;
    connectedInstagramConfig.connectedAt = connected ? Date.now() : null;

    if (connected) {
        addInstagramLog(`Connected to Instagram account handle: ${handle}`);
        if (connectedInstagramConfig.rssUrl) {
            addInstagramLog(`Ingested Feed URL: ${connectedInstagramConfig.rssUrl}`);
        }
        addInstagramLog(`Authorized background polling service.`);
    } else {
        addInstagramLog(`Disconnected from Instagram account.`);
        addInstagramLog(`Background polling service paused.`);
    }

    res.json(connectedInstagramConfig);
});

// Sync Instagram feed manually
app.post('/api/admin/instagram/sync', adminAuthLimiter, basicAuth, async (req, res) => {
    if (!connectedInstagramConfig.connected) {
        return res.status(400).json({ error: "Instagram account integration is not connected." });
    }
    if (!connectedInstagramConfig.rssUrl) {
        return res.status(400).json({ error: "No Instagram RSS/JSON Feed URL is configured to sync." });
    }

    addInstagramLog(`Manual sync triggered by administrator.`);
    await pollRealInstagramFeed();
    res.json({ message: "Instagram feed sync executed successfully. Check activity logs for details." });
});

// C. WEBHOOK: Receive incoming post updates automatically
app.post('/api/instagram/webhook', submissionLimiter, async (req, res) => {
    try {
        const { mediaId, shortcode, permalink, caption } = req.body;
        
        if (!shortcode) {
            return res.status(400).json({ error: "Missing shortcode parameter." });
        }

        if (!connectedInstagramConfig.connected) {
            return res.status(403).json({ error: "Instagram account integration is not connected." });
        }

        addInstagramLog(`🔔 WEBHOOK EVENT RECEIVED: New post media detected.`);
        addInstagramLog(`Shortcode: "${shortcode}" | Media ID: "${mediaId || 'unknown'}"`);
        addInstagramLog(`Processing caption: "${caption ? (caption.substring(0, 60) + '...') : 'No caption'}"`);

        // Run Gemini pipeline
        addInstagramLog(`Querying Gemini 3.5 Flash to write satirical chronicle...`);
        const aiOutput = await runInstagramGeminiAPI(caption || "HB reel update", shortcode);

        let cacheData = { lastUpdated: Date.now(), articles: [] };
        if (fs.existsSync(CACHE_FILE_PATH)) {
            try {
                cacheData = JSON.parse(fs.readFileSync(CACHE_FILE_PATH, 'utf-8'));
            } catch (e) {
                console.error("❌ Failed to parse cache during IG webhook:", e);
            }
        }

        const articleRegion = classifyRegion(caption || "Instagram Video Update", aiOutput.aiSummary, aiOutput.fullBlog, `Instagram (${connectedInstagramConfig.handle || '@honestlybiased'})`, permalink || `https://www.instagram.com/p/${shortcode}/`);

        const newArticle = {
            id: `instagram_${Date.now()}`,
            category: aiOutput.category || "Politics",
            region: articleRegion,
            aiHeadline: aiOutput.aiHeadline,
            aiSummary: aiOutput.aiSummary,
            biasAudit: aiOutput.biasAudit,
            fullBlog: aiOutput.fullBlog || "",
            originalSource: `Instagram (${connectedInstagramConfig.handle || '@honestlybiased'})`,
            originalTitle: caption || "Instagram Video Update",
            timeAgo: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }) + " IST",
            author: "Honestly Biased AI Engine (Instagram Ingestion)",
            authorType: "instagram",
            instagramShortcode: shortcode,
            imageUrl: "./assets/hero-bg.png",
            originalUrl: permalink || `https://www.instagram.com/p/${shortcode}/`
        };

        // Prepend new IG blog post directly to the top!
        cacheData.articles.unshift(newArticle);
        fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cacheData, null, 2), 'utf-8');

        addInstagramLog(`✨ Auto-published Satirical Chronicle: "${aiOutput.aiHeadline}"`);
        
        res.status(201).json(newArticle);
    } catch (err) {
        console.error("❌ Instagram webhook ingestion failed:", err);
        res.status(500).json({ error: "Internal server error parsing webhook payload." });
    }
});

// ==========================================================================
// 9. HEADER HIGHLIGHTS CMS ENDPOINTS
// ==========================================================================

// A. GET: Get highlights list
app.get('/api/admin/highlights', adminAuthLimiter, basicAuth, (req, res) => {
    let cacheData = { lastUpdated: 0, articles: [], highlights: defaultHighlights };
    if (fs.existsSync(CACHE_FILE_PATH)) {
        try {
            cacheData = JSON.parse(fs.readFileSync(CACHE_FILE_PATH, 'utf-8'));
        } catch (e) {
            console.error("❌ Failed to parse cache during highlights GET:", e);
        }
    }
    res.json(cacheData.highlights || defaultHighlights);
});

// B. POST: Save highlights list
app.post('/api/admin/highlights', adminAuthLimiter, basicAuth, (req, res) => {
    const { highlights } = req.body;
    if (!Array.isArray(highlights)) {
        return res.status(400).json({ error: "Highlights must be a valid array of strings." });
    }

    let cacheData = { lastUpdated: Date.now(), articles: [], highlights: defaultHighlights };
    if (fs.existsSync(CACHE_FILE_PATH)) {
        try {
            cacheData = JSON.parse(fs.readFileSync(CACHE_FILE_PATH, 'utf-8'));
        } catch (e) {
            console.error("❌ Failed to parse cache during highlights POST:", e);
        }
    }

    cacheData.highlights = highlights;
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cacheData, null, 2), 'utf-8');
    
    console.log(`📡 Ticker highlights successfully updated: ${highlights.length} items`);
    res.json(cacheData.highlights);
});

// ==========================================================================
// 10. PERSISTENT CIVIC POLL ENDPOINTS
// ==========================================================================
const POLL_FILE_PATH = path.join(__dirname, 'poll-data.json');

function readPollData() {
    if (fs.existsSync(POLL_FILE_PATH)) {
        try {
            const data = JSON.parse(fs.readFileSync(POLL_FILE_PATH, 'utf-8'));
            if (Array.isArray(data.votes) && data.votes.length === 3) {
                return data;
            }
        } catch (e) {
            console.error("❌ Failed to parse poll-data.json, resetting:", e);
        }
    }
    const defaultPoll = { votes: [74, 18, 8], total: 100 };
    fs.writeFileSync(POLL_FILE_PATH, JSON.stringify(defaultPoll, null, 2), 'utf-8');
    return defaultPoll;
}

function writePollData(data) {
    fs.writeFileSync(POLL_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// GET: Current poll counts & percentages
app.get('/api/poll/results', publicApiLimiter, (req, res) => {
    try {
        const poll = readPollData();
        res.json(poll);
    } catch (err) {
        console.error("❌ Failed to read poll results:", err);
        res.status(500).json({ error: "Internal server error reading poll." });
    }
});

// POST: Submit a vote
app.post('/api/poll/vote', submissionLimiter, (req, res) => {
    try {
        const { optionIndex } = req.body;
        const index = parseInt(optionIndex, 10);
        if (isNaN(index) || index < 0 || index > 2) {
            return res.status(400).json({ error: "Invalid vote option index." });
        }

        const poll = readPollData();
        poll.votes[index] += 1;
        poll.total = poll.votes.reduce((a, b) => a + b, 0);

        writePollData(poll);
        console.log(`🗳️ Registered vote for option index ${index}. New total: ${poll.total}`);
        res.json(poll);
    } catch (err) {
        console.error("❌ Failed to register vote:", err);
        res.status(500).json({ error: "Internal server error registering vote." });
    }
});

// ==========================================================================
// 11. PERSISTENT NEWSLETTER SUBSCRIBERS ENDPOINTS
// ==========================================================================
const SUBSCRIBERS_FILE_PATH = path.join(__dirname, 'subscribers.json');

function readSubscribers() {
    if (fs.existsSync(SUBSCRIBERS_FILE_PATH)) {
        try {
            const data = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE_PATH, 'utf-8'));
            if (Array.isArray(data)) {
                return data;
            }
        } catch (e) {
            console.error("❌ Failed to parse subscribers.json, resetting:", e);
        }
    }
    const defaultSubscribers = [];
    fs.writeFileSync(SUBSCRIBERS_FILE_PATH, JSON.stringify(defaultSubscribers, null, 2), 'utf-8');
    return defaultSubscribers;
}

function writeSubscribers(data) {
    fs.writeFileSync(SUBSCRIBERS_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// POST: Subscribe to newsletter
app.post('/api/newsletter/subscribe', submissionLimiter, (req, res) => {
    try {
        const { email } = req.body;
        if (!email || typeof email !== 'string' || !email.includes('@')) {
            return res.status(400).json({ error: "A valid email address is required." });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const subscribers = readSubscribers();

        // Check if already subscribed
        const exists = subscribers.some(sub => sub.email === normalizedEmail);
        if (exists) {
            return res.status(409).json({ error: "Email is already subscribed to the ledger." });
        }

        const newSub = {
            email: normalizedEmail,
            subscribedAt: new Date().toISOString()
        };

        subscribers.push(newSub);
        writeSubscribers(subscribers);

        console.log(`✉️ New subscriber added: ${normalizedEmail}`);
        res.status(201).json({ success: true, email: normalizedEmail });
    } catch (err) {
        console.error("❌ Failed to subscribe email:", err);
        res.status(500).json({ error: "Internal server error subscribing to newsletter." });
    }
});

// GET: List all subscribers (secured under admin Basic Auth)
app.get('/api/admin/subscribers', adminAuthLimiter, basicAuth, (req, res) => {
    try {
        const subscribers = readSubscribers();
        res.json(subscribers);
    } catch (err) {
        console.error("❌ Failed to read subscribers:", err);
        res.status(500).json({ error: "Internal server error retrieving subscribers." });
    }
});

// GET: Export subscribers as CSV file download (secured under admin Basic Auth)
app.get('/api/admin/subscribers/export', adminAuthLimiter, basicAuth, (req, res) => {
    try {
        const subscribers = readSubscribers();
        let csvContent = "Email,SubscribedAt\n";
        subscribers.forEach(sub => {
            csvContent += `"${sub.email.replace(/"/g, '""')}",${sub.subscribedAt}\n`;
        });
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=subscribers.csv');
        res.status(200).send(csvContent);
    } catch (err) {
        console.error("❌ Failed to export subscribers CSV:", err);
        res.status(500).json({ error: "Internal server error exporting subscribers." });
    }
});

// GET: Read site content
const SITE_CONTENT_FILE = path.join(__dirname, 'site-content.json');
function readSiteContent() {
    if (fs.existsSync(SITE_CONTENT_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(SITE_CONTENT_FILE, 'utf-8'));
        } catch (e) {
            console.error("❌ Failed to parse site-content.json:", e);
        }
    }
    // Return baked-in Hero fallbacks matching index.html
    return {
        hero: {
            eyebrow: "DEEP PERSPECTIVE",
            readtime: "9 Min Read",
            headline: "The Illusion of Consensus: Bending the Corporate News Narrative",
            body: "Traditional news chambers claim to deliver pure, unvarnished objective truth. We say that is a convenient myth. Let us look closer—and biasedly—at the corporate lobbying, administrative inertia, and policy loopholes rewriting the agrarian economy under the cover of artificial neutrality.",
            byline: "Aniket Verma",
            byline_role: "Senior Bias Analyst",
            cta: "Expose The Script"
        }
    };
}

app.get('/api/site-content', publicApiLimiter, (req, res) => {
    res.json(readSiteContent());
});

// POST: Save/update site content (Admin only)
app.post('/api/admin/site-content', adminAuthLimiter, basicAuth, (req, res) => {
    const { updates } = req.body;
    if (!Array.isArray(updates)) {
        return res.status(400).json({ error: "Updates must be an array." });
    }
    const current = readSiteContent();
    for (const item of updates) {
        if (item && typeof item.key === 'string' && item.value !== undefined) {
            current[item.key] = item.value;
        }
    }
    fs.writeFileSync(SITE_CONTENT_FILE, JSON.stringify(current, null, 2), 'utf-8');
    console.log(`📡 Site content updated keys: ${updates.map(u => u.key).join(', ')}`);
    res.json({ ok: true, updated: updates });
});

// ==========================================================================
// 12. CUSTOM 404 AND ERROR BOUNDARIES
// ==========================================================================

// Catch-all route to serve styled glassmorphic 404 page
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '404.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`\n=============================================================`);
    console.log(`📡 honestlybiasedOfficial Production Server Operational!`);
    console.log(`🔗 API Feed URL: http://localhost:${PORT}/api/honestly-biased-feed`);
    console.log(`=============================================================\n`);
});
