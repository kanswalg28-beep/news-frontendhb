/* ==========================================================================
   HONESTLY BIASED - INTERACTIVE CORE WEBPAGE LOGIC
   Handles: Theme Toggling, Mobile Nav, Scroll Reveals, Civic Poll, Form Submit
   ========================================================================== */

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

    // ==========================================================================
    // 2. MOBILE DRAWER NAVIGATION MENU
    // ==========================================================================
    const mobileToggle = document.querySelector('.mobile-toggle');
    const mainNav = document.getElementById('main-nav');
    const toggleIcon = mobileToggle.querySelector('i');

    mobileToggle.addEventListener('click', () => {
        const isOpen = mainNav.classList.toggle('open');
        mobileToggle.setAttribute('aria-expanded', isOpen);
        
        // Update Lucide icon
        if (isOpen) {
            toggleIcon.setAttribute('data-lucide', 'x');
        } else {
            toggleIcon.setAttribute('data-lucide', 'menu');
        }
        lucide.createIcons();
    });

    // Close navigation menu drawer when selecting any specific section anchor
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            if (mainNav.classList.contains('open')) {
                mainNav.classList.remove('open');
                mobileToggle.setAttribute('aria-expanded', 'false');
                toggleIcon.setAttribute('data-lucide', 'menu');
                lucide.createIcons();
            }
            
            // Set active navigation tab indicator
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });

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
    // 4. INTERACTIVE NARRATIVE PULSE (CIVIC POLL ENGINE - HONESTLY BIASED EDITION)
    // ==========================================================================
    const pollForm = document.getElementById('civic-poll-form');
    const pollButtons = pollForm.querySelectorAll('.poll-option-btn');
    let voteRegistered = false;

    // Simulate database update and recalculating percentages on click
    pollButtons.forEach((btn, index) => {
        btn.addEventListener('click', () => {
            if (voteRegistered) return; // Prevent double votes

            voteRegistered = true;
            pollForm.classList.add('votes-submitted');

            // Honestly Biased default distribution: No ownership (74%), Yes regulatory (18%), Impartiality myth (8%)
            let percentages = [74, 18, 8]; 
            
            // Add current vote into calculations
            percentages[index] += 1;
            const total = percentages.reduce((a, b) => a + b, 0);
            const roundedPercentages = percentages.map(val => Math.round((val / total) * 100));

            // Dynamically scale graph bars and numbers in DOM
            pollButtons.forEach((button, bIdx) => {
                const percentage = roundedPercentages[bIdx];
                const bar = button.querySelector('.poll-bar');
                const textPercent = button.querySelector('.poll-percentage');
                
                // Animate bars
                bar.style.width = `${percentage}%`;
                textPercent.textContent = `${percentage}%`;
                
                // Style updates
                button.disabled = true;
                button.style.cursor = 'default';
                if (bIdx === index) {
                    button.style.borderColor = 'var(--accent-green)';
                    button.style.color = 'var(--text-primary)';
                } else {
                    button.style.opacity = '0.7';
                }
            });

            // Witty Honestly Biased feedback message
            const feedbackMsg = document.createElement('p');
            feedbackMsg.style.fontSize = '0.75rem';
            feedbackMsg.style.color = 'var(--accent-green)';
            feedbackMsg.style.fontWeight = '700';
            feedbackMsg.style.marginTop = '12px';
            feedbackMsg.style.textAlign = 'center';
            feedbackMsg.style.textTransform = 'uppercase';
            feedbackMsg.style.letterSpacing = '0.5px';
            feedbackMsg.innerHTML = '<i data-lucide="check" style="width:12px; height:12px; vertical-align:middle; margin-right:4px;"></i> Narrative Calibrated. Thanks for being honestly biased.';
            pollForm.appendChild(feedbackMsg);
            lucide.createIcons();
        });
    });

    // ==========================================================================
    // 5. EDITORIAL NEWSLETTER FORM INTERACTION
    // ==========================================================================
    const newsletterForm = document.getElementById('newsletter-form');
    
    newsletterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const emailInput = newsletterForm.querySelector('input[type="email"]');
        const submitBtn = newsletterForm.querySelector('.newsletter-btn');
        const submitIcon = submitBtn.querySelector('i');
        const userEmail = emailInput.value;

        // Performant micro-animation during pseudo request
        submitBtn.disabled = true;
        emailInput.disabled = true;
        submitIcon.setAttribute('data-lucide', 'loader-2');
        submitIcon.classList.add('spin-anim');
        lucide.createIcons();

        const styleSheet = document.createElement("style");
        styleSheet.innerText = `@keyframes loader-spin { to { transform: rotate(360deg); } }
                                .spin-anim { animation: loader-spin 1s linear infinite; }`;
        document.head.appendChild(styleSheet);

        // Resolve action in 1.5 seconds
        setTimeout(() => {
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
                    <h5 style="font-weight:700; color:var(--text-primary); font-family:var(--font-editorial); font-size:0.95rem; margin-bottom:4px; letter-spacing:0.5px;">BIAS TUNED IN</h5>
                    <p style="font-size:0.8rem; color:var(--text-secondary); line-height:1.45;">Daily unfiltered commentary enabled for <strong style="color:var(--text-primary);">${userEmail}</strong>. Welcome to transparent independent coverage.</p>
                `;
                parentElement.appendChild(successMsg);
            }, 300);

        }, 1500);
    });

    // ==========================================================================
    // 6. DOCK STICKY NAVIGATION BLUR MODULATOR
    // ==========================================================================
    const headerElement = document.getElementById('main-header');
    
    window.addEventListener('scroll', () => {
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
    });

    // ==========================================================================
    // 7. DYNAMIC LIVE NEWS INJECTION & INTERACTIVE BENTO CATEGORY FILTERS
    // ==========================================================================
    let allArticles = [];
    let rhetoricMeterHTML = "";
    let manifestoHTML = "";
    let expressBiasHTML = "";
    let podcastHTML = "";
    let VaranasiDocHTML = "";
    let civicPollHTML = "";

    const gridContainer = document.getElementById('dynamic-bento-grid');

    // Capture the static layout fixtures on initial load to preserve premium styles
    const card2 = document.getElementById('card-2');
    const card3 = document.getElementById('manifesto');
    const card4 = document.getElementById('card-4');
    const card5 = document.getElementById('card-5');
    const card6 = document.getElementById('card-6');
    const card7 = document.getElementById('card-7');

    rhetoricMeterHTML = card2 ? card2.outerHTML : "";
    manifestoHTML = card3 ? card3.outerHTML : "";
    expressBiasHTML = card4 ? card4.outerHTML : "";
    podcastHTML = card5 ? card5.outerHTML : "";
    VaranasiDocHTML = card6 ? card6.outerHTML : "";
    civicPollHTML = card7 ? card7.outerHTML : "";

    async function loadDynamicArticles() {
        console.log("📡 Attempting to fetch live AI-calibrated Honestly Biased feed...");
        
        try {
            // Call the local backend server (running on port 3000)
            const response = await fetch('http://127.0.0.1:3000/api/honestly-biased-feed');
            
            if (!response.ok) {
                throw new Error(`API returned HTTP status ${response.status}`);
            }

            const data = await response.json();
            console.log("🟢 Live feed loaded successfully. Calibrating bento boxes...");

            // Store dynamic articles globally
            allArticles = data.articles || [];

            // A. Update the Rhetoric/Sentiment Tracker in our captured HTML cache
            if (data.rhetoricMeter && rhetoricMeterHTML) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = rhetoricMeterHTML;
                const rhetoricCard = tempDiv.firstElementChild;
                if (rhetoricCard) {
                    const metricVals = rhetoricCard.querySelectorAll('.metric-val');
                    if (metricVals.length >= 2) {
                        metricVals[0].textContent = data.rhetoricMeter.hyperbolePercentage;
                        metricVals[1].textContent = data.rhetoricMeter.yoyGrowth;
                    }
                    const summary = rhetoricCard.querySelector('.card-summary');
                    if (summary) {
                        summary.textContent = data.rhetoricMeter.aiAnalysis;
                    }
                    rhetoricMeterHTML = rhetoricCard.outerHTML;
                }
            }

            // B. Initial dynamic grid render (category: "all")
            renderArticles('all');

        } catch (error) {
            console.log("\n=============================================================");
            console.log("ℹ️  INFO: Live backend API is not currently active.");
            console.log("👉 The website is running beautifully in offline static mode.");
            console.log("👉 Run 'node mock-server.js' in the background to activate AI rewrites!");
            console.log("=============================================================\n");
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

        console.log(`👁️ Opening Honestly Biased audit modal for article: "${article.aiHeadline}"`);

        // Hydrate details
        if (modalCategory) {
            modalCategory.textContent = article.category;
            // Align color tags based on category
            modalCategory.className = 'modal-tag ' + (article.category.toLowerCase().trim() === 'tech audit' ? 'green-bg' : 'saffron-bg');
        }
        if (modalTime) modalTime.innerHTML = `<i data-lucide="clock"></i> ${article.timeAgo}`;
        if (modalTitle) modalTitle.textContent = article.aiHeadline;
        if (modalSource) modalSource.textContent = `Source: ${article.originalSource || article.originalTitle}`;
        if (modalBiasAudit) modalBiasAudit.textContent = article.biasAudit;
        if (modalSummary) modalSummary.textContent = article.aiSummary;
        if (modalOriginalLink) modalOriginalLink.href = article.originalUrl;

        // Dynamic Author Badging in Modal Reader
        const modalAuthor = document.querySelector('.modal-author');
        if (modalAuthor) {
            if (article.authorType === 'admin') {
                modalAuthor.innerHTML = `<i data-lucide="pen-tool" style="width:14px; height:14px;"></i> Honestly Biased Editorial Board (Admin)`;
                modalAuthor.style.color = 'var(--accent-green)'; // Gold
            } else {
                modalAuthor.innerHTML = `<i data-lucide="shield-check" style="width:14px; height:14px;"></i> Audited by Honestly Biased AI Engine (Gemini)`;
                modalAuthor.style.color = '#00E5FF'; // Neon Blue
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

    // Dynamic Asymmetrical Bento Grid compiler
    function renderArticles(categoryFilter) {
        if (!gridContainer) return;

        // Clear existing grid
        gridContainer.innerHTML = "";

        // Filter articles by category
        const filteredArticles = categoryFilter === 'all' 
            ? allArticles 
            : allArticles.filter(art => art.category.toLowerCase().trim() === categoryFilter.toLowerCase().trim());

        console.log(`🎯 Filtering: Category "${categoryFilter}" matched ${filteredArticles.length} articles.`);

        if (filteredArticles.length === 0) {
            // Display empty state
            gridContainer.innerHTML = `
                <div class="bento-card bento-span-4x1 glass-element" style="grid-column: span 4; padding: 48px; text-align: center; justify-content: center; align-items: center; border-style: dashed; grid-row: span 1;">
                    <i data-lucide="archive-x" style="width: 48px; height: 48px; color: var(--accent-saffron); margin-bottom: 16px;"></i>
                    <h3 style="font-family: var(--font-heading); font-size: 1.25rem; font-weight: 700; margin-bottom: 8px;">No Chronicles Found</h3>
                    <p style="color: var(--text-muted); font-size: 0.9rem; max-width: 400px; margin: 0 auto;">Our AI Editorial desk hasn't logged any audited headlines under "${categoryFilter}" in this bracket. Check back shortly!</p>
                </div>
            `;
            // Append persistent widgets anyway so layout isn't entirely blank
            gridContainer.innerHTML += rhetoricMeterHTML + manifestoHTML + expressBiasHTML + podcastHTML + VaranasiDocHTML + civicPollHTML;
            lucide.createIcons();
            return;
        }

        // Build list of final DOM nodes/strings dynamically to interlace widgets
        const gridItems = [];

        filteredArticles.forEach((article, index) => {
            if (index === 0) {
                // Render the first article as a large high-fidelity cover visual bento (span 2x2)
                gridItems.push(`
                    <article class="bento-card bento-span-2x2 glass-element" id="${article.id}" style="opacity:0; transform:translateY(30px);">
                        <div class="card-visual">
                            <div class="card-image-bg" style="background-image: url('${article.imageUrl}'); filter: saturate(0.85) contrast(1.15);"></div>
                            <div class="card-tag saffron-bg">${article.category}</div>
                        </div>
                        <div class="card-body">
                            <span class="card-time" style="display:inline-flex; align-items:center; flex-wrap:wrap; gap:4px;">
                                ${article.authorType === 'admin' 
                                    ? '<span class="author-type-badge badge-admin"><i data-lucide="pen-tool" style="width:10px;height:10px;"></i> Editorial</span>' 
                                    : '<span class="author-type-badge badge-ai"><i data-lucide="cpu" style="width:10px;height:10px;"></i> AI Audited</span>'}
                                <i data-lucide="clock" style="margin-left:4px;"></i> ${article.timeAgo}
                            </span>
                            <h3 class="card-title" style="margin-top:10px;">
                                <a href="#" class="stretched-link audit-trigger" data-id="${article.id}">${article.aiHeadline}</a>
                            </h3>
                            <p class="card-summary">${article.aiSummary}</p>
                            <div class="card-footer-meta">
                                <span class="card-author" style="font-size:0.75rem; color:var(--accent-green); font-weight:700;">Bias Audit: ${article.biasAudit}</span>
                                <span class="card-action"><i data-lucide="arrow-up-right"></i></span>
                            </div>
                        </div>
                    </article>
                `);
            } else if (index === 3) {
                // Render a mid-level horizontal powerhouse card (span 2x1) for rhythm variety
                gridItems.push(`
                    <article class="bento-card bento-span-2x1 glass-element video-preview-card" id="${article.id}" style="opacity:0; transform:translateY(30px);">
                        <div class="card-visual">
                            <div class="card-image-bg" style="background-image: url('${article.imageUrl}'); filter: brightness(0.65) grayscale(0.25);"></div>
                            <span class="card-tag green-bg">${article.category}</span>
                            <span class="video-play-overlay"><i data-lucide="arrow-up-right"></i></span>
                        </div>
                        <div class="card-body">
                            <span class="card-time" style="display:inline-flex; align-items:center; flex-wrap:wrap; gap:4px;">
                                ${article.authorType === 'admin' 
                                    ? '<span class="author-type-badge badge-admin"><i data-lucide="pen-tool" style="width:10px;height:10px;"></i> Editorial</span>' 
                                    : '<span class="author-type-badge badge-ai"><i data-lucide="cpu" style="width:10px;height:10px;"></i> AI Audited</span>'}
                                <i data-lucide="clock" style="margin-left:4px;"></i> ${article.timeAgo}
                            </span>
                            <h3 class="card-title" style="margin-top:10px;">
                                <a href="#" class="stretched-link audit-trigger" data-id="${article.id}">${article.aiHeadline}</a>
                            </h3>
                            <p class="card-summary">${article.aiSummary}</p>
                            <div class="card-footer-meta">
                                <span class="card-author" style="font-size:0.75rem; color:var(--accent-green); font-weight:700;">Bias Audit: ${article.biasAudit}</span>
                            </div>
                        </div>
                    </article>
                `);
            } else {
                // Render standard bento boxes (span 1x1)
                gridItems.push(`
                    <article class="bento-card bento-span-1x1 glass-element" id="${article.id}" style="opacity:0; transform:translateY(30px);">
                        <div class="card-body header-only-body">
                            <div class="card-tag-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
                                <span class="card-tag saffron-bg" style="margin-bottom:0;">${article.category}</span>
                                <span class="card-time" style="font-size:0.65rem; color:var(--text-muted); font-weight:700; display:flex; align-items:center; gap:2px;">
                                    ${article.authorType === 'admin' 
                                        ? '<span class="author-type-badge badge-admin" style="margin-right:2px; padding:2px 4px;"><i data-lucide="pen-tool" style="width:8px;height:8px;"></i> Edit</span>' 
                                        : '<span class="author-type-badge badge-ai" style="margin-right:2px; padding:2px 4px;"><i data-lucide="cpu" style="width:8px;height:8px;"></i> AI</span>'}
                                    ${article.timeAgo}
                                </span>
                            </div>
                            <h3 class="card-title" style="margin-bottom:10px;">
                                <a href="#" class="stretched-link audit-trigger" data-id="${article.id}">${article.aiHeadline}</a>
                            </h3>
                            <p class="card-summary small-summary" style="display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;">${article.aiSummary}</p>
                            <div class="card-footer-meta" style="margin-top:auto; padding-top:12px; border-top:1px solid rgba(255,255,255,0.03);">
                                <span class="card-author" style="font-size:0.68rem; color:var(--accent-green); font-weight:700; line-height:1.35; display:block;">Bias Audit: ${article.biasAudit}</span>
                            </div>
                        </div>
                    </article>
                `);
            }
        });

        // Interlace our layout fixtures dynamically based on the category filter
        // If showing 'all', we interlace at perfect visual intervals.
        if (categoryFilter === 'all') {
            if (gridItems.length > 1) gridItems.splice(1, 0, rhetoricMeterHTML);
            if (gridItems.length > 2) gridItems.splice(2, 0, manifestoHTML);
            if (gridItems.length > 4) gridItems.splice(4, 0, expressBiasHTML);
            if (gridItems.length > 5) gridItems.splice(5, 0, podcastHTML);
            if (gridItems.length > 7) gridItems.splice(7, 0, VaranasiDocHTML);
            if (gridItems.length > 9) gridItems.splice(9, 0, civicPollHTML);
            
            // Append any leftovers
            if (gridItems.length <= 1) gridItems.push(rhetoricMeterHTML, manifestoHTML, expressBiasHTML, podcastHTML, VaranasiDocHTML, civicPollHTML);
        } else {
            // Under single category tabs, place the widgets beautifully at the end so they remain accessible
            gridItems.push(rhetoricMeterHTML, manifestoHTML, expressBiasHTML, podcastHTML, VaranasiDocHTML, civicPollHTML);
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
    }

    // Category Tabs Event Listeners
    const tabButtons = document.querySelectorAll('.category-tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Toggle active status
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const selectedCat = btn.getAttribute('data-category');
            renderArticles(selectedCat);
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

        // Bind article modal click listeners to all audit-trigger items
        const triggers = gridContainer.querySelectorAll('.audit-trigger');
        triggers.forEach(t => {
            t.addEventListener('click', (e) => {
                e.preventDefault();
                const id = t.getAttribute('data-id');
                openArticleModal(id);
            });
        });
    }

    // Initialize fetching routine
    loadDynamicArticles();

    console.log('Honestly Biased Core Platform Logic initialized successfully. Grid observers, forms and interactive voting channels fully functional.');
});
