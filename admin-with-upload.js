document.addEventListener('DOMContentLoaded', () => {
    // ==========================================================================
    // CSRF TOKEN HANDLING
    // ==========================================================================
    function getCsrfToken() {
        const meta = document.getElementById('csrf-token');
        return meta ? meta.content : '';
    }

    function setCsrfToken(token) {
        const meta = document.getElementById('csrf-token');
        if (meta) meta.content = token;
    }

    // Fetch CSRF token on load
    async function fetchCsrfToken() {
        try {
            const res = await fetch('/api/admin/csrf-token');
            if (res.ok) {
                const data = await res.json();
                setCsrfToken(data.token);
            }
        } catch (e) {
            console.warn('CSRF token fetch failed:', e);
        }
    }

    // ==========================================================================
    // TOAST NOTIFICATION SYSTEM
    // ==========================================================================
    function showToast(message, type = 'info', duration = 4000) {
        const container = document.getElementById('toast-container') || createToastContainer();
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'polite');
        toast.innerHTML = `
            <span class="toast-message">${escapeHtml(message)}</span>
            <button class="toast-close" aria-label="Dismiss">&times;</button>
        `;
        container.appendChild(toast);
        
        // Animate in
        requestAnimationFrame(() => toast.classList.add('toast-show'));
        
        // Auto dismiss
        const timer = setTimeout(() => dismissToast(toast), duration);
        
        // Manual dismiss
        toast.querySelector('.toast-close').addEventListener('click', () => {
            clearTimeout(timer);
            dismissToast(toast);
        });
    }

    function createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 12px;
            pointer-events: none;
        `;
        document.body.appendChild(container);
        return container;
    }

    function dismissToast(toast) {
        toast.classList.remove('toast-show');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ==========================================================================
    // LOADING STATE HELPERS
    // ==========================================================================
    function setLoading(button, loading = true) {
        if (!button) return;
        if (loading) {
            button.dataset.originalText = button.innerHTML;
            button.disabled = true;
            button.innerHTML = '<i data-lucide="loader" class="spin" style="width:16px;height:16px;margin-right:8px;"></i> Working...';
            lucide.createIcons();
        } else {
            button.disabled = false;
            button.innerHTML = button.dataset.originalText || button.innerHTML;
            lucide.createIcons();
        }
    }

    // ==========================================================================
    // STATE
    // ==========================================================================
    let allArticles = [];
    let searchFilterQuery = "";
    
    // Pagination state
    let currentPage = 1;
    const pageSize = 20;
    let totalPages = 1;
    let totalArticles = 0;
    let currentSortBy = 'publishdate';
    let currentSortOrder = 'desc';

    // SELECT DOM ELEMENTS
    const adminArticlesList = document.getElementById('admin-articles-list');
    const cmsArticleForm = document.getElementById('cms-article-form');
    const searchInput = document.getElementById('cms-search');
    
    // Pagination DOM elements (will be created dynamically)
    let paginationContainer = null;

    // STATS METRIC LABELS
    const statTotal = document.getElementById('stat-total');
    const statEditorial = document.getElementById('stat-editorial');
    const statAi = document.getElementById('stat-ai');
    const statCategories = document.getElementById('stat-categories');

    // FORM FIELDS - Article Form
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
    const cmsPublishDate = document.getElementById('cms-publish-date');

    // FILE UPLOAD ELEMENTS - Article Form
    const cmsImageUpload = document.getElementById('cms-image-upload');
    const cmsImageUploadBtn = document.getElementById('cms-image-upload-btn');
    const cmsImageUploadStatus = document.getElementById('cms-image-upload-status');

    // HEADERS AND SUBMIT BUTTONS
    const cmsFormTitle = document.getElementById('cms-form-title');
    const cmsFormSubtitle = document.getElementById('cms-form-subtitle');
    const btnCmsSubmit = document.getElementById('btn-cms-submit');
    const btnCmsReset = document.getElementById('btn-cms-reset');

    // HERO FORM ELEMENTS
    const heroForm = document.getElementById('cms-hero-form');
    const heroEyebrow = document.getElementById('hero-eyebrow');
    const heroReadtime = document.getElementById('hero-readtime');
    const heroHeadline = document.getElementById('hero-headline');
    const heroBody = document.getElementById('hero-body');
    const heroByline = document.getElementById('hero-byline');
    const heroBylineRole = document.getElementById('hero-byline-role');
    const heroCta = document.getElementById('hero-cta');
    const heroImageUrl = document.getElementById('hero-image-url');
    const heroImageUpload = document.getElementById('hero-image-upload');
    const heroImageUploadBtn = document.getElementById('hero-image-upload-btn');
    const heroImageUploadStatus = document.getElementById('hero-image-upload-status');
    const heroPreviewImg = document.getElementById('hero-preview-img');

    // HIGHLIGHTS FORM ELEMENTS
    const highlightsForm = document.getElementById('cms-highlights-form');
    const highlightsInput = document.getElementById('cms-highlights-input');
    const btnHighlightsSubmit = document.getElementById('btn-highlights-submit');

    // INSTAGRAM ELEMENTS
    const igHandleInput = document.getElementById('ig-handle-input');
    const igRssInput = document.getElementById('ig-rss-input');
    const btnIgConnect = document.getElementById('btn-ig-connect');
    const btnIgSync = document.getElementById('btn-ig-sync');
    const btnIgSimulate = document.getElementById('btn-ig-simulate');
    const igStatusBadge = document.getElementById('ig-status-badge');
    const igAutomationLog = document.getElementById('ig-automation-log');

    // AUDIENCE DIRECTORY
    const subscribersList = document.getElementById('subscribers-list');
    const subCountBadge = document.getElementById('sub-count-badge');
    const btnExportSubscribers = document.getElementById('btn-export-subscribers');

    // SORT CONTROLS
    const sortBySelect = document.getElementById('cms-sort-by');
    const sortOrderSelect = document.getElementById('cms-sort-order');

    // ==========================================================================
    // IMAGE UPLOAD TO SERVER (not base64)
    // ==========================================================================
    async function uploadImageToServer(file, statusEl, btnEl) {
        const validation = validateImageFile(file);
        if (!validation.valid) {
            showUploadStatus(statusEl, validation.error, 'error');
            return null;
        }

        showUploadStatus(statusEl, `Uploading ${file.name}...`, 'info');
        if (btnEl) btnEl.classList.add('uploading');

        const formData = new FormData();
        formData.append('image', file);

        try {
            const res = await fetch('/api/admin/upload', {
                method: 'POST',
                headers: {
                    'X-CSRF-Token': getCsrfToken()
                },
                body: formData
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Upload failed');
            }

            const data = await res.json();
            showUploadStatus(statusEl, `Uploaded: ${data.url}`, 'success');
            if (btnEl) btnEl.classList.remove('uploading');
            return data.url;
        } catch (error) {
            console.error('Image upload error:', error);
            showUploadStatus(statusEl, error.message, 'error');
            if (btnEl) btnEl.classList.remove('uploading');
            return null;
        }
    }

    function validateImageFile(file, maxSizeMB = 2) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            return { valid: false, error: 'Only JPEG, PNG, WebP, and GIF images are allowed.' };
        }
        if (file.size > maxSizeMB * 1024 * 1024) {
            return { valid: false, error: `Image must be smaller than ${maxSizeMB}MB.` };
        }
        return { valid: true };
    }

    function showUploadStatus(statusEl, message, type) {
        if (!statusEl) return;
        statusEl.textContent = message;
        statusEl.className = 'file-upload-status ' + type;
    }

    // Setup file upload handlers
    function setupFileUpload(uploadInput, uploadBtn, statusEl, previewImg, urlInput) {
        if (!uploadInput || !uploadBtn) return;

        uploadBtn.addEventListener('click', () => uploadInput.click());

        uploadInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                const url = await uploadImageToServer(file, statusEl, uploadBtn);
                if (url) {
                    if (previewImg) previewImg.src = url;
                    if (urlInput) urlInput.value = url;
                }
            }
        });

        // Drag and drop on preview area
        if (previewImg && previewImg.parentElement) {
            const wrapper = previewImg.parentElement;
            wrapper.addEventListener('dragover', (e) => {
                e.preventDefault();
                wrapper.style.borderColor = 'var(--accent-cyan)';
                wrapper.style.background = 'rgba(0, 229, 255, 0.05)';
            });
            wrapper.addEventListener('dragleave', () => {
                wrapper.style.borderColor = '';
                wrapper.style.background = '';
            });
            wrapper.addEventListener('drop', async (e) => {
                e.preventDefault();
                wrapper.style.borderColor = '';
                wrapper.style.background = '';
                const file = e.dataTransfer.files[0];
                if (file) {
                    uploadInput.files = e.dataTransfer.files;
                    const url = await uploadImageToServer(file, statusEl, uploadBtn);
                    if (url) {
                        if (previewImg) previewImg.src = url;
                        if (urlInput) urlInput.value = url;
                    }
                }
            });
        }
    }

    // Sync URL input changes to preview (existing functionality)
    function setupUrlSync(urlInput, previewImg) {
        if (!urlInput) return;
        urlInput.addEventListener('input', () => {
            const url = urlInput.value.trim();
            if (previewImg) previewImg.src = url || "./assets/hero-bg.png";
        });
        if (previewImg) {
            previewImg.addEventListener('error', () => {
                previewImg.src = "./assets/hero-bg.png";
            });
        }
    }

    // Initialize file uploads
    setupFileUpload(cmsImageUpload, cmsImageUploadBtn, cmsImageUploadStatus, cmsPreviewImg, cmsImageUrl);
    setupFileUpload(heroImageUpload, heroImageUploadBtn, heroImageUploadStatus, heroPreviewImg, heroImageUrl);
    setupUrlSync(cmsImageUrl, cmsPreviewImg);
    setupUrlSync(heroImageUrl, heroPreviewImg);

    // ==========================================================================
    // API HELPER WITH CSRF
    // ==========================================================================
    async function apiRequest(path, options = {}) {
        const csrf = getCsrfToken();
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        if (csrf) headers['X-CSRF-Token'] = csrf;

        const res = await fetch(path, {
            ...options,
            headers
        });

        if (res.status === 401) {
            showToast('Session expired. Please refresh the page.', 'error');
            setTimeout(() => window.location.reload(), 2000);
            throw new Error('Unauthorized');
        }

        return res;
    }

    // ==========================================================================
    // CMS DATA LOADING (with pagination)
    // ==========================================================================
    async function loadCMSData() {
        console.log("📡 Fetching CMS articles for hydration...");
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            
            const params = new URLSearchParams({
                page: currentPage,
                limit: pageSize,
                sortBy: currentSortBy,
                sortOrder: currentSortOrder
            });
            
            const response = await fetch(`/api/admin/articles?${params.toString()}&_t=` + Date.now(), {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                // Handle both old format (array) and new format (object with pagination)
                if (Array.isArray(data)) {
                    allArticles = data;
                    totalArticles = data.length;
                    totalPages = 1;
                } else {
                    allArticles = data.articles || [];
                    totalArticles = data.pagination?.total || allArticles.length;
                    totalPages = data.pagination?.totalPages || 1;
                    currentPage = data.pagination?.page || 1;
                }
                updateStatsMetrics();
                populateManagerList();
                renderPagination();
            } else {
                console.error("Failed to load CMS articles:", response.status);
                showToast('Failed to load articles', 'error');
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error("CMS could not connect to server:", error);
                showToast('Cannot connect to server', 'error');
            }
        }
    }

    // ==========================================================================
    // STATS & LIST RENDERING
    // ==========================================================================
    function updateStatsMetrics() {
        if (!allArticles) return;
        const total = allArticles.length;
        const customCount = allArticles.filter(a => a.authortype === 'admin').length;
        const aiCount = allArticles.filter(a => a.authortype === 'ai' || a.authortype === 'instagram').length;
        const categoriesSeen = new Set();
        allArticles.forEach(a => { if (a.category) categoriesSeen.add(a.category.toLowerCase().trim()); });
        animateCounter(statTotal, total);
        animateCounter(statEditorial, customCount);
        animateCounter(statAi, aiCount);
        animateCounter(statCategories, categoriesSeen.size);
    }

    function animateCounter(element, targetValue) {
        if (!element) return;
        element.textContent = targetValue;
    }

    function populateManagerList() {
        if (!adminArticlesList) return;
        adminArticlesList.innerHTML = '';

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
            card.setAttribute('role', 'listitem');

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
                <div class="admin-row-thumb" style="background-image: url('${escapeHtml(cardImageUrl)}')">
                    <span class="admin-row-tag">${escapeHtml(article.category)}</span>
                </div>
                <div class="admin-row-body">
                    <h3 class="admin-row-title">${escapeHtml(article.aiheadline)}</h3>
                    <div class="admin-row-meta">
                        <span class="author-type-badge ${badgeClass}">${escapeHtml(badgeText)}</span>
                        <span class="author-type-badge" style="background: rgba(255,255,255,0.05); color: var(--text-secondary); border: 1px solid var(--border-glass);">${escapeHtml(regionBadge)}</span>
                        <span><i data-lucide="globe"></i> ${escapeHtml(article.originalsource || 'Honestly Biased')}</span>
                        <span><i data-lucide="clock"></i> ${escapeHtml(article.timeago)}</span>
                    </div>
                </div>
                <div class="admin-row-actions">
                    <button class="btn-action act-edit" data-id="${escapeHtml(article.id)}" title="Refine Satirical Text" aria-label="Edit article ${escapeHtml(article.aiheadline)}">
                        <i data-lucide="edit-3"></i>
                    </button>
                    <button class="btn-action act-delete" data-id="${escapeHtml(article.id)}" title="Permanently Scrub News Card" aria-label="Delete article ${escapeHtml(article.aiheadline)}">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            `;
            adminArticlesList.appendChild(card);
        });

        lucide.createIcons();

        // Bind Edit buttons
        adminArticlesList.querySelectorAll('.act-edit').forEach(btn => {
            btn.addEventListener('click', () => loadArticleForEdit(btn.getAttribute('data-id')));
        });

        // Bind Delete buttons
        adminArticlesList.querySelectorAll('.act-delete').forEach(btn => {
            btn.addEventListener('click', () => deleteArticle(btn.getAttribute('data-id')));
        });
    }

    // ==========================================================================
    // PAGINATION RENDERING
    // ==========================================================================
    function renderPagination() {
        // Find or create pagination container
        let container = document.getElementById('pagination-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'pagination-container';
            container.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                margin-top: 24px;
                padding: 16px;
                flex-wrap: wrap;
            `;
            adminArticlesList.parentElement.appendChild(container);
        }
        
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }
        
        let html = `
            <div style="color: var(--text-muted); font-size: 0.85rem; margin-right: 16px;">
                Page ${currentPage} of ${totalPages} (${totalArticles} total)
            </div>
        `;
        
        // Previous button
        html += `
            <button class="btn btn-secondary pagination-btn" 
                    data-page="${currentPage - 1}" 
                    ${currentPage <= 1 ? 'disabled' : ''}
                    aria-label="Previous page">
                <i data-lucide="chevron-left" style="width: 16px; height: 16px;"></i>
            </button>
        `;
        
        // Page numbers
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);
        
        if (startPage > 1) {
            html += `<button class="btn btn-secondary pagination-btn" data-page="1">1</button>`;
            if (startPage > 2) {
                html += `<span style="color: var(--text-muted); padding: 0 8px;">...</span>`;
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            html += `
                <button class="btn ${i === currentPage ? 'btn-primary' : 'btn-secondary'} pagination-btn" 
                        data-page="${i}" 
                        ${i === currentPage ? 'aria-current="page"' : ''}>
                    ${i}
                </button>
            `;
        }
        
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                html += `<span style="color: var(--text-muted); padding: 0 8px;">...</span>`;
            }
            html += `<button class="btn btn-secondary pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
        }
        
        // Next button
        html += `
            <button class="btn btn-secondary pagination-btn" 
                    data-page="${currentPage + 1}" 
                    ${currentPage >= totalPages ? 'disabled' : ''}
                    aria-label="Next page">
                <i data-lucide="chevron-right" style="width: 16px; height: 16px;"></i>
            </button>
        `;
        
        container.innerHTML = html;
        lucide.createIcons();
        
        // Bind pagination buttons
        container.querySelectorAll('.pagination-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = parseInt(btn.getAttribute('data-page'));
                if (!isNaN(page) && page !== currentPage && page >= 1 && page <= totalPages) {
                    currentPage = page;
                    loadCMSData();
                }
            });
        });
    }

    async function loadArticleForEdit(id) {
        const article = allArticles.find(a => String(a.id) === String(id));
        if (!article) return;

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
        
        if (cmsPublishDate && article.publishdate) {
            const d = new Date(article.publishdate);
            const pad = n => String(n).padStart(2, '0');
            cmsPublishDate.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        } else if (cmsPublishDate) {
            cmsPublishDate.value = '';
        }

        cmsPreviewImg.src = article.imageurl || "./assets/hero-bg.png";
        if (cmsImageUploadStatus) {
            cmsImageUploadStatus.textContent = '';
            cmsImageUploadStatus.className = 'file-upload-status';
        }

        cmsFormTitle.textContent = "Refine News Chronicle";
        cmsFormSubtitle.textContent = "Refine satirical headlines, critical summaries or narrative bias audits.";
        btnCmsSubmit.textContent = "Save Changes";
        btnCmsReset.style.display = "inline-flex";
        
        document.querySelector('.cms-grid').scrollIntoView({ behavior: 'smooth' });
    }

    async function deleteArticle(id) {
        const article = allArticles.find(a => String(a.id) === String(id));
        if (!article) return;

        if (!confirm(`Scrub and erase "${article.aiheadline}" permanently from the database cache?`)) return;

        try {
            const res = await apiRequest(`/api/admin/articles/${id}`, { method: 'DELETE' });
            
            if (res.ok) {
                showToast('Article deleted', 'success');
                // Reload data to get updated pagination
                await loadCMSData();
                if (cmsArticleId.value === String(id)) cancelEditMode();
            } else {
                showToast('Failed to delete article', 'error');
            }
        } catch (err) {
            console.error("Delete failed:", err);
            if (err.message !== 'Unauthorized') showToast('Cannot connect to server', 'error');
        }
    }

    function cancelEditMode() {
        if (cmsArticleForm) cmsArticleForm.reset();
        if (cmsArticleId) cmsArticleId.value = '';
        if (cmsFullBlog) cmsFullBlog.value = '';
        if (cmsPublishDate) cmsPublishDate.value = '';
        cmsPreviewImg.src = "./assets/hero-bg.png";
        if (cmsImageUploadStatus) {
            cmsImageUploadStatus.textContent = '';
            cmsImageUploadStatus.className = 'file-upload-status';
        }
        cmsFormTitle.textContent = "Draft Custom Editorial";
        cmsFormSubtitle.textContent = "Write an opinionated editorial that unshifts to the very front of the ledger.";
        btnCmsSubmit.textContent = "Publish Editorial";
        btnCmsReset.style.display = "none";
    }

    // ==========================================================================
    // FORM SUBMISSIONS
    // ==========================================================================
    if (cmsArticleForm) {
        cmsArticleForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            setLoading(btnCmsSubmit, true);

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
                originalurl: cmsOriginalUrl.value || "#",
                publishdate: cmsPublishDate && cmsPublishDate.value ? new Date(cmsPublishDate.value).toISOString() : null
            };

            try {
                const path = id ? `/api/admin/articles/${id}` : '/api/admin/articles';
                const method = id ? 'PUT' : 'POST';
                const res = await apiRequest(path, { method, body: JSON.stringify(payload) });

                if (res.ok) {
                    const saved = await res.json();
                    showToast(id ? 'Article updated' : 'Article published', 'success');
                    
                    if (id) {
                        const idx = allArticles.findIndex(a => String(a.id) === String(id));
                        if (idx !== -1) allArticles[idx] = { ...allArticles[idx], ...saved };
                    } else {
                        allArticles.unshift(saved);
                    }
                    cancelEditMode();
                    updateStatsMetrics();
                    populateManagerList();
                } else {
                    const err = await res.json();
                    showToast(err.error || 'Failed to save article', 'error');
                }
            } catch (err) {
                console.error("Submit failed:", err);
                if (err.message !== 'Unauthorized') showToast('Cannot connect to server', 'error');
            } finally {
                setLoading(btnCmsSubmit, false);
            }
        });
    }

    if (btnCmsReset) btnCmsReset.addEventListener('click', cancelEditMode);

    // ==========================================================================
    // HERO FORM
    // ==========================================================================
    if (heroForm) {
        heroForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-hero-submit');
            setLoading(btn, true);

            const payload = {
                updates: [{
                    key: 'hero',
                    value: {
                        eyebrow: heroEyebrow.value,
                        readtime: heroReadtime.value,
                        headline: heroHeadline.value,
                        body: heroBody.value,
                        byline: heroByline.value,
                        byline_role: heroBylineRole.value,
                        cta: heroCta.value
                    }
                }]
            };

            try {
                const res = await apiRequest('/api/admin/site-content', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    showToast('Hero article updated', 'success');
                    await loadHeroContent();
                } else {
                    showToast('Failed to save hero content', 'error');
                }
            } catch (err) {
                if (err.message !== 'Unauthorized') showToast('Cannot connect to server', 'error');
            } finally {
                setLoading(btn, false);
            }
        });
    }

    async function loadHeroContent() {
        if (!heroForm) return;
        try {
            const res = await fetch('/api/site-content?_t=' + Date.now());
            if (res.ok) {
                const content = await res.json();
                const hero = content.hero || {};
                if (heroEyebrow) heroEyebrow.value = hero.eyebrow || '';
                if (heroReadtime) heroReadtime.value = hero.readtime || '';
                if (heroHeadline) heroHeadline.value = hero.headline || '';
                if (heroBody) heroBody.value = hero.body || '';
                if (heroByline) heroByline.value = hero.byline || '';
                if (heroBylineRole) heroBylineRole.value = hero.byline_role || '';
                if (heroCta) heroCta.value = hero.cta || '';
            }
        } catch (e) {
            console.error("Failed to load hero content:", e);
        }
    }

    // ==========================================================================
    // HIGHLIGHTS FORM (NEW HANDLER)
    // ==========================================================================
    if (highlightsForm) {
        highlightsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            setLoading(btnHighlightsSubmit, true);

            const rawText = highlightsInput.value;
            const highlightsArray = rawText.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);

            if (highlightsArray.length === 0) {
                showToast('Please enter at least one highlight', 'error');
                setLoading(btnHighlightsSubmit, false);
                return;
            }

            try {
                const res = await apiRequest('/api/admin/highlights', {
                    method: 'POST',
                    body: JSON.stringify({ highlights: highlightsArray })
                });
                if (res.ok) {
                    showToast('Highlights saved', 'success');
                    await loadHighlightsConfig();
                } else {
                    showToast('Failed to save highlights', 'error');
                }
            } catch (err) {
                if (err.message !== 'Unauthorized') showToast('Cannot connect to server', 'error');
            } finally {
                setLoading(btnHighlightsSubmit, false);
            }
        });
    }

    async function loadHighlightsConfig() {
        try {
            const res = await fetch('/api/admin/highlights');
            if (res.ok) {
                const highlights = await res.json();
                if (highlightsInput) highlightsInput.value = highlights.join('\n');
            }
        } catch (error) {
            console.error("Failed to load highlights:", error);
        }
    }

    // ==========================================================================
    // INSTAGRAM AUTOMATION
    // ==========================================================================
    let isConnected = false;
    let currentLogsLength = 0;

    async function loadInstagramConfig() {
        try {
            const res = await fetch('/api/admin/instagram/config');
            if (res.ok) {
                const data = await res.json();
                const config = data.config || {};
                const logs = data.logs || [];

                isConnected = config.connected;
                updateIgUI(config);
                if (logs.length !== currentLogsLength) {
                    currentLogsLength = logs.length;
                    if (igAutomationLog) {
                        igAutomationLog.textContent = logs.join('\n');
                        igAutomationLog.scrollTop = igAutomationLog.scrollHeight;
                    }
                }
            }
        } catch (error) {
            console.error("Failed to load Instagram config:", error);
        }
    }

    function updateIgUI(config) {
        if (!igStatusBadge) return;
        if (isConnected) {
            igStatusBadge.textContent = 'Active Polling';
            igStatusBadge.style.cssText = 'border: 1px solid rgba(0, 230, 118, 0.4); color: #00e676; background: rgba(0, 230, 118, 0.05);';
            if (igHandleInput) { igHandleInput.value = config.handle || ''; igHandleInput.disabled = true; }
            if (igRssInput) { igRssInput.value = config.rssUrl || ''; igRssInput.disabled = true; }
            if (btnIgConnect) {
                btnIgConnect.textContent = 'Disconnect';
                btnIgConnect.style.cssText = 'border-color: rgba(178, 41, 46, 0.4); color: var(--accent-saffron); background: rgba(178, 41, 46, 0.05);';
            }
            if (btnIgSimulate) btnIgSimulate.disabled = false;
            if (btnIgSync) btnIgSync.style.display = 'inline-block';
        } else {
            igStatusBadge.textContent = 'Disconnected';
            igStatusBadge.style.cssText = 'border: 1px solid rgba(255,255,255,0.1); color: var(--text-muted); background: rgba(255,255,255,0.02);';
            if (igHandleInput) { igHandleInput.value = ''; igHandleInput.disabled = false; }
            if (igRssInput) { igRssInput.disabled = false; igRssInput.value = config.rssUrl || ''; }
            if (btnIgConnect) {
                btnIgConnect.textContent = 'Connect';
                btnIgConnect.style.cssText = 'border-color: var(--border-color); color: var(--text-primary); background: rgba(255, 255, 255, 0.02);';
            }
            if (btnIgSimulate) btnIgSimulate.disabled = true;
            if (btnIgSync) btnIgSync.style.display = 'none';
        }
    }

    if (btnIgConnect) {
        btnIgConnect.addEventListener('click', async () => {
            let handle = igHandleInput?.value?.trim() || '';
            if (!isConnected && !handle) {
                showToast('Enter an Instagram handle', 'error');
                return;
            }
            if (!isConnected && !handle.startsWith('@')) {
                handle = '@' + handle;
                if (igHandleInput) igHandleInput.value = handle;
            }
            const rssUrl = igRssInput?.value?.trim() || '';
            const payload = { handle: isConnected ? '' : handle, rssUrl: isConnected ? '' : rssUrl, connected: !isConnected };

            setLoading(btnIgConnect, true);
            try {
                const res = await apiRequest('/api/admin/instagram/config', { method: 'POST', body: JSON.stringify(payload) });
                if (res.ok) {
                    if (!isConnected) {
                        if (igHandleInput) igHandleInput.value = handle;
                        if (igRssInput) igRssInput.value = rssUrl;
                    } else {
                        if (igHandleInput) igHandleInput.value = '';
                        if (igRssInput) igRssInput.value = '';
                    }
                    await loadInstagramConfig();
                    showToast(isConnected ? 'Disconnected' : 'Connected', 'success');
                } else {
                    showToast('Failed to update Instagram config', 'error');
                }
            } catch (err) {
                if (err.message !== 'Unauthorized') showToast('Cannot connect to server', 'error');
            } finally {
                setLoading(btnIgConnect, false);
            }
        });
    }

    if (btnIgSync) {
        btnIgSync.addEventListener('click', async () => {
            setLoading(btnIgSync, true);
            try {
                const res = await apiRequest('/api/admin/instagram/sync', { method: 'POST' });
                if (res.ok) {
                    const result = await res.json();
                    showToast(result.message || 'Sync executed', 'success');
                    await loadInstagramConfig();
                    await loadCMSData();
                } else {
                    const err = await res.json();
                    showToast(err.error || 'Sync failed', 'error');
                }
            } catch (err) {
                if (err.message !== 'Unauthorized') showToast('Cannot connect to server', 'error');
            } finally {
                setLoading(btnIgSync, false);
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
    const mockShortcodes = ["CP84tADtE4g", "C-19t_5uF6n", "C5y2G42t7gB", "C844oV6t9gA", "C9-y4x2t1a8"];

    if (btnIgSimulate) {
        btnIgSimulate.addEventListener('click', async () => {
            setLoading(btnIgSimulate, true);
            const idx = Math.floor(Math.random() * mockCaptions.length);
            const payload = {
                mediaId: `ig_reel_${Date.now()}`,
                shortcode: mockShortcodes[idx],
                permalink: `https://www.instagram.com/p/${mockShortcodes[idx]}/`,
                caption: mockCaptions[idx]
            };

            if (igAutomationLog) {
                igAutomationLog.textContent += `\n[Simulating Post Event] Sending webhook for reel ${mockShortcodes[idx]}...`;
                igAutomationLog.scrollTop = igAutomationLog.scrollHeight;
            }

            try {
                const res = await apiRequest('/api/admin/instagram/simulate', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    showToast('Simulation triggered', 'success');
                    await loadCMSData();
                    await loadInstagramConfig();
                } else {
                    showToast('Simulation failed', 'error');
                }
            } catch (err) {
                if (err.message !== 'Unauthorized') showToast('Cannot connect to server', 'error');
            } finally {
                setLoading(btnIgSimulate, false);
            }
        });
    }

    // Poll logs every 3s
    setInterval(loadInstagramConfig, 3000);
    loadInstagramConfig();

    // ==========================================================================
    // AUDIENCE DIRECTORY
    // ==========================================================================
    async function loadSubscribers() {
        if (!subscribersList) return;
        try {
            const res = await fetch('/api/admin/subscribers');
            if (res.ok) {
                const subs = await res.json();
                if (subCountBadge) subCountBadge.textContent = `${subs.length} ${subs.length === 1 ? 'Subscriber' : 'Subscribers'}`;
                if (subs.length === 0) {
                    subscribersList.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding-top: 50px;">No subscribers loaded.</div>';
                } else {
                    subscribersList.innerHTML = subs.map(sub => {
                        const localDate = new Date(sub.subscribedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' });
                        return `<div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1.5px solid rgba(255,255,255,0.02); font-size: 0.8rem;">
                            <span style="color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 60%;">${escapeHtml(sub.email)}</span>
                            <span style="color: var(--text-muted); font-size: 0.7rem;">${localDate}</span>
                        </div>`;
                    }).join('');
                }
            }
        } catch (error) {
            console.error("Failed to load subscribers:", error);
        }
    }

    if (btnExportSubscribers) {
        btnExportSubscribers.addEventListener('click', () => {
            window.open('/api/admin/subscribers/export', '_blank');
        });
    }

    loadSubscribers();
    setInterval(loadSubscribers, 10000);

    // ==========================================================================
    // SEARCH
    // ==========================================================================
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            searchFilterQuery = searchInput.value;
            currentPage = 1; // Reset to first page on search
            loadCMSData(); // Use server-side search
        });
    }

    // ==========================================================================
    // SORT CONTROLS
    // ==========================================================================
    if (sortBySelect) {
        sortBySelect.value = currentSortBy;
        sortBySelect.addEventListener('change', () => {
            currentSortBy = sortBySelect.value;
            currentPage = 1;
            loadCMSData();
        });
    }

    if (sortOrderSelect) {
        sortOrderSelect.value = currentSortOrder;
        sortOrderSelect.addEventListener('change', () => {
            currentSortOrder = sortOrderSelect.value;
            currentPage = 1;
            loadCMSData();
        });
    }

    // ==========================================================================
    // INIT
    // ==========================================================================
    (async function init() {
        await fetchCsrfToken();
        await loadHeroContent();
        await loadHighlightsConfig();
        await loadCMSData();
        lucide.createIcons();
    })();
});