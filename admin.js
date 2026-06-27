document.addEventListener('DOMContentLoaded', () => {
    let allArticles = [];
    let searchFilterQuery = "";

    // SELECT DOM ELEMENTS
    const adminArticlesList = document.getElementById('admin-articles-list');
    const cmsArticleForm = document.getElementById('cms-article-form');
    const searchInput = document.getElementById('cms-search');

    // STATS METRIC LABELS
    const statTotal = document.getElementById('stat-total');
    const statEditorial = document.getElementById('stat-editorial');
    const statAi = document.getElementById('stat-ai');
    const statCategories = document.getElementById('stat-categories');

    // FORM FIELDS
    const cmsArticleId = document.getElementById('cms-article-id');
    const cmsCategory = document.getElementById('cms-category');
    const cmsRegion = document.getElementById('cms-region');
    const cmsSource = document.getElementById('cms-source');
    const cmsHeadline = document.getElementById('cms-headline');
    const cmsBiasAudit = document.getElementById('cms-bias-audit');
    const cmsSummary = document.getElementById('cms-summary');
    const cmsFullBlog = document.getElementById('cms-full-blog');
    const cmsImageUrl = document.getElementById('cms-image-url');
    const cmsOriginalUrl = document.getElementById('cms-original-url');
    const cmsPreviewImg = document.getElementById('cms-preview-img');

    // HEADERS AND SUBMIT BUTTONS
    const cmsFormTitle = document.getElementById('cms-form-title');
    const cmsFormSubtitle = document.getElementById('cms-form-subtitle');
    const btnCmsSubmit = document.getElementById('btn-cms-submit');
    const btnCmsReset = document.getElementById('btn-cms-reset');

    // AUDIENCE DIRECTORY DOM ELEMENTS
    const subscribersList = document.getElementById('subscribers-list');
    const subCountBadge = document.getElementById('sub-count-badge');
    const btnExportSubscribers = document.getElementById('btn-export-subscribers');

    // Load initial CMS data. The dedicated /api/admin/articles endpoint is
    // fast because it just reads from the database (no GNews burst). The
    // homepage feed endpoint can take ~17s on cold start while it refills
    // GNews cache, so we never use it for hydration.
    async function loadCMSData() {
        console.log("📡 Fetching CMS articles for hydration...");
        try {
            const response = await fetch('/api/admin/articles');
            if (response.ok) {
                const data = await response.json();
                allArticles = Array.isArray(data) ? data : [];

                updateStatsMetrics();
                populateManagerList();
            } else {
                console.error("Failed to load CMS articles:", response.status);
            }
        } catch (error) {
            console.error("CMS could not connect to server:", error);
        }
    }

    // Live Image cover preview sync
    if (cmsImageUrl) {
        cmsImageUrl.addEventListener('input', () => {
            const url = cmsImageUrl.value.trim();
            if (url) {
                cmsPreviewImg.src = url;
            } else {
                cmsPreviewImg.src = "./assets/hero-bg.png";
            }
        });
        
        // Handle image loading error gracefully
        cmsPreviewImg.addEventListener('error', () => {
            cmsPreviewImg.src = "./assets/hero-bg.png";
        });
    }

    // Dynamic stats metrics counter re-calculations
    function updateStatsMetrics() {
        if (!allArticles) return;

        const total = allArticles.length;
        const customCount = allArticles.filter(a => a.authortype === 'admin').length;
        const aiCount = allArticles.filter(a => a.authortype === 'ai' || a.authortype === 'instagram').length;

        // Categories set
        const categoriesSeen = new Set();
        allArticles.forEach(a => {
            if (a.category) {
                categoriesSeen.add(a.category.toLowerCase().trim());
            }
        });
        const categoryCount = categoriesSeen.size || 0;

        // Animate counter values
        animateCounter(statTotal, total);
        animateCounter(statEditorial, customCount);
        animateCounter(statAi, aiCount);
        animateCounter(statCategories, categoryCount);
    }

    function animateCounter(element, targetValue) {
        if (!element) return;
        element.textContent = targetValue;
    }

    // Populate the high-fidelity admin list cards
    function populateManagerList() {
        if (!adminArticlesList) return;
        adminArticlesList.innerHTML = '';

        // Filter based on search input query
        const query = searchFilterQuery.toLowerCase().trim();
        const filtered = allArticles.filter(article => {
            const matchHeadline = article.aiheadline && article.aiheadline.toLowerCase().includes(query);
            const matchSource = article.originalsource && article.originalsource.toLowerCase().includes(query);
            const matchCategory = article.category && article.category.toLowerCase().includes(query);
            const matchAuthor = article.author && article.author.toLowerCase().includes(query);
            return matchHeadline || matchSource || matchCategory || matchAuthor;
        });

        if (filtered.length === 0) {
            adminArticlesList.innerHTML = `
                <div style="padding: 64px 24px; text-align: center; color: var(--text-muted);">
                    <i data-lucide="search-code" style="width: 44px; height: 44px; margin-bottom: 16px; color: var(--accent-saffron); opacity: 0.7;"></i>
                    <h3 style="font-family:var(--font-heading); font-size:1.1rem; color:var(--text-primary); margin-bottom:6px;">No chronicles matched criteria</h3>
                    <p style="font-size: 0.8rem; max-width: 320px; margin: 0 auto;">Refine your search parameters or write a fresh custom editorial draft.</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        filtered.forEach(article => {
            const card = document.createElement('div');
            card.className = 'admin-card-row';

            let badgeClass = 'badge-ai';
            let badgeText = '🤖 AI Audited';
            if (article.authortype === 'admin') {
                badgeClass = 'badge-admin';
                badgeText = '✍️ Editorial';
            } else if (article.authortype === 'instagram') {
                badgeClass = 'badge-instagram';
                badgeText = '🎥 IG Video';
            }

            const cardImageUrl = article.imageurl || "./assets/hero-bg.png";

            let regionBadge = '🇮🇳 Indian';
            if (article.region === 'world') regionBadge = '🌐 World';
            else if (article.region === 'uk') regionBadge = '🇬🇧 UK';

            card.innerHTML = `
                <!-- Thumbnail Cover Preview -->
                <div class="admin-row-thumb" style="background-image: url('${cardImageUrl}')">
                    <span class="admin-row-tag">${article.category}</span>
                </div>
                
                <!-- Card content meta -->
                <div class="admin-row-body">
                    <h3 class="admin-row-title">${article.aiheadline}</h3>
                    
                    <div class="admin-row-meta">
                        <span class="author-type-badge ${badgeClass}">${badgeText}</span>
                        <span class="author-type-badge" style="background: rgba(255,255,255,0.05); color: var(--text-secondary); border: 1px solid var(--border-glass);">${regionBadge}</span>
                        <span><i data-lucide="globe"></i> ${article.originalsource || 'Honestly Biased'}</span>
                        <span><i data-lucide="clock"></i> ${article.timeago}</span>
                    </div>
                </div>
                
                <!-- Action triggers -->
                <div class="admin-row-actions">
                    <button class="btn-action act-edit" data-id="${article.id}" title="Refine Satirical Text">
                        <i data-lucide="edit-3"></i>
                    </button>
                    <button class="btn-action act-delete" data-id="${article.id}" title="Permanently Scrub News Card">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            `;
            adminArticlesList.appendChild(card);
        });

        lucide.createIcons();

        // Bind Edit buttons to load fields and transition state
        adminArticlesList.querySelectorAll('.act-edit').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const article = allArticles.find(a => String(a.id) === String(id));
                if (article) {
                    cmsArticleId.value = article.id;
                    cmsCategory.value = article.category;
                    cmsRegion.value = article.region || 'indian';
                    cmsSource.value = article.originalsource || '';
                    cmsHeadline.value = article.aiheadline;
                    cmsBiasAudit.value = article.biasaudit;
                    cmsSummary.value = article.aisummary;
                    if (cmsFullBlog) cmsFullBlog.value = article.fullblog || '';
                    cmsImageUrl.value = article.imageurl || '';
                    cmsOriginalUrl.value = article.originalurl || '';
                    
                    // Trigger live preview reload
                    cmsPreviewImg.src = article.imageurl || "./assets/hero-bg.png";
                    
                    // Show edit mode headers
                    cmsFormTitle.textContent = "Refine News Chronicle";
                    cmsFormSubtitle.textContent = "Refine satirical headlines, critical summaries or narrative bias audits.";
                    btnCmsSubmit.textContent = "Save Changes";
                    btnCmsReset.style.display = "inline-flex";
                    
                    // Smoothly scroll the creator form into view on mobile screens
                    document.querySelector('.cms-grid').scrollIntoView({ behavior: 'smooth' });
                }
            });
        });

        // Bind Delete buttons to server DELETE endpoint
        adminArticlesList.querySelectorAll('.act-delete').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const article = allArticles.find(a => String(a.id) === String(id));
                if (!article) return;

                if (confirm(`Scrub and erase "${article.aiheadline}" permanently from the database cache?`)) {
                    try {
                        const response = await fetch(`/api/admin/articles/${id}`, {
                            method: 'DELETE'
                        });
                        
                        if (response.ok) {
                            console.log(`🗑️ Successfully deleted article ID: ${id}`);
                            // Update local state instantly (0ms)
                            allArticles = allArticles.filter(a => String(a.id) !== String(id));
                            
                            updateStatsMetrics();
                            populateManagerList();
                            
                            // Reset form if we were currently editing the deleted article
                            if (cmsArticleId.value === String(id)) {
                                cancelEditMode();
                            }
                        } else {
                            alert("Failed to delete the article from Express database cache.");
                        }
                    } catch (err) {
                        console.error("Delete CMS request failed:", err);
                        alert("Cannot connect to honestlybiasedOfficial backend server.");
                    }
                }
            });
        });
    }

    // Submit Editor Form: POST or PUT requests
    if (cmsArticleForm) {
        cmsArticleForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const id = cmsArticleId.value;
            const payload = {
                category: cmsCategory.value,
                region: cmsRegion.value,
                originalsource: cmsSource.value || "Honestly Biased Editorial Board",
                aiheadline: cmsHeadline.value,
                biasaudit: cmsBiasAudit.value,
                aisummary: cmsSummary.value,
                fullblog: cmsFullBlog ? cmsFullBlog.value : "",
                imageurl: cmsImageUrl.value || "./assets/hero-bg.png",
                originalurl: cmsOriginalUrl.value || "#"
            };

            try {
                let response;
                if (id) {
                    // Update: PUT request
                    response = await fetch(`/api/admin/articles/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                } else {
                    // Create: POST request
                    response = await fetch('/api/admin/articles', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                }

                if (response.ok) {
                    const savedArticle = await response.json();
                    console.log("💾 Persisted changes successfully updated on server:", savedArticle);

                    if (id) {
                        // Locate and replace article in local state in-place (0ms update)
                        const idx = allArticles.findIndex(a => String(a.id) === String(id));
                        if (idx !== -1) {
                            allArticles[idx] = { ...allArticles[idx], ...savedArticle };
                        }
                    } else {
                        // Unshift custom human editorial at the front so it appears first
                        allArticles.unshift(savedArticle);
                    }

                    // Return to clean form state
                    cancelEditMode();
                    
                    // Re-render
                    updateStatsMetrics();
                    populateManagerList();
                } else {
                    alert("Failed to submit article details to database cache.");
                }
            } catch (err) {
                console.error("CMS Form Submission Failed:", err);
                alert("Cannot connect to honestlybiasedOfficial backend server.");
            }
        });
    }

    function cancelEditMode() {
        if (cmsArticleForm) cmsArticleForm.reset();
        if (cmsArticleId) cmsArticleId.value = '';
        if (cmsFullBlog) cmsFullBlog.value = '';
        
        cmsFormTitle.textContent = "Draft Custom Editorial";
        cmsFormSubtitle.textContent = "Write an opinionated editorial that unshifts to the very front of the ledger.";
        btnCmsSubmit.textContent = "Publish Editorial";
        btnCmsReset.style.display = "none";
        
        cmsPreviewImg.src = "./assets/hero-bg.png";
    }

    if (btnCmsReset) {
        btnCmsReset.addEventListener('click', cancelEditMode);
    }

    // Real-time live inventory list search bar filter (0ms delay)
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            searchFilterQuery = searchInput.value;
            populateManagerList();
        });
    }

    // ==========================================================================
    // INSTAGRAM INTEGRATION CONTROLLERS
    // ==========================================================================
    const igHandleInput = document.getElementById('ig-handle-input');
    const igRssInput = document.getElementById('ig-rss-input');
    const btnIgConnect = document.getElementById('btn-ig-connect');
    const btnIgSync = document.getElementById('btn-ig-sync');
    const btnIgSimulate = document.getElementById('btn-ig-simulate');
    const igStatusBadge = document.getElementById('ig-status-badge');
    const igAutomationLog = document.getElementById('ig-automation-log');
    
    let isConnected = false;
    let currentLogsLength = 0;

    async function loadInstagramConfig() {
        try {
            const response = await fetch('/api/admin/instagram/config');
            if (response.ok) {
                const data = await response.json();
                const config = data.config || {};
                const logs = data.logs || [];
                
                isConnected = config.connected;
                
                // Update UI state based on connection
                if (isConnected) {
                    igStatusBadge.textContent = 'Active Polling';
                    igStatusBadge.style.border = '1px solid rgba(0, 230, 118, 0.4)';
                    igStatusBadge.style.color = '#00e676';
                    igStatusBadge.style.background = 'rgba(0, 230, 118, 0.05)';
                    
                    igHandleInput.value = config.handle;
                    igHandleInput.disabled = true;
                    if (igRssInput) {
                        igRssInput.value = config.rssUrl || '';
                        igRssInput.disabled = true;
                    }
                    btnIgConnect.textContent = 'Disconnect';
                    btnIgConnect.style.borderColor = 'rgba(178, 41, 46, 0.4)';
                    btnIgConnect.style.color = 'var(--accent-saffron)';
                    btnIgConnect.style.background = 'rgba(178, 41, 46, 0.05)';
                    
                    btnIgSimulate.disabled = false;
                    if (btnIgSync) btnIgSync.style.display = 'inline-block';
                } else {
                    igStatusBadge.textContent = 'Disconnected';
                    igStatusBadge.style.border = '1px solid rgba(255,255,255,0.1)';
                    igStatusBadge.style.color = 'var(--text-muted)';
                    igStatusBadge.style.background = 'rgba(255,255,255,0.02)';
                    
                    igHandleInput.disabled = false;
                    if (igRssInput) {
                        igRssInput.disabled = false;
                        igRssInput.value = config.rssUrl || '';
                    }
                    btnIgConnect.textContent = 'Connect';
                    btnIgConnect.style.borderColor = 'var(--border-color)';
                    btnIgConnect.style.color = 'var(--text-primary)';
                    btnIgConnect.style.background = 'rgba(255, 255, 255, 0.02)';
                    
                    btnIgSimulate.disabled = true;
                    if (btnIgSync) btnIgSync.style.display = 'none';
                }

                // Render Logs
                if (logs.length !== currentLogsLength) {
                    currentLogsLength = logs.length;
                    igAutomationLog.textContent = logs.join('\n');
                    igAutomationLog.scrollTop = igAutomationLog.scrollHeight;
                }
            }
        } catch (error) {
            console.error("Failed to load Instagram configuration:", error);
        }
    }

    if (btnIgConnect) {
        btnIgConnect.addEventListener('click', async () => {
            let handle = igHandleInput.value.trim();
            if (!isConnected && !handle) {
                alert("Please enter a valid Instagram handle to connect.");
                return;
            }

            if (!isConnected && !handle.startsWith('@')) {
                handle = '@' + handle;
                igHandleInput.value = handle;
            }

            const rssUrl = igRssInput ? igRssInput.value.trim() : '';

            const payload = {
                handle: isConnected ? '' : handle,
                rssUrl: isConnected ? '' : rssUrl,
                connected: !isConnected
            };

            btnIgConnect.disabled = true;
            try {
                const response = await fetch('/api/admin/instagram/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (response.ok) {
                    if (!isConnected) {
                        igHandleInput.value = handle;
                        if (igRssInput) igRssInput.value = rssUrl;
                    } else {
                        igHandleInput.value = '';
                        if (igRssInput) igRssInput.value = '';
                    }
                    await loadInstagramConfig();
                } else {
                    alert("Failed to update Instagram connection state.");
                }
            } catch (err) {
                console.error("Instagram config save failed:", err);
                alert("Cannot connect to server.");
            } finally {
                btnIgConnect.disabled = false;
            }
        });
    }

    if (btnIgSync) {
        btnIgSync.addEventListener('click', async () => {
            btnIgSync.disabled = true;
            btnIgSync.textContent = 'Syncing...';
            try {
                const response = await fetch('/api/admin/instagram/sync', {
                    method: 'POST'
                });
                if (response.ok) {
                    const result = await response.json();
                    alert(result.message || "Instagram sync executed.");
                    await loadInstagramConfig();
                } else {
                    const err = await response.json();
                    alert(err.error || "Failed to sync Instagram feed.");
                }
            } catch (err) {
                console.error("Instagram sync request failed:", err);
                alert("Cannot connect to server.");
            } finally {
                btnIgSync.disabled = false;
                btnIgSync.textContent = 'Sync Now';
            }
        });
    }

    const mockCaptions = [
        "Why Bangalore VCs are funding edge-computing soil sensors instead of basic water pipelines for dryland farmers.",
        "A food delivery aggregator app rolls out a 2-minute wellness checkup for delivery riders to optimize their performance while avoiding basic medical insurance liabilities.",
        "A consulting giant HR team pioneers the revolutionary strategy of scheduling pre-meetings to prepare for the planning sessions.",
        "Ministry of Digital Coordination launches a new digital dashboard to track the progress of other digital dashboards.",
        "Legacy prime-time newsroom holds a 1-hour panel debate on whether social media comedy reels are destroying journalistic objectivity."
    ];

    const mockShortcodes = [
        "CP84tADtE4g",
        "C-19t_5uF6n",
        "C5y2G42t7gB",
        "C844oV6t9gA",
        "C9-y4x2t1a8"
    ];

    if (btnIgSimulate) {
        btnIgSimulate.addEventListener('click', async () => {
            btnIgSimulate.disabled = true;
            
            const randomIdx = Math.floor(Math.random() * mockCaptions.length);
            const shortcode = mockShortcodes[randomIdx];
            const caption = mockCaptions[randomIdx];
            
            const payload = {
                mediaId: `ig_reel_${Date.now()}`,
                shortcode: shortcode,
                permalink: `https://www.instagram.com/p/${shortcode}/`,
                caption: caption
            };

            igAutomationLog.textContent += `\n[Simulating Post Event] Sending webhook trigger for reel ${shortcode}...`;
            igAutomationLog.scrollTop = igAutomationLog.scrollHeight;

            try {
                const response = await fetch('/api/instagram/webhook', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    // Instantly reload articles database cache
                    await loadCMSData();
                    await loadInstagramConfig();
                } else {
                    const errData = await response.json();
                    alert(`Simulation failed: ${errData.error || 'Server error'}`);
                }
            } catch (err) {
                console.error("Simulation failed:", err);
                alert("Cannot connect to server.");
            } finally {
                btnIgSimulate.disabled = false;
            }
        });
    }

    // Live logging polling (stream logs every 3 seconds)
    setInterval(loadInstagramConfig, 3000);
    loadInstagramConfig();

    // ==========================================================================
    // TICKER HIGHLIGHTS EDITOR CONTROLLER
    // ==========================================================================
    const cmsHighlightsForm = document.getElementById('cms-highlights-form');
    const cmsHighlightsInput = document.getElementById('cms-highlights-input');
    const btnHighlightsSubmit = document.getElementById('btn-highlights-submit');

    async function loadHighlightsConfig() {
        try {
            const response = await fetch('/api/admin/highlights');
            if (response.ok) {
                const highlights = await response.json();
                if (cmsHighlightsInput) {
                    cmsHighlightsInput.value = highlights.join('\n');
                }
            }
        } catch (error) {
            console.error("Failed to load ticker highlights:", error);
        }
    }

    if (cmsHighlightsForm) {
        cmsHighlightsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const rawText = cmsHighlightsInput.value;
            const highlightsArray = rawText.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);

            if (highlightsArray.length === 0) {
                alert("Please enter at least one highlight headline.");
                return;
            }

            if (btnHighlightsSubmit) btnHighlightsSubmit.disabled = true;

            try {
                const response = await fetch('/api/admin/highlights', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ highlights: highlightsArray })
                });

                if (response.ok) {
                    alert("Ticker highlights successfully updated!");
                    await loadHighlightsConfig();
                } else {
                    alert("Failed to save ticker highlights.");
                }
            } catch (err) {
                console.error("Failed to save highlights:", err);
                alert("Cannot connect to server.");
            } finally {
                if (btnHighlightsSubmit) btnHighlightsSubmit.disabled = false;
            }
        });
    }

    loadHighlightsConfig();

    // ==========================================================================
    // AUDIENCE DIRECTORY CONTROLLER
    // ==========================================================================
    async function loadSubscribers() {
        if (!subscribersList) return;
        try {
            const response = await fetch('/api/admin/subscribers');
            if (response.ok) {
                const subscribers = await response.json();
                
                // Update badge count
                if (subCountBadge) {
                    subCountBadge.textContent = `${subscribers.length} ${subscribers.length === 1 ? 'Subscriber' : 'Subscribers'}`;
                }

                // Render list
                if (subscribers.length === 0) {
                    subscribersList.innerHTML = `<div style="color: var(--text-muted); text-align: center; padding-top: 50px;">No subscribers loaded.</div>`;
                } else {
                    subscribersList.innerHTML = subscribers.map(sub => {
                        const localDate = new Date(sub.subscribedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' });
                        return `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1.5px solid rgba(255, 255, 255, 0.02); font-size: 0.8rem;">
                                <span style="color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 60%;">${sub.email}</span>
                                <span style="color: var(--text-muted); font-size: 0.7rem;">${localDate}</span>
                            </div>
                        `;
                    }).join('');
                }
            }
        } catch (error) {
            console.error("Failed to load subscribers:", error);
        }
    }

    if (btnExportSubscribers) {
        btnExportSubscribers.addEventListener('click', () => {
            // Simply open the export route in a new tab or window, which triggers file download
            window.open('/api/admin/subscribers/export', '_blank');
        });
    }

    // Load subscribers initial load and poll every 10 seconds
    loadSubscribers();
    setInterval(loadSubscribers, 10000);

    // Initialize CMS data loading
    loadCMSData();
});
