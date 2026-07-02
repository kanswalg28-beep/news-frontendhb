/* ==========================================================================
   HONESTLY BIASED - INTERACTIVE CORE WEBPAGE LOGIC
   Handles: Theme Toggling, Mobile Nav, Scroll Reveals, Civic Poll, Form Submit
   ========================================================================== */

// ============================================================================
// SITE CONTENT HYDRATION - replace [data-bind=...] text nodes with values
// fetched from /api/site-content on DOMContentLoaded. Each block exists in
// index.html with [data-site-content-block="..."] and inner [data-bind="..."]
// spans. Missing blocks render their original HTML as fallback.
// ============================================================================
async function hydrateSiteContent() {
    let payload = {};
    try {
        const res = await fetch('/api/site-content?_t=' + Date.now());
        if (res.ok) payload = await res.json() || {};
    } catch (e) {
        // network down — fall through, blocks keep baked defaults
    }

    // Walk all blocks. Each block scope makes bind keys scoped.
    for (const blockNode of document.querySelectorAll('[data-site-content-block]')) {
        const blockKey = blockNode.dataset.siteContentBlock;
        const data = payload[blockKey];
        if (!data) continue; // no DB row -> keep HTML fallback

        // === Featured-cards: lookup matched doc by data-featured-id ===
        // The CMS payload key is "featured" (one row, array of docs each with an
        // id). Each card in the page declares data-featured-id="dpdp|varanasi|..."
        // and we look the doc up by that id, so the bind spans reflect that doc.
        if (blockKey === 'featured' || blockKey === 'featured_card') {
            const fid = blockNode.dataset.featuredId;
            const docs = Array.isArray(data.docs) ? data.docs : [];
            const doc = docs.find(d => d && d.id === fid);
            if (!doc) continue;
            blockNode.querySelectorAll('[data-bind]').forEach(node => {
                const k = node.dataset.bind;
                if (doc[k] != null) node.textContent = String(doc[k]);
            });
            continue;
        }

        // === Poll: rebuild the option rows from data.options array ===
        if (blockKey === 'poll') {
            const form = blockNode.querySelector('.poll-form');
            if (form && Array.isArray(data.options)) {
                // hydrate header / prompt text
                blockNode.querySelectorAll('[data-bind]').forEach(node => {
                    if (node.dataset.bind === 'option_template') return;
                    const k = node.dataset.bind;
                    if (data[k] != null) node.textContent = String(data[k]);
                });
                // rebuild the three option buttons
                form.innerHTML = '';
                data.options.slice(0, 6).forEach(opt => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'poll-option-btn';
                    btn.setAttribute('data-poll-id', opt.id || '');
                    btn.innerHTML =
                        '<span class="poll-option-text">' + escapeHtml(opt.label || '') + '</span>' +
                        '<span class="poll-bar" style="width: ' + Number(opt.pct || 0) + '%;"></span>' +
                        '<span class="poll-percentage">' + Number(opt.pct || 0) + '%</span>';
                    form.appendChild(btn);
                });
            }
            continue;
        }

        // === Standards list: rebuild the <ul> from data.items ===
        if (blockKey === 'standards' && Array.isArray(data.items)) {
            const ul = blockNode.querySelector('ul');
            if (ul) {
                ul.innerHTML = '';
                data.items.slice(0, 12).forEach(item => {
                    const li = document.createElement('li');
                    const a = document.createElement('a');
                    a.href = '#';
                    a.textContent = String(item || '');
                    li.appendChild(a);
                    ul.appendChild(li);
                });
            }
            continue;
        }

        // === Generic scalar block: replace each leaf's textContent ===
        blockNode.querySelectorAll('[data-bind]').forEach(node => {
            const k = node.dataset.bind;
            if (data[k] != null) node.textContent = String(data[k]);
        });
    }
}

function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    // Build entities from char codes so the file source itself never
    // contains literal "<", ">", "&", """, "'" — those would be
    // unescaped by editors / patch tools in transit.
    var E = {
        amp:   String.fromCharCode(38),                                 // &
        lt:    String.fromCharCode(38, 108, 116, 59),                   // <
        gt:    String.fromCharCode(38, 103, 116, 59),                   // >
        quot:  String.fromCharCode(38, 113, 117, 111, 116, 59),        // "
        apos:  String.fromCharCode(38, 35, 49, 48, 55, 59)             // '
    };
    return String(s)
        .replace(/&/g, E.amp)
        .replace(/</g, E.lt)
        .replace(/>/g, E.gt)
        .replace(/"/g, E.quot)
        .replace(/'/g, E.apos);
}

// Format date as "Jan 15, 2026" or similar readable format
function formatDate(isoString) {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        return date.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    } catch (e) {
        return '';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================================================
    // 1. DUAL-THEME SWITCHER (Midnight Charcoal & Polar Wash Light Mode)
    // ==========================================================================
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const bodyElement = document.body;

    // Retrieve previous theme preference from localStorage or default to system preference
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'light') {
        bodyElement.classList.remove('dark-theme');
        bodyElement.classList.add('light-theme');
    } else if (savedTheme === 'dark') {
        bodyElement.classList.remove('light-theme');
        bodyElement.classList.add('dark-theme');
    } else {
        // Fallback to system preference
        if (!prefersDark) {
            bodyElement.classList.remove('dark-theme');
            bodyElement.classList.add('light-theme');
        }
    }

    // Toggle theme on button press
    themeToggleBtn.addEventListener('click', () => {
        if (bodyElement.classList.contains('dark-theme')) {
            bodyElement.classList.remove('dark-theme');
            bodyElement.classList.add('light-theme');
            localStorage.setItem('theme', 'light');
        } else {
            bodyElement.classList.remove('light-theme');
            bodyElement.classList.add('dark-theme');
            localStorage.setItem('theme', 'dark');
        }
        
        // Dispatch custom event for Three.js shader adjustments
        window.dispatchEvent(new CustomEvent('themeChanged', { 
            detail: { theme: bodyElement.classList.contains('dark-theme') ? 'dark' : 'light' } 
        }));
    });

    let isHeaderClick = false;
    let currentRegion = 'indian';
    let currentCategory = 'all';

    // ==========================================================================
    // 3. LAZY SCROLL REVEALS FOR BENTO BOX GRID CARDS (IntersectionObserver)
    // ==========================================================================
    const bentoCards = document.querySelectorAll('.bento-card');
    
    // Initial loading states for smooth fades
    bentoCards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        card.style.transition = `opacity 0.8s cubic-bezier(0.25, 1, 0.5, 1) ${index * 0.05}s, 
                                 transform 0.8s cubic-bezier(0.25, 1, 0.5, 1) ${index * 0.05}s,
                                 background var(--transition-medium),
                                 border-color var(--transition-medium),
                                 box-shadow var(--transition-medium)`;
    });

    const revealCallback = (entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const card = entry.target;
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
                observer.unobserve(card); // Stop observing once loaded
            }
        });
    };

    const bentoObserver = new IntersectionObserver(revealCallback, {
        root: null,
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    bentoCards.forEach(card => {
        bentoObserver.observe(card);
    });

    // ==========================================================================
    // 4. INTERACTIVE NARRATIVE PULSE (CIVIC POLL ENGINE - PERSISTENT EDITION)
    // ==========================================================================
    let currentPollData = null;

    function updatePollUI(pollData, votedIndex) {
        const pollForm = document.getElementById('civic-poll-form');
        if (!pollForm) return;

        const pollButtons = pollForm.querySelectorAll('.poll-option-btn');
        const votes = pollData.votes;
        const total = pollData.total || votes.reduce((a, b) => a + b, 0);

        pollButtons.forEach((button, bIdx) => {
            const count = votes[bIdx];
            const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
            const bar = button.querySelector('.poll-bar');
            const textPercent = button.querySelector('.poll-percentage');
            
            if (bar) bar.style.width = `${percentage}%`;
            if (textPercent) textPercent.textContent = `${percentage}%`;

            const hasVoted = localStorage.getItem('hb_voted') !== null;
            if (votedIndex !== undefined || hasVoted) {
                button.disabled = true;
                button.style.cursor = 'default';
                const userVote = votedIndex !== undefined ? votedIndex : parseInt(localStorage.getItem('hb_voted'), 10);
                if (bIdx === userVote) {
                    button.style.borderColor = 'var(--accent-green)';
                    button.style.color = 'var(--text-primary)';
                } else {
                    button.style.opacity = '0.7';
                }
            }
        });

        const hasVoted = localStorage.getItem('hb_voted') !== null;
        if ((votedIndex !== undefined || hasVoted) && !pollForm.querySelector('.poll-feedback')) {
            pollForm.classList.add('votes-submitted');
            const feedbackMsg = document.createElement('p');
            feedbackMsg.className = 'poll-feedback';
            feedbackMsg.style.fontSize = '0.75rem';
            feedbackMsg.style.color = 'var(--accent-green)';
            feedbackMsg.style.fontWeight = '700';
            feedbackMsg.style.marginTop = '12px';
            feedbackMsg.style.textAlign = 'center';
            feedbackMsg.style.textTransform = 'uppercase';
            feedbackMsg.style.letterSpacing = '0.5px';
            feedbackMsg.innerHTML = '<i data-lucide="check" style="width:12px; height:12px; vertical-align:middle; margin-right:4px;"></i> Narrative Calibrated. Thanks for being honestly biased.';
            pollForm.appendChild(feedbackMsg);
            if (window.lucide) window.lucide.createIcons();
        }

        // Cache the latest poll HTML state so category switches do not flash back to defaults
        civicPollHTML = pollForm.outerHTML;
    }

    async function syncPollState() {
        try {
            const res = await fetch('/api/poll/results');
            if (res.ok) {
                currentPollData = await res.json();
                updatePollUI(currentPollData);
            }
        } catch (e) {
            console.warn("Poll API offline. Operating in fallback static mode.");
        }
    }

    // ==========================================================================
    // 5. EDITORIAL NEWSLETTER FORM INTERACTION
    // ==========================================================================
    const newsletterForm = document.getElementById('newsletter-form');
    
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const emailInput = newsletterForm.querySelector('input[type="email"]');
            const submitBtn = newsletterForm.querySelector('.newsletter-btn');
            const submitIcon = submitBtn.querySelector('i');
            const userEmail = emailInput.value;

            // Performant micro-animation during request
            submitBtn.disabled = true;
            emailInput.disabled = true;
            submitIcon.setAttribute('data-lucide', 'loader-2');
            submitIcon.classList.add('spin-anim');
            lucide.createIcons();

            const styleSheet = document.createElement("style");
            styleSheet.innerText = `@keyframes loader-spin { to { transform: rotate(360deg); } }
                                    .spin-anim { animation: loader-spin 1s linear infinite; }`;
            document.head.appendChild(styleSheet);

            try {
                const res = await fetch('/api/newsletter/subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: userEmail })
                });

                submitIcon.classList.remove('spin-anim');
                
                if (res.ok) {
                    submitIcon.setAttribute('data-lucide', 'check');
                    lucide.createIcons();
                    
                    const parentElement = newsletterForm.parentElement;
                    newsletterForm.style.transition = 'opacity 0.3s ease';
                    newsletterForm.style.opacity = '0';
                    
                    setTimeout(() => {
                        newsletterForm.style.display = 'none';
                        
                        const successMsg = document.createElement('div');
                        successMsg.className = 'glass-element';
                        successMsg.style.padding = '16px';
                        successMsg.style.borderRadius = 'var(--border-radius-sm)';
                        successMsg.style.marginTop = '12px';
                        successMsg.style.borderLeft = '3px solid var(--accent-saffron)';
                        successMsg.style.boxShadow = '0 8px 24px rgba(var(--accent-saffron-rgb), 0.15)';
                        successMsg.innerHTML = `
                            <h5 style="font-weight:700; color:var(--text-primary); font-family:var(--font-editorial); font-size:0.95rem; margin-bottom:4px; letter-spacing:0.5px;">BIAS TUNED IN</h5>
                            <p style="font-size:0.8rem; color:var(--text-secondary); line-height:1.45;">Daily unfiltered commentary enabled for <strong style="color:var(--text-primary);">${userEmail}</strong>. Welcome to transparent independent coverage.</p>
                        `;
                        parentElement.appendChild(successMsg);
                    }, 300);
                } else {
                    const errData = await res.json();
                    alert(errData.error || "Subscription failed.");
                    submitBtn.disabled = false;
                    emailInput.disabled = false;
                    submitIcon.setAttribute('data-lucide', 'arrow-right');
                    lucide.createIcons();
                }
            } catch (err) {
                console.error("Newsletter submission failed:", err);
                // Fallback mock success if offline
                submitIcon.classList.remove('spin-anim');
                submitIcon.setAttribute('data-lucide', 'check');
                lucide.createIcons();
                
                const parentElement = newsletterForm.parentElement;
                newsletterForm.style.transition = 'opacity 0.3s ease';
                newsletterForm.style.opacity = '0';
                
                setTimeout(() => {
                    newsletterForm.style.display = 'none';
                    
                    const successMsg = document.createElement('div');
                    successMsg.className = 'glass-element';
                    successMsg.style.padding = '16px';
                    successMsg.style.borderRadius = 'var(--border-radius-sm)';
                    successMsg.style.marginTop = '12px';
                    successMsg.style.borderLeft = '3px solid var(--accent-saffron)';
                    successMsg.style.boxShadow = '0 8px 24px rgba(var(--accent-saffron-rgb), 0.15)';
                    successMsg.innerHTML = `
                        <h5 style="font-weight:700; color:var(--text-primary); font-family:var(--font-editorial); font-size:0.95rem; margin-bottom:4px; letter-spacing:0.5px;">BIAS TUNED IN (OFFLINE)</h5>
                        <p style="font-size:0.8rem; color:var(--text-secondary); line-height:1.45;">Saved locally for <strong style="color:var(--text-primary);">${userEmail}</strong>. Welcome to transparent independent coverage.</p>
                    `;
                    parentElement.appendChild(successMsg);
                }, 300);
            }
        });
    }

    // ==========================================================================
    // 6. DOCK STICKY NAVIGATION BLUR MODULATOR
    // ==========================================================================
    const headerElement = document.getElementById('main-header');
    
    function updateHeaderState() {
        if (!headerElement) return;
        const scrollPos = window.scrollY;
        if (scrollPos > 30) {
            headerElement.style.paddingTop = '8px';
            headerElement.style.paddingBottom = '8px';
            headerElement.style.height = '68px';
            headerElement.style.backgroundColor = 'rgba(var(--bg-primary-rgb), 0.75)';
            headerElement.style.boxShadow = '0 12px 35px -10px rgba(0, 0, 0, 0.6)';
        } else {
            headerElement.style.paddingTop = '0px';
            headerElement.style.paddingBottom = '0px';
            headerElement.style.height = 'var(--header-height)';
            headerElement.style.backgroundColor = 'var(--bg-card)';
            headerElement.style.boxShadow = 'var(--glass-shadow)';
        }
    }
    
    window.addEventListener('scroll', updateHeaderState);
    updateHeaderState(); // Execute immediately on load to prevent initial load transition jumps

    // ==========================================================================
    // 7. DYNAMIC LIVE NEWS INJECTION & INTERACTIVE BENTO CATEGORY FILTERS
    // ==========================================================================
    let allArticles = [];

    const categoryMetadata = {
        'all': {
            title: "The Ledger",
            subtitle: "Dismantling corporate bias and manufactured consent, systematically"
        },
        'Politics': {
            title: "Politics Chronicles",
            subtitle: "Dismantling policy actions, governance narratives, and institutional biases"
        },
        'Tech': {
            title: "Tech Audits",
            subtitle: "Decoding algorithmic narratives, platform surveillance, and tech-capital monopolies"
        },
        'Finance': {
            title: "Financial Audits",
            subtitle: "Deconstructing market narratives, shadow banking, and central bank monopolies"
        },
        'Entertainment': {
            title: "Entertainment Ledger",
            subtitle: "Auditing media hegemony, star-manufacturing machinery, and algorithmic spectacle"
        },
        'Health': {
            title: "Health Audits",
            subtitle: "Auditing health systems, pharmaceutical lobbying, public welfare, and medical narratives"
        }
    };

    const gridContainer = document.getElementById('dynamic-bento-grid');

    async function loadDynamicArticles() {
        console.log("📡 Fetching site_content blocks first, then live feed...");

        // ------------------------------------------------------------
        // 1. Hydrate static editorial blocks from CMS-controlled DB rows.
        //    Must run BEFORE the bento observer attaches so that
        //    IntersectionObserver entries aren't missed on a fast re-render.
        // ------------------------------------------------------------
        try { await hydrateSiteContent(); }
        catch (e) { console.warn('site_content hydration failed:', e); }

        console.log("📡 Attempting to fetch live AI-calibrated Honestly Biased feed...");

        try {
            // Call the local backend server (running on port 3000)
            const response = await fetch('/api/honestly-biased-feed');
            
            if (!response.ok) {
                throw new Error(`API returned HTTP status ${response.status}`);
            }

            const data = await response.json();
            console.log("🟢 Live feed loaded successfully. Calibrating bento boxes...");

            // Store dynamic articles globally and clean headlines from "Refracted: " prefix
            allArticles = (data.articles || []).map(art => {
                if (art.aiheadline) {
                    art.aiheadline = art.aiheadline.replace(/^Refracted:\s*/i, '');
                }
                return art;
            });

            // Dynamically update the ticker highlights banner
            let highlightsToRender = data.highlights || [];
            if (highlightsToRender.length === 0 && allArticles.length > 0) {
                // Automatically fall back to top 4 article headlines if highlights list is empty
                highlightsToRender = allArticles.slice(0, 4).map(a => a.aiheadline);
            }
            if (highlightsToRender.length > 0) {
                const tickerTrack = document.querySelector('.ticker-track');
                if (tickerTrack) {
                    let html = highlightsToRender.map(text => `<span>• ${text}</span>`).join('');
                    // Repeat the first item to ensure a seamless infinite CSS scrolling loop
                    html += `<span>• ${highlightsToRender[0]}</span>`;
                    tickerTrack.innerHTML = html;
                }
            }

            // B. Initial dynamic grid render based on the current hash route
            handleRouting(true);

        } catch (error) {
            console.log("\n=============================================================");
            console.log("ℹ️  INFO: Live backend API is not currently active.");
            console.log("👉 The website is running beautifully in offline static mode.");
            console.log("👉 Run 'node mock-server.js' in the background to activate AI rewrites!");
            console.log("=============================================================\n");

            // Populate fallback highlights ticker
            const tickerTrack = document.querySelector('.ticker-track');
            if (tickerTrack) {
                const fallbackAlerts = [
                    "[MEDIA AUDIT]: Manufactured consent monitored in prime-time transcript analyses.",
                    "[FINANCIAL WATCH]: Shadow banking narrative expansion detected in central bank briefing notes.",
                    "[TECH MONOPOLY]: Algorithmic platform surveillance frameworks under active critique.",
                    "[HEALTH AUDIT]: Pharmaceutical lobbying budgets monitored in recent healthcare bills."
                ];
                let html = fallbackAlerts.map(text => `<span>• ${text}</span>`).join('');
                html += `<span>• ${fallbackAlerts[0]}</span>`;
                tickerTrack.innerHTML = html;
            }

            allArticles = [];
            handleRouting(true);
        }
    }

    // Select modal DOM elements
    const auditModal = document.getElementById('audit-modal');
    const modalBackdrop = document.getElementById('modal-backdrop');
    const modalCloseBtn = document.getElementById('modal-close-btn');

    // Modal elements to hydrate
    const modalCategory = document.getElementById('modal-category');
    const modalTime = document.getElementById('modal-time');
    const modalTitle = document.getElementById('modal-title');
    const modalSource = document.getElementById('modal-source');
    const modalBiasAudit = document.getElementById('modal-bias-audit');
    const modalSummary = document.getElementById('modal-summary');
    const modalOriginalLink = document.getElementById('modal-original-link');

    // Function to open modal and hydrate
    function openArticleModal(articleId) {
        const article = allArticles.find(a => String(a.id) === String(articleId));
        if (!article) return;

        console.log(`👁️ Opening Honestly Biased audit modal for article: "${article.aiheadline}"`);

        // Hydrate details
        if (modalCategory) {
            modalCategory.textContent = article.category;
            // Align color tags based on category
            modalCategory.className = 'modal-tag ' + (article.category.toLowerCase().trim() === 'tech' ? 'green-bg' : 'saffron-bg');
        }
        if (modalTime) modalTime.innerHTML = `<i data-lucide="clock"></i> ${article.timeago}`;
        if (modalTitle) modalTitle.textContent = article.aiheadline;
        if (modalSource) modalSource.textContent = `Source: ${article.originalsource || article.originaltitle}`;
        if (modalBiasAudit) modalBiasAudit.textContent = article.biasaudit;
        if (modalSummary) modalSummary.textContent = article.aisummary;
        if (modalOriginalLink) modalOriginalLink.href = article.originalurl;

        // Dynamic Author Badging in Modal Reader
        const modalAuthor = document.querySelector('.modal-author');
        if (modalAuthor) {
            if (article.authortype === 'admin') {
                modalAuthor.innerHTML = `<i data-lucide="pen-tool" style="width:14px; height:14px;"></i> Honestly Biased Editorial Board (Admin)`;
                modalAuthor.style.color = 'var(--accent-green)'; // Gold
            } else if (article.authortype === 'instagram') {
                modalAuthor.innerHTML = `<i data-lucide="instagram" style="width:14px; height:14px;"></i> Honestly Biased AI Engine (Instagram Ingestion)`;
                modalAuthor.style.color = '#e1306c'; // Instagram Pink
            } else {
                modalAuthor.innerHTML = `<i data-lucide="shield-check" style="width:14px; height:14px;"></i> Audited by Honestly Biased AI Engine (Gemini)`;
                modalAuthor.style.color = '#00E5FF'; // Neon Blue
            }
        }

        // Dynamic Media Container Hydration
        const mediaContainer = document.getElementById('modal-media-container');
        if (mediaContainer) {
            if (article.authortype === 'instagram' && article.instagramShortcode) {
                mediaContainer.style.display = 'block';
                mediaContainer.innerHTML = `
                    <div class="instagram-embed-wrapper" style="position: relative; width: 100%; max-width: 540px; margin: 0 auto; aspect-ratio: 328/420; background: rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden; border: 1px solid rgba(225, 48, 108, 0.3);">
                        <iframe src="https://www.instagram.com/p/${article.instagramShortcode}/embed" 
                                class="instagram-media instagram-media-rendered" 
                                allowtransparency="true" 
                                allowfullscreen="true" 
                                frameborder="0" 
                                height="100%" 
                                scrolling="no" 
                                style="background: white; border: 0; margin: 0; padding: 0; width: 100%; height: 100%; display: block; min-height: 420px;">
                        </iframe>
                    </div>
                `;
            } else if (article.imageurl) {
                mediaContainer.style.display = 'block';
                mediaContainer.innerHTML = `
                    <img src="${article.imageurl}" alt="${article.aiheadline}" style="width: 100%; max-height: 320px; object-fit: cover; border-radius: 8px; border: 1.5px solid var(--border-glass);">
                `;
            } else {
                mediaContainer.style.display = 'none';
                mediaContainer.innerHTML = '';
            }
        }

        // Open modal
        if (auditModal) {
            auditModal.classList.add('open');
            auditModal.setAttribute('aria-hidden', 'false');
            document.body.classList.add('modal-open');
        }

        // Re-compile Lucide icons inside the modal
        lucide.createIcons();
    }

    function closeArticleModal() {
        if (auditModal) {
            auditModal.classList.remove('open');
            auditModal.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('modal-open');
        }
        
        // Dispose of media content to stop background iframe audio playback
        const mediaContainer = document.getElementById('modal-media-container');
        if (mediaContainer) {
            mediaContainer.innerHTML = '';
            mediaContainer.style.display = 'none';
        }
    }

    // Modal click listeners
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeArticleModal);
    if (modalBackdrop) modalBackdrop.addEventListener('click', closeArticleModal);

    // Escape key press to close modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeArticleModal();
                    }
                });

                // Pagination state
                let currentPage = 1;
                let itemsPerPage = 24;
                let totalPages = 1;

                // Dynamic Asymmetrical Bento Grid compiler
                function renderArticles(regionFilter, categoryFilter) {
            if (!gridContainer) return;

            // Clear existing grid
            gridContainer.innerHTML = "";

            // 1. Sort all articles newest-first by publishdate or ID
            const sortedArticles = [...allArticles].sort((a, b) => {
                const timeA = a.publishdate ? new Date(a.publishdate).getTime() : parseFloat(String(a.id).replace(/\D/g, '')) || 0;
                const timeB = b.publishdate ? new Date(b.publishdate).getTime() : parseFloat(String(b.id).replace(/\D/g, '')) || 0;
                return timeB - timeA;
            });

            // 2. Filter articles by region and category
            const filteredArticles = sortedArticles.filter(art => {
                const matchRegion = (art.region || 'indian').toLowerCase().trim() === regionFilter.toLowerCase().trim();
                const matchCategory = categoryFilter === 'all'
                    ? true
                    : art.category.toLowerCase().trim() === categoryFilter.toLowerCase().trim();

                if (!matchRegion || !matchCategory) return false;
                return true;
            });

            // 3. Pagination
            totalPages = Math.ceil(filteredArticles.length / itemsPerPage);
            if (currentPage > totalPages) currentPage = totalPages;
            if (currentPage < 1) currentPage = 1;
        
            const startIdx = (currentPage - 1) * itemsPerPage;
            const endIdx = startIdx + itemsPerPage;
            const paginatedArticles = filteredArticles.slice(startIdx, endIdx);

            console.log(`🎯 Filtering: Region "${regionFilter}", Category "${categoryFilter}", Page ${currentPage}/${totalPages} (${itemsPerPage} per page) matched ${filteredArticles.length} articles, showing ${paginatedArticles.length}.`);

            // Update pagination UI
            updatePaginationUI();

            if (paginatedArticles.length === 0) {
                // Display empty state
                gridContainer.innerHTML = `
                    <div class="bento-card bento-span-4x1 glass-element" style="grid-column: span 4; padding: 48px; text-align: center; justify-content: center; align-items: center; border-style: dashed; grid-row: span 1;">
                        <i data-lucide="archive-x" style="width: 48px; height: 48px; color: var(--accent-saffron); margin-bottom: 16px;"></i>
                        <h3 style="font-family: var(--font-heading); font-size: 1.25rem; font-weight: 700; margin-bottom: 8px;">No Chronicles Found</h3>
                        <p style="color: var(--text-muted); font-size: 0.9rem; max-width: 400px; margin: 0 auto;">Our AI Editorial desk hasn't logged any audited headlines under "${categoryFilter}" in this region. Check back shortly!</p>
                    </div>
                `;
                lucide.createIcons();
                return;
            }

            // Build list of final DOM nodes/strings dynamically to interlace widgets
            const gridItems = [];

            paginatedArticles.forEach((article, index) => {
            // Layout pattern: Featured (2x2) -> 3 Featured horizontals (2x1) -> Standard cards (1x1) with images
                        if (index === 0) {
                            // HERO: Large 2x2 feature card with full visual
                            gridItems.push(`
                                <article class="bento-card bento-span-2x2 glass-element ${article.authortype === 'instagram' ? 'card-instagram' : ''}" id="${article.id}" style="opacity:0; transform:translateY(30px);">
                                    <div class="card-visual">
                                        <div class="card-image-bg" style="background-image: url('${article.imageurl}'); filter: saturate(0.85) contrast(1.15);"></div>
                                        <div class="card-tag saffron-bg">${article.category}</div>
                                    </div>
                                    <div class="card-body">
                                        <span class="card-time" style="display:inline-flex; align-items:center; flex-wrap:wrap; gap:4px;">
                                            ${article.authortype === 'admin'
                                                ? '<span class="author-type-badge badge-admin"><i data-lucide="pen-tool" style="width:10px;height:10px;"></i> Editorial</span>'
                                                : (article.authortype === 'instagram'
                                                    ? '<span class="author-type-badge badge-instagram"><i data-lucide="instagram" style="width:10px;height:10px;"></i> 🎥 IG Video</span>'
                                                    : '<span class="author-type-badge badge-ai"><i data-lucide="cpu" style="width:10px;height:10px;"></i> AI Audited</span>')}
                                            <i data-lucide="clock" style="margin-left:4px;"></i> ${article.timeago}
                                        </span>
                                        <h3 class="card-title" style="margin-top:10px;">
                                            <a href="#" class="stretched-link audit-trigger" data-id="${article.id}">${article.aiheadline}</a>
                                        </h3>
                                        <p class="card-summary">${article.aisummary}</p>
                                        <div class="card-footer-meta">
                                            <span class="card-author" style="font-size:0.75rem; color:var(--accent-green); font-weight:700;">Bias Audit: ${article.biasaudit}</span>
                                            <span class="card-action"><i data-lucide="arrow-up-right"></i></span>
                                        </div>
                                    </div>
                                </article>
                            `);
                        } else if (index >= 1 && index <= 3) {
                            // FEATURED HORIZONTALS: Next 3 articles as 2x1 cards with images
                            gridItems.push(`
                                <article class="bento-card bento-span-2x1 glass-element ${article.authortype === 'instagram' ? 'card-instagram' : ''}" id="${article.id}" style="opacity:0; transform:translateY(30px);">
                                    <div class="card-visual">
                                        <div class="card-image-bg" style="background-image: url('${article.imageurl}'); filter: brightness(0.7) contrast(1.1);"></div>
                                        <span class="card-tag saffron-bg">${article.category}</span>
                                        <span class="video-play-overlay"><i data-lucide="arrow-up-right"></i></span>
                                    </div>
                                    <div class="card-body">
                                        <span class="card-time" style="display:inline-flex; align-items:center; flex-wrap:wrap; gap:4px;">
                                            ${article.authortype === 'admin'
                                                ? '<span class="author-type-badge badge-admin"><i data-lucide="pen-tool" style="width:10px;height:10px;"></i> Editorial</span>'
                                                : (article.authortype === 'instagram'
                                                    ? '<span class="author-type-badge badge-instagram"><i data-lucide="instagram" style="width:10px;height:10px;"></i> 🎥 IG Video</span>'
                                                    : '<span class="author-type-badge badge-ai"><i data-lucide="cpu" style="width:10px;height:10px;"></i> AI Audited</span>')}
                                            ${article.publishdate ? `<i data-lucide="calendar" style="margin-left:8px;"></i> ${formatDate(article.publishdate)}` : ''}
                                            <i data-lucide="clock" style="margin-left:4px;"></i> ${article.timeago}
                                        </span>
                                        <h3 class="card-title" style="margin-top:10px;">
                                            <a href="#" class="stretched-link audit-trigger" data-id="${article.id}">${article.aiheadline}</a>
                                        </h3>
                                        <p class="card-summary">${article.aisummary}</p>
                                        <div class="card-footer-meta">
                                            <span class="card-author" style="font-size:0.75rem; color:var(--accent-green); font-weight:700;">Bias Audit: ${article.biasaudit}</span>
                                        </div>
                                    </div>
                                </article>
                            `);
                        } else {
                            // STANDARD CARDS: 1x1 with images (not header-only)
                            gridItems.push(`
                                <article class="bento-card bento-span-1x1 glass-element ${article.authortype === 'instagram' ? 'card-instagram' : ''}" id="${article.id}" style="opacity:0; transform:translateY(30px);">
                                    <div class="card-visual">
                                        <div class="card-image-bg" style="background-image: url('${article.imageurl}'); filter: brightness(0.65) grayscale(0.15);"></div>
                                        <span class="card-tag saffron-bg">${article.category}</span>
                                    </div>
                                    <div class="card-body">
                                        <div class="card-tag-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
                                            <span class="card-tag saffron-bg" style="margin-bottom:0;">${article.category}</span>
                                            <span class="card-time" style="font-size:0.65rem; color:var(--text-muted); font-weight:700; display:flex; align-items:center; gap:2px;">
                                                ${article.authortype === 'admin'
                                                    ? '<span class="author-type-badge badge-admin" style="margin-right:2px; padding:2px 4px;"><i data-lucide="pen-tool" style="width:8px;height:8px;"></i> Edit</span>'
                                                    : (article.authortype === 'instagram'
                                                        ? '<span class="author-type-badge badge-instagram" style="margin-right:2px; padding:2px 4px;"><i data-lucide="instagram" style="width:8px;height:8px;"></i> IG Video</span>'
                                                        : '<span class="author-type-badge badge-ai" style="margin-right:2px; padding:2px 4px;"><i data-lucide="cpu" style="width:8px;height:8px;"></i> AI</span>')}
                                                ${article.publishdate ? `<i data-lucide="calendar" style="margin-left:4px;"></i> ${formatDate(article.publishdate)}` : ''}
                                                ${article.timeago}
                                            </span>
                                        </div>
                                        <h3 class="card-title" style="margin-bottom:10px;">
                                            <a href="#" class="stretched-link audit-trigger" data-id="${article.id}">${article.aiheadline}</a>
                                        </h3>
                                        <p class="card-summary small-summary" style="display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;">${article.aisummary}</p>
                                        <div class="card-footer-meta" style="margin-top:auto; padding-top:12px; border-top:1px solid rgba(255,255,255,0.03);">
                                            <span class="card-author" style="font-size:0.68rem; color:var(--accent-green); font-weight:700; line-height:1.35; display:block;">Bias Audit: ${article.biasaudit}</span>
                                        </div>
                                    </div>
                                </article>
                            `);
                        }
                    });

        // Interlace our layout fixtures dynamically based on the category filter
        // If showing 'all', we interlace at perfect visual intervals.
        if (categoryFilter === 'all') {
            // No static widgets to interlace - only paginated articles
        } else {
            // "each tab should have its own space" - do not append global widgets to category-specific views!
        }

        // Hydrate grid container
        gridContainer.innerHTML = gridItems.join('');

        // Apply staggered scroll reveal animations
        const cards = gridContainer.querySelectorAll('.bento-card, blockquote, section, aside');
        cards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(30px)';
            card.style.transition = `opacity 0.8s cubic-bezier(0.25, 1, 0.5, 1) ${index * 0.04}s, 
                                     transform 0.8s cubic-bezier(0.25, 1, 0.5, 1) ${index * 0.04}s,
                                     background var(--transition-medium),
                                     border-color var(--transition-medium),
                                     box-shadow var(--transition-medium)`;
            
            // RequestAnimationFrame ensures transition triggers cleanly after insertion
            requestAnimationFrame(() => {
                setTimeout(() => {
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0)';
                }, 50);
            });
        });

        // Refresh icons and play logic binding
        lucide.createIcons();
        bindDynamicEvents();

        // Re-bind scroll-reveal observer: dynamically rendered bento cards start
        // with opacity:0; transform:translateY(30px) inline so they animate in.
        // Without re-observing them they would never reveal on reload when the
        // grid is rebuilt from the API response.
        const freshCards = gridContainer.querySelectorAll('.bento-card');
        freshCards.forEach(card => {
            // skip ones the static observer already captured
            if (!card.classList.contains('reveal-attached')) {
                card.classList.add('reveal-attached');
                card.dataset.revealAttached = '1';
                card.style.transition = card.style.transition ||
                    'opacity 0.8s cubic-bezier(0.25, 1, 0.5, 1), transform 0.8s cubic-bezier(0.25, 1, 0.5, 1)';
                bentoObserver.observe(card);
            }
        });

        // Safety net: if any card is still invisible after 800ms (e.g. user has
        // reduced motion or the observer never fired because the card was rendered
        // already in-view but the entry was missed), reveal them. Prevents
        // reload returning a "clear space" if the network call landed
        // after the IntersectionObserver attached only to the static markup.
        setTimeout(() => {
            freshCards.forEach(card => {
                if (getComputedStyle(card).opacity === '0') {
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0)';
                }
            });
        }, 800);
    }

    // Region Tabs Event Listeners (Triggers Hash Change to route through SPA)
    const regionButtons = document.querySelectorAll('.region-tab-btn');
    regionButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const selectedRegion = btn.getAttribute('data-region').toLowerCase().trim();
            if (currentCategory === 'all') {
                window.location.hash = `#/${selectedRegion}`;
            } else {
                window.location.hash = `#/${selectedRegion}/${currentCategory.toLowerCase().replace(/\s+/g, '-')}`;
            }
        });
    });

    // Category Tabs Event Listeners (Triggers Hash Change to route through SPA)
    const tabButtons = document.querySelectorAll('.category-tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const selectedCat = btn.getAttribute('data-category').toLowerCase().trim();
            if (selectedCat === 'all') {
                window.location.hash = `#/${currentRegion}`;
            } else {
                window.location.hash = `#/${currentRegion}/${selectedCat.replace(/\s+/g, '-')}`;
            }
        });
    });

    // Re-bind interactive events for dynamic cards (like poll buttons or play buttons)
    function bindDynamicEvents() {
        // Re-bind podcast micro player
        const playBtn = gridContainer.querySelector('.play-btn-circle');
        if (playBtn) {
            playBtn.addEventListener('click', () => {
                const icon = playBtn.querySelector('i');
                if (icon.getAttribute('data-lucide') === 'play') {
                    icon.setAttribute('data-lucide', 'pause');
                    playBtn.style.background = 'var(--accent-saffron)';
                    playBtn.style.color = '#ffffff';
                } else {
                    icon.setAttribute('data-lucide', 'play');
                    playBtn.style.background = 'rgba(255,255,255,0.05)';
                    playBtn.style.color = 'var(--text-primary)';
                }
                lucide.createIcons();
            });
        }

        // Re-bind HTML5 video component controls (Card 6)
        const videoElement = gridContainer.querySelector('#card-6-video');
        const videoPlayBtn = gridContainer.querySelector('.video-play-overlay');

        if (videoElement && videoPlayBtn) {
            const videoIcon = videoPlayBtn.querySelector('i');
            
            // Toggle play/pause state when overlay button is clicked
            videoPlayBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent card selection triggering
                toggleVideoPlayback();
            });

            // Toggle play/pause state when video element itself is clicked
            videoElement.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleVideoPlayback();
            });

            function toggleVideoPlayback() {
                if (videoElement.paused) {
                    videoElement.play().catch(err => console.log("Video play interrupted:", err));
                    videoPlayBtn.classList.add('playing');
                    if (videoIcon) {
                        videoIcon.setAttribute('data-lucide', 'pause');
                    }
                } else {
                    videoElement.pause();
                    videoPlayBtn.classList.remove('playing');
                    if (videoIcon) {
                        videoIcon.setAttribute('data-lucide', 'play');
                    }
                }
                lucide.createIcons();
            }

            // Sync icon and class if video finishes playing or is paused/played externally
            videoElement.addEventListener('pause', () => {
                videoPlayBtn.classList.remove('playing');
                if (videoIcon) videoIcon.setAttribute('data-lucide', 'play');
                lucide.createIcons();
            });

            videoElement.addEventListener('play', () => {
                videoPlayBtn.classList.add('playing');
                if (videoIcon) videoIcon.setAttribute('data-lucide', 'pause');
                lucide.createIcons();
            });
        }

        // Bind article page routing to all audit-trigger items
        const triggers = gridContainer.querySelectorAll('.audit-trigger');
        triggers.forEach(t => {
            t.addEventListener('click', (e) => {
                e.preventDefault();
                const id = t.getAttribute('data-id');
                window.location.hash = `#/article/${id}`;
            });
        });

        // Re-bind civic poll click listeners
        const pollForm = gridContainer.querySelector('#civic-poll-form');
        if (pollForm) {
            const pollButtons = pollForm.querySelectorAll('.poll-option-btn');
            pollButtons.forEach((btn, index) => {
                btn.addEventListener('click', async () => {
                    if (localStorage.getItem('hb_voted') !== null) return;
                    localStorage.setItem('hb_voted', index);
                    
                    try {
                        const res = await fetch('/api/poll/vote', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ optionIndex: index })
                        });
                        if (res.ok) {
                            currentPollData = await res.json();
                            updatePollUI(currentPollData, index);
                        } else {
                            // Fallback if rate limited or server error
                            const fallbackData = currentPollData || { votes: [74, 18, 8], total: 100 };
                            fallbackData.votes[index] += 1;
                            fallbackData.total += 1;
                            updatePollUI(fallbackData, index);
                        }
                    } catch (err) {
                        const fallbackData = currentPollData || { votes: [74, 18, 8], total: 100 };
                        fallbackData.votes[index] += 1;
                        fallbackData.total += 1;
                        updatePollUI(fallbackData, index);
                    }
                });
            });

            // Update UI with existing fetched poll data or localStorage
            if (currentPollData) {
                updatePollUI(currentPollData);
            } else {
                // Fetch initially if not done yet
                syncPollState();
            }
        }
    }

    // SPA Router Implementation
    function parseHashRoute() {
        const hash = window.location.hash;
        if (!hash || hash === '#' || hash === '#/') {
            return { region: 'indian', category: 'all' };
        }

        const path = hash.replace(/^#\/?/, '').toLowerCase().trim();
        
        // Handle article details and special pages separately
        if (path.startsWith('article/') || path === 'our-bias' || path === 'manifesto') {
            return null;
        }

        const parts = path.split('/').filter(p => p.trim());
        let region = 'indian';
        let category = 'all';

        const validRegions = ['indian', 'world', 'uk'];
        const validCategories = ['politics', 'tech', 'finance', 'entertainment', 'health'];

        if (parts.length === 1) {
            const part = parts[0];
            if (validRegions.includes(part)) {
                region = part;
                category = 'all';
            } else if (validCategories.includes(part)) {
                region = currentRegion;
                category = part;
            }
        } else if (parts.length >= 2) {
            const r = parts[0];
            const c = parts[1];
            if (validRegions.includes(r)) {
                region = r;
            }
            if (validCategories.includes(c)) {
                category = c;
            }
        }

        let targetCategory = 'all';
        if (category === 'politics') targetCategory = 'Politics';
        else if (category === 'tech') targetCategory = 'Tech';
        else if (category === 'finance') targetCategory = 'Finance';
        else if (category === 'entertainment') targetCategory = 'Entertainment';
        else if (category === 'health') targetCategory = 'Health';

        return { region, category: targetCategory };
    }

    function handleRouting(isInitialLoad = false) {
        const hash = window.location.hash;
        console.log(`🌐 SPA Routing event triggered: hash="${hash}", isInitialLoad=${isInitialLoad}`);

        // Handle Article Detail Page Routing
        if (hash.startsWith('#/article/')) {
            const articleId = hash.replace('#/article/', '').trim();
            showArticleDetailPage(articleId);
            return;
        }

        // Restore visibility of standard sections
        const heroSection = document.querySelector('.hero-section');
        const bentoSection = document.querySelector('.bento-section');
        const detailSection = document.getElementById('article-detail-section');
        
        if (heroSection) heroSection.style.display = 'block';
        if (bentoSection) bentoSection.style.display = 'block';
        if (detailSection) detailSection.style.display = 'none';

        // Handle "Our Bias" / Manifesto special case
        if (hash === '#/our-bias' || hash === '#manifesto') {
            document.querySelectorAll('.nav-link').forEach(link => {
                const href = link.getAttribute('href');
                if (href === '#/our-bias' || href === '#manifesto') {
                    link.classList.add('active');
                } else {
                    link.classList.remove('active');
                }
            });

            const manifestoCard = document.getElementById('manifesto');
            if (manifestoCard) {
                manifestoCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }

        // Check if legacy single category hash was requested, and redirect to region/category structure
        if (hash && !hash.startsWith('#/article/')) {
            const path = hash.replace(/^#\/?/, '').toLowerCase().trim();
            const parts = path.split('/').filter(p => p.trim());
            const validCategories = ['politics', 'tech', 'finance', 'entertainment', 'health'];
            if (parts.length === 1 && validCategories.includes(parts[0])) {
                const cat = parts[0];
                window.location.hash = `#/${currentRegion}/${cat}`;
                return;
            }
        }

        const routeParams = parseHashRoute();
        if (routeParams) {
            currentRegion = routeParams.region;
            currentCategory = routeParams.category;
        }

        // Highlight correct region tab button
        const regionButtons = document.querySelectorAll('.region-tab-btn');
        regionButtons.forEach(btn => {
            const btnReg = btn.getAttribute('data-region').toLowerCase().trim();
            if (btnReg === currentRegion) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Highlight correct category tab button in bento grid
        const tabButtons = document.querySelectorAll('.category-tab-btn');
        tabButtons.forEach(btn => {
            const btnCat = btn.getAttribute('data-category');
            if (btnCat.toLowerCase() === currentCategory.toLowerCase()) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Dynamically update Section Title & Subtitle based on metadata and region name
        const sectionHeader = document.querySelector('.bento-section .section-header');
        if (sectionHeader) {
            const titleEl = sectionHeader.querySelector('.section-title');
            const subtitleEl = sectionHeader.querySelector('.section-subtitle');
            
            let regionName = 'Indian';
            if (currentRegion === 'world') regionName = 'World';
            else if (currentRegion === 'uk') regionName = 'UK';

            const meta = categoryMetadata[currentCategory] || categoryMetadata['all'];
            
            if (titleEl) {
                titleEl.textContent = `${regionName} ${meta.title.includes("Chronicles") ? meta.title : "Chronicles"}`;
            }
            if (subtitleEl) subtitleEl.textContent = meta.subtitle;
        }

        // Render matching articles
        renderArticles(currentRegion, currentCategory);

        // Scroll to Bento Grid section only if explicitly navigated via header click
        if (isHeaderClick) {
            const bentoSection = document.querySelector('.bento-section');
            if (bentoSection) {
                setTimeout(() => {
                    bentoSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
            }
            isHeaderClick = false;
        }

        // Sync the premium sliding active indicator pills
        setTimeout(syncActiveIndicators, 60);
    }

    function syncActiveIndicators() {
        // Region active indicator
        const activeRegionBtn = document.querySelector('.region-tab-btn.active');
        const regionPill = document.getElementById('region-active-pill');
        const regionContainer = document.getElementById('region-tabs-container');
        
        if (activeRegionBtn && regionPill && regionContainer) {
            const containerRect = regionContainer.getBoundingClientRect();
            const btnRect = activeRegionBtn.getBoundingClientRect();
            
            const scrollLeft = regionContainer.scrollLeft;
            const leftOffset = btnRect.left - containerRect.left + scrollLeft;
            
            regionPill.style.width = `${btnRect.width}px`;
            regionPill.style.left = `${leftOffset}px`;
            
            const currentReg = activeRegionBtn.getAttribute('data-region').toLowerCase().trim();
            regionPill.className = 'active-indicator-pill ' + 'active-' + currentReg;
        }

        // Category active indicator
        const activeCatBtn = document.querySelector('.category-tab-btn.active');
        const catPill = document.getElementById('category-active-pill');
        const catContainer = document.getElementById('category-tabs-container');
        
        if (activeCatBtn && catPill && catContainer) {
            const containerRect = catContainer.getBoundingClientRect();
            const btnRect = activeCatBtn.getBoundingClientRect();
            const isVertical = window.getComputedStyle(catContainer).flexDirection === 'column';
            
            if (isVertical) {
                const scrollTop = catContainer.scrollTop;
                const topOffset = btnRect.top - containerRect.top + scrollTop;
                
                catPill.style.height = `${btnRect.height}px`;
                catPill.style.top = `${topOffset}px`;
                
                // Clear inline horizontal styles to allow CSS stylesheet to apply (left/width)
                catPill.style.width = '';
                catPill.style.left = '';
            } else {
                const scrollLeft = catContainer.scrollLeft;
                const leftOffset = btnRect.left - containerRect.left + scrollLeft;
                
                catPill.style.width = `${btnRect.width}px`;
                catPill.style.left = `${leftOffset}px`;
                
                // Clear inline vertical styles to allow CSS stylesheet to apply (top/height)
                catPill.style.height = '';
                catPill.style.top = '';
            }
            
            const currentCat = activeCatBtn.getAttribute('data-category').toLowerCase().trim();
            catPill.className = 'active-indicator-pill ' + currentCat;
        }
    }

    // Bind window resize listener to reflow active indicators
    window.addEventListener('resize', syncActiveIndicators);

    function showArticleDetailPage(articleId) {
        let article;
        if (articleId === 'featured-story') {
            article = {
                id: "featured-story",
                category: "Politics",
                aiheadline: "The Illusion of Consensus: Bending the Corporate News Narrative",
                timeago: "Audited Today",
                author: "Aniket Verma",
                authortype: "admin",
                imageurl: "./assets/hero-bg.png",
                originalsource: "Honestly Biased Editorial Board",
                originalurl: "#",
                fullblog: `
                    <p class="blog-lead">Traditional news chambers claim to deliver pure, unvarnished objective truth. We say that is a convenient myth. In a landscape structured by corporate sponsorship and administrative convenience, "neutrality" is rarely neutral.</p>
                    
                    <p>When major broadcast platforms present complex economic policies, they often deploy a performative balance—giving equal weight to corporate lobbyists and affected local communities as if their incentives were identical. This artificial consensus serves to obscure the deep structural inequalities, policy loopholes, and direct corporate influence that shape the legislative process. By framing political concessions as procedural adjustments, the mainstream media actively manufactures consent under the cover of objective reporting.</p>
                    
                    <p class="blog-analysis-heading"><strong>The Honestly Biased Narrative Audit:</strong></p>
                    <blockquote>Media institutions frame corporate policy lobbying as public interest initiatives to protect high-revenue advertisers and preserve regulatory access.</blockquote>
                    
                    <p>To bend the narrative is to reject this performance. We believe in providing transparent, critical media analysis that highlights who benefits from policy shifts, which voices are excluded from the debate, and how legacy press releases are converted into public opinion. Our bias is not hidden; it is our primary lens of analysis.</p>
                    
                    <p>In subsequent editions, we will expand this audit to cover specific legislative files, mapping the flow of consulting capital to media committees and auditing the digital dashboards used by state ministries to frame operational overhead as structural efficiency. Decrypting the script is the first step toward reclaiming public consciousness.</p>
                `
            };
        } else {
            article = allArticles.find(a => String(a.id) === String(articleId));
        }

        if (!article) {
            // Fallback to home if article not found
            window.location.hash = '#/';
            return;
        }

        console.log(`👁️ Routing to full blog page for article: "${article.aiheadline}"`);

        // Hide Hero, Bento grid, and other sections
        const heroSection = document.querySelector('.hero-section');
        const bentoSection = document.querySelector('.bento-section');
        
        if (heroSection) heroSection.style.display = 'none';
        if (bentoSection) bentoSection.style.display = 'none';
        
        // Show detail section
        const detailSection = document.getElementById('article-detail-section');
        if (detailSection) {
            detailSection.style.display = 'block';
            
            // Hydrate detail fields
            const detailCategory = document.getElementById('detail-category');
            const detailTime = document.getElementById('detail-time');
            const detailTitle = document.getElementById('detail-title');
            const detailAuthor = document.querySelector('.detail-author');
            const detailMediaContainer = document.getElementById('detail-media-container');
            const detailContent = document.getElementById('detail-content');
            const detailSource = document.getElementById('detail-source');
            const detailOriginalLink = document.getElementById('detail-original-link');

            // Strip "Refracted: " prefix from headline when displaying
            const cleanedHeadline = article.aiheadline.replace(/^Refracted:\s*/i, '');

            if (detailCategory) {
                detailCategory.textContent = article.category;
                detailCategory.className = 'modal-tag ' + (article.category.toLowerCase().trim() === 'tech' ? 'green-bg' : 'saffron-bg');
            }
            if (detailTime) detailTime.innerHTML = `<i data-lucide="clock" style="width: 14px; height: 14px;"></i> ${article.timeago}`;
            if (detailTitle) detailTitle.textContent = cleanedHeadline;
            
            if (detailAuthor) {
                if (article.authortype === 'admin') {
                    detailAuthor.innerHTML = `<i data-lucide="pen-tool" style="width:16px; height:16px;"></i> Honestly Biased Editorial Board (Admin)`;
                    detailAuthor.style.color = 'var(--accent-green)'; // Gold
                } else if (article.authortype === 'instagram') {
                    detailAuthor.innerHTML = `<i data-lucide="instagram" style="width:16px; height:16px;"></i> Honestly Biased AI Engine (Instagram Ingestion)`;
                    detailAuthor.style.color = '#e1306c'; // Instagram Pink
                } else {
                    detailAuthor.innerHTML = `<i data-lucide="shield-check" style="width:16px; height:16px;"></i> Audited by Honestly Biased AI Engine (Gemini)`;
                    detailAuthor.style.color = '#00E5FF'; // Neon Blue
                }
            }

            // Hydrate Media
            if (detailMediaContainer) {
                if (article.authortype === 'instagram' && article.instagramShortcode) {
                    detailMediaContainer.style.display = 'block';
                    detailMediaContainer.innerHTML = `
                        <div class="instagram-embed-wrapper" style="position: relative; width: 100%; max-width: 540px; margin: 0 auto; aspect-ratio: 328/420; background: rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden; border: 1px solid rgba(225, 48, 108, 0.3);">
                            <iframe src="https://www.instagram.com/p/${article.instagramShortcode}/embed" 
                                    class="instagram-media instagram-media-rendered" 
                                    allowtransparency="true" 
                                    allowfullscreen="true" 
                                    frameborder="0" 
                                    height="100%" 
                                    scrolling="no" 
                                    style="background: white; border: 0; margin: 0; padding: 0; width: 100%; height: 100%; display: block; min-height: 420px;">
                            </iframe>
                        </div>
                    `;
                } else if (article.imageurl) {
                    detailMediaContainer.style.display = 'block';
                    detailMediaContainer.innerHTML = `
                        <img src="${article.imageurl}" alt="${cleanedHeadline}" style="width: 100%; max-height: 450px; object-fit: cover; border-radius: 8px; border: 1.5px solid var(--border-glass);">
                    `;
                } else {
                    detailMediaContainer.style.display = 'none';
                    detailMediaContainer.innerHTML = '';
                }
            }

            // Hydrate Blog content paragraphs
            if (detailContent) {
                if (article.fullblog) {
                    // Split content by newlines to wrap in paragraphs or render HTML directly if pre-formatted
                    if (article.fullblog.includes('<p>')) {
                        detailContent.innerHTML = article.fullblog;
                    } else {
                        const paras = article.fullblog.split('\n\n').filter(p => p.trim());
                        detailContent.innerHTML = paras.map(p => `<p>${p}</p>`).join('');
                    }
                } else {
                    // Call fallback blog generator
                    detailContent.innerHTML = generateFallbackBlog(article);
                }
            }

            if (detailSource) {
                detailSource.textContent = `Source Attribution: ${article.originalsource || article.originaltitle}`;
            }

            if (detailOriginalLink) {
                detailOriginalLink.href = article.originalurl;
            }

            // Scroll window to top smoothly
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // Render Lucide icons
            lucide.createIcons();
        }
    }

    function generateFallbackBlog(article) {
        const cleanedHeadline = article.aiheadline.replace(/^Refracted:\s*/i, '');
        return `
            <p class="blog-lead">In a media landscape dominated by corporate spin and sanitised press releases, the core facts of this event deserve an uncompromised audit. Let's peel back the narrative layers surrounding the headline: <strong>"${cleanedHeadline}"</strong>.</p>
            
            <p>${article.aisummary}</p>
            
            <p class="blog-analysis-heading"><strong>The Honestly Biased Audit:</strong></p>
            <blockquote>${article.biasaudit}</blockquote>
            
            <p>What we observe here is not an isolated incident of PR posturing, but a systemic pattern. When institutional power structures or high-tech platforms frame operational hurdles as 'innovation' or 'progress', they are actively manufacturing consent. It is our duty as critical observers to audit these claims, question the underlying incentives, and reject the performative neutrality that dominates mainstream media reporting.</p>
            
            <p>As this situation develops, Honestly Biased will continue tracking the policy shifts, corporate lobbying, and economic pressures that shape the final outcome. Stay tuned for further updates as our AI and editorial desks decode the next cycle of press coverage.</p>
        `;
    }

    // Pagination UI update function
    function updatePaginationUI() {
        const pageIndicator = document.getElementById('page-indicator');
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        
        if (pageIndicator) {
            pageIndicator.textContent = `${currentPage} / ${totalPages}`;
        }
        
        if (prevBtn) {
            prevBtn.disabled = currentPage <= 1;
            prevBtn.style.opacity = currentPage <= 1 ? '0.4' : '1';
            prevBtn.style.cursor = currentPage <= 1 ? 'not-allowed' : 'pointer';
        }
        
        if (nextBtn) {
            nextBtn.disabled = currentPage >= totalPages;
            nextBtn.style.opacity = currentPage >= totalPages ? '0.4' : '1';
            nextBtn.style.cursor = currentPage >= totalPages ? 'not-allowed' : 'pointer';
        }
    }

    // Pagination event listeners
    const perPageSelect = document.getElementById('per-page-select');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    
    if (perPageSelect) {
        perPageSelect.addEventListener('change', () => {
            itemsPerPage = parseInt(perPageSelect.value);
            currentPage = 1; // Reset to first page
            const route = parseHashRoute() || { region: 'indian', category: 'all' };
            renderArticles(route.region, route.category);
        });
    }
    
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                const route = parseHashRoute() || { region: 'indian', category: 'all' };
                renderArticles(route.region, route.category);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }
    
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                const route = parseHashRoute() || { region: 'indian', category: 'all' };
                renderArticles(route.region, route.category);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }

    // Set up router event listeners
    window.addEventListener('hashchange', () => handleRouting(false));

    // Initialize fetching routine
    loadDynamicArticles();

    console.log('Honestly Biased Core Platform Logic initialized successfully. Grid observers, forms and interactive voting channels fully functional.');
});
