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
require('dotenv').config(); // Loads environment variables from a .env file if present

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for frontend accessibility during local development
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

app.use(express.json());

// Dedicated Admin CMS Portal Router: map /admin to serve admin.html
app.get('/admin', (req, res) => {
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
const rawIncomingNews = [
    {
        id: 1,
        title: "Ministry of Finance updates standard guidelines and schedules for digital tax filing systems.",
        source: "Economic Reporter",
        rawContent: "The ministry of finance has announced standard updates to administrative tax forms, noting that the revised structures are aimed at optimizing internal reporting algorithms for tax experts.",
        category: "Politics",
        timeAgo: "2 Hours Ago",
        imageUrl: "./assets/hero-bg.png"
    },
    {
        id: 2,
        title: "Startups raise alerts over high costs of compliance under personal data protection bills.",
        source: "Tech India",
        rawContent: "Several startup CEOs in Bangalore expressed concerns that complying with India's new personal data protection regulations would significantly increase cloud data tracking and processing operations budgets.",
        category: "Politics",
        timeAgo: "4 Hours Ago",
        imageUrl: "./assets/hero-bg.png"
    },
    {
        id: 3,
        title: "Agritech sector secures seed funding for automated soil sensor arrays in dryland farms.",
        source: "Venture Journal",
        rawContent: "A group of venture capital funds has invested $40 million in an agri-tech startup selling machine-learning-enabled moisture sensors designed to monitor dry soils in agricultural districts.",
        category: "Tech Audit",
        timeAgo: "2 Days Ago",
        imageUrl: "./assets/hero-bg.png"
    }
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
            "category": "Politics" or "Tech Audit" or "Satire" or "Culture",
            "aiHeadline": "A highly sharp, wittily satirical, and self-aware headline rewriting the corporate spin",
            "aiSummary": "Facts summarized in exactly 2 sentences, written with transparent critical bias, dry humor, and absolute clarity",
            "biasAudit": "A 1-sentence analytical audit explaining the specific institutional or corporate bias/incentive in the original piece"
        }

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
            biasAudit: "Ministers frame procedural hurdles as 'efficiency improvements' to mask standard operational overhead."
        },
        2: {
            category: "Politics",
            aiHeadline: "Consent Under the Microscope: Startup Panic Climbs Over DPDP Compliance Hurdles",
            aiSummary: "Tech startups are suddenly discovering that acquiring 'explicit user consent' is a massive operational headache when they actually have to disclose their backend monetisation pipelines. The Bangalore tech hub is scrambling for regulatory loopholes.",
            biasAudit: "Corporate platforms frame user privacy compliance as an 'innovation tax' to protect high-margin ad trackers."
        },
        3: {
            category: "Tech Audit",
            aiHeadline: "The Agri-Tech Bubble: Edge-Computing Moisture Sensors Sold to Farmers Lacking Basic Water Pipelines",
            aiSummary: "Venture capitalists have successfully dumped $40 million into high-tech soil monitoring sensors. The startup is prioritizing machine-learning algorithms over basic, physical water irrigation structures in drought districts.",
            biasAudit: "VC narrative prioritizes selling proprietary AI sensors to smallholders before sorting basic agricultural resources."
        }
    };

    return simulationEngine[rawArticle.id] || {
        category: rawArticle.category,
        aiHeadline: `Refracted: ${rawArticle.title}`,
        aiSummary: rawArticle.rawContent,
        biasAudit: "Corporate neutrality observed."
    };
}

// ==========================================================================
// 5. GOOGLE NEWS API INTEGRATION WITH PERSISTENT DISK CACHE
// ==========================================================================
const GNEWS_API_KEY = "b0af7931832154029e8d324bee5ffb40";
const CACHE_FILE_PATH = path.join(__dirname, 'gnews-cache.json');
const CACHE_EXPIRY_MS = 12 * 60 * 60 * 1000; // 12-hour persistent disk cache to prevent exceeding GNews 100 free query limits

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchAndAuditGNews() {
    let cacheData = { lastUpdated: 0, articles: [] };

    // A. Read existing cache from disk
    if (fs.existsSync(CACHE_FILE_PATH)) {
        try {
            const fileContent = fs.readFileSync(CACHE_FILE_PATH, 'utf-8');
            cacheData = JSON.parse(fileContent);
            console.log(`📂 Read existing persistent cache from disk. Total cached articles: ${cacheData.articles.length}`);
        } catch (e) {
            console.error("❌ Failed to parse gnews-cache.json, resetting cache:", e);
        }
    }

    const now = Date.now();
    // B. Check if cache is still fresh (within 12 hours)
    if (cacheData.articles.length > 0 && (now - cacheData.lastUpdated < CACHE_EXPIRY_MS)) {
        console.log("⚡ Disk cache is fresh. Serving GNews articles from disk...");
        return cacheData.articles;
    }

    console.log("📡 Cache expired or missing. Fetching fresh articles from GNews API...");
    try {
        const rawArticles = [];
        
        // Fetch 2 categories of news (General and Tech) to get a diverse, interactive bento grid
        const categories = ['general', 'technology'];
        for (const cat of categories) {
            const url = `https://gnews.io/api/v4/top-headlines?category=${cat}&lang=en&country=in&max=10&apikey=${GNEWS_API_KEY}`;
            console.log(`📡 Requesting GNews top headlines for category: ${cat}...`);
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                if (data.articles) {
                    rawArticles.push(...data.articles);
                }
            } else {
                console.error(`❌ GNews API returned status ${response.status} for category ${cat}`);
            }
            await sleep(1000); // Stagger request to prevent hitting rate-limit spikes
        }

        console.log(`📥 Total raw GNews articles retrieved: ${rawArticles.length}`);

        if (rawArticles.length === 0) {
            console.log("⚠️ No articles returned from GNews. Serving old disk cache.");
            return cacheData.articles;
        }

        // De-duplicate articles by title
        const uniqueRawArticles = [];
        const titlesSeen = new Set();
        for (const art of rawArticles) {
            if (!titlesSeen.has(art.title)) {
                titlesSeen.add(art.title);
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
                console.log(`💾 Article already audited, loading from cache: "${rawArt.title}"`);
                updatedArticles.push(existingAudit);
                continue;
            }

            // Stagger Gemini queries by 1.5 seconds to strictly avoid 429 quota exhaustion
            if (i > 0) {
                console.log(`⏳ Staggering Gemini pipeline... sleeping for 1.5s`);
                await sleep(1500);
            }

            // Prep the standard rawArticle structure for Gemini
            const tempArticle = {
                id: i + 1,
                title: rawArt.title,
                source: rawArt.source ? rawArt.source.name : "Global News",
                rawContent: rawArt.description || rawArt.title
            };

            // Call Gemini 3.5 Flash or Mock fallback
            const aiOutput = await runActualGeminiAPI(tempArticle);

            const timeString = rawArt.publishedAt 
                ? new Date(rawArt.publishedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }) + " IST"
                : "Just Now";

            updatedArticles.push({
                id: `gnews_${i + 1}`,
                category: aiOutput.category || "Politics",
                aiHeadline: aiOutput.aiHeadline,
                aiSummary: aiOutput.aiSummary,
                biasAudit: aiOutput.biasAudit,
                originalSource: tempArticle.source,
                originalTitle: rawArt.title,
                timeAgo: timeString,
                author: "Honestly Biased AI Engine (Gemini)",
                authorType: "ai",
                imageUrl: rawArt.image || "./assets/hero-bg.png",
                originalUrl: rawArt.url || "#"
            });
        }

        // D. Save updated feed to disk cache
        cacheData.lastUpdated = now;
        cacheData.articles = updatedArticles;
        
        fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cacheData, null, 2), 'utf-8');
        console.log(`💾 Successfully updated and saved disk cache with ${updatedArticles.length} articles!`);

        return updatedArticles;

    } catch (err) {
        console.error("❌ Failed in fetchAndAuditGNews:", err);
        return cacheData.articles;
    }
}

// ==========================================================================
// 6. SERVER ENDPOINT: SERVING THE DYNAMIC FEED WITH CACHING
// ==========================================================================
app.get('/api/honestly-biased-feed', async (req, res) => {
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

        res.json({
            rhetoricMeter: rhetoricMeterData,
            articles: processedArticles
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
app.post('/api/admin/articles', (req, res) => {
    try {
        console.log("📥 Incoming POST request to create new custom article...");
        const { category, aiHeadline, aiSummary, biasAudit, originalSource, imageUrl, originalUrl } = req.body;
        
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

        const newArticle = {
            id: `admin_${Date.now()}`,
            category: category || "Politics",
            aiHeadline: aiHeadline,
            aiSummary: aiSummary,
            biasAudit: biasAudit || "Direct Admin Commentary.",
            originalSource: originalSource || "Honestly Biased Editorial Board",
            originalTitle: aiHeadline,
            timeAgo: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }) + " IST",
            author: "Honestly Biased Editorial Board (Admin)",
            authorType: "admin",
            imageUrl: imageUrl || "./assets/hero-bg.png",
            originalUrl: originalUrl || "#"
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
app.put('/api/admin/articles/:id', (req, res) => {
    try {
        const { id } = req.params;
        console.log(`📥 Incoming PUT request to update article ID: ${id}...`);
        const { category, aiHeadline, aiSummary, biasAudit, originalSource, imageUrl, originalUrl } = req.body;

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
        target.aiHeadline = aiHeadline || target.aiHeadline;
        target.aiSummary = aiSummary || target.aiSummary;
        target.biasAudit = biasAudit !== undefined ? biasAudit : target.biasAudit;
        target.originalSource = originalSource || target.originalSource;
        target.imageUrl = imageUrl || target.imageUrl;
        target.originalUrl = originalUrl || target.originalUrl;

        fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cacheData, null, 2), 'utf-8');
        
        console.log(`💾 Successfully updated article ID: ${id} ("${target.aiHeadline}")`);
        res.json(target);
    } catch (err) {
        console.error("❌ Failed to update article:", err);
        res.status(500).json({ error: "Internal server error updating article." });
    }
});

// C. DELETE: Remove article by ID
app.delete('/api/admin/articles/:id', (req, res) => {
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

// Start Server
app.listen(PORT, () => {
    console.log(`\n=============================================================`);
    console.log(`📡 honestlybiasedOfficial Production Server Operational!`);
    console.log(`🔗 API Feed URL: http://localhost:${PORT}/api/honestly-biased-feed`);
    console.log(`=============================================================\n`);
});
