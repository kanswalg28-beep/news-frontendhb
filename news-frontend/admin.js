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
    const cmsSource = document.getElementById('cms-source');
    const cmsHeadline = document.getElementById('cms-headline');
    const cmsBiasAudit = document.getElementById('cms-bias-audit');
    const cmsSummary = document.getElementById('cms-summary');
    const cmsImageUrl = document.getElementById('cms-image-url');
    const cmsOriginalUrl = document.getElementById('cms-original-url');
    const cmsPreviewImg = document.getElementById('cms-preview-img');

    // HEADERS AND SUBMIT BUTTONS
    const cmsFormTitle = document.getElementById('cms-form-title');
    const cmsFormSubtitle = document.getElementById('cms-form-subtitle');
    const btnCmsSubmit = document.getElementById('btn-cms-submit');
    const btnCmsReset = document.getElementById('btn-cms-reset');

    // Load initial feed cache from Express API
    async function loadCMSData() {
        console.log("📡 Fetching feed database cache for CMS hydration...");
        try {
            const response = await fetch('http://127.0.0.1:3000/api/honestly-biased-feed');
            if (response.ok) {
                const data = await response.json();
                allArticles = data.articles || [];
                
                updateStatsMetrics();
                populateManagerList();
            } else {
                console.error("Failed to load feed cache:", response.status);
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
        const customCount = allArticles.filter(a => a.authorType === 'admin').length;
        const aiCount = total - customCount;

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
            const matchHeadline = article.aiHeadline && article.aiHeadline.toLowerCase().includes(query);
            const matchSource = article.originalSource && article.originalSource.toLowerCase().includes(query);
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

            const isAi = article.authorType !== 'admin';
            const badgeClass = isAi ? 'badge-ai' : 'badge-admin';
            const badgeText = isAi ? '🤖 AI Audited' : '✍️ Editorial';

            const cardImageUrl = article.imageUrl || "./assets/hero-bg.png";

            card.innerHTML = `
                <!-- Thumbnail Cover Preview -->
                <div class="admin-row-thumb" style="background-image: url('${cardImageUrl}')">
                    <span class="admin-row-tag">${article.category}</span>
                </div>
                
                <!-- Card content meta -->
                <div class="admin-row-body">
                    <h3 class="admin-row-title">${article.aiHeadline}</h3>
                    
                    <div class="admin-row-meta">
                        <span class="author-type-badge ${badgeClass}">${badgeText}</span>
                        <span><i data-lucide="globe"></i> ${article.originalSource || 'Honestly Biased'}</span>
                        <span><i data-lucide="clock"></i> ${article.timeAgo}</span>
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
                    cmsSource.value = article.originalSource || '';
                    cmsHeadline.value = article.aiHeadline;
                    cmsBiasAudit.value = article.biasAudit;
                    cmsSummary.value = article.aiSummary;
                    cmsImageUrl.value = article.imageUrl || '';
                    cmsOriginalUrl.value = article.originalUrl || '';
                    
                    // Trigger live preview reload
                    cmsPreviewImg.src = article.imageUrl || "./assets/hero-bg.png";
                    
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

                if (confirm(`Scrub and erase "${article.aiHeadline}" permanently from the database cache?`)) {
                    try {
                        const response = await fetch(`http://127.0.0.1:3000/api/admin/articles/${id}`, {
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
                originalSource: cmsSource.value || "Honestly Biased Editorial Board",
                aiHeadline: cmsHeadline.value,
                biasAudit: cmsBiasAudit.value,
                aiSummary: cmsSummary.value,
                imageUrl: cmsImageUrl.value || "./assets/hero-bg.png",
                originalUrl: cmsOriginalUrl.value || "#"
            };

            try {
                let response;
                if (id) {
                    // Update: PUT request
                    response = await fetch(`http://127.0.0.1:3000/api/admin/articles/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                } else {
                    // Create: POST request
                    response = await fetch('http://127.0.0.1:3000/api/admin/articles', {
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

    // Initialize CMS data loading
    loadCMSData();
});
