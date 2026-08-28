const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const auth = require('./auth');

class FacebookScraper {
    constructor() {
        this.browser = null;
        this.collectedHighResUrls = new Set();
    }

    /**
     * Initializes browser with stored cookies (runs headless or visible)
     */
    async init(headless = true) {
        // Ensure cookies exist
        if (!auth.hasCookies()) {
            console.log('[Scraper] No saved cookies found. Launching one-time login activity...');
            const success = await auth.loginOneTime();
            if (!success) {
                console.warn('[!] Proceeding without cookies (public profiles only)...');
            }
        }

        const tempDir = path.join(__dirname, '.chrome-temp-scrape');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        console.log(`[Browser] Launching browser instance with stored cookies...`);
        this.browser = await puppeteer.launch({
            executablePath: config.CHROME_PATH,
            userDataDir: tempDir,
            headless: headless ? 'new' : false,
            defaultViewport: null,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-notifications',
                '--disable-infobars',
                '--start-maximized'
            ]
        });
    }

    /**
     * Cleans raw Facebook page title to extract display name
     */
    cleanDisplayName(rawTitle) {
        if (!rawTitle || typeof rawTitle !== 'string') return '';
        return rawTitle
            .replace(/^\([0-9]+\)\s*/, '') // Remove notification count badge e.g. "(1) "
            .replace(/\s*\|\s*Facebook.*$/i, '') // Remove " | Facebook"
            .replace(/\s*-\s*Photos.*$/i, '') // Remove " - Photos"
            .replace(/\s*-\s*Facebook.*$/i, '')
            .trim();
    }

    /**
     * Scrapes high-resolution photos using photo gallery discovery and theater mode HD extraction
     */
    async scrapePhotos(targetUrl, maxScrolls = config.MAX_SCROLLS) {
        if (!this.browser) {
            await this.init(true);
        }

        console.log(`[Scraper] Processing target: ${targetUrl}`);
        const page = await this.browser.newPage();
        this.collectedHighResUrls.clear();
        let profileDisplayName = '';

        try {
            await page.setViewport({ width: 1920, height: 1080 });

            // Apply stored cookies
            const cookies = auth.loadCookies();
            if (cookies.length > 0) {
                console.log(`[Auth] Loaded ${cookies.length} cookies from cookies.json.`);
                await page.setCookie(...cookies);
            }

            // Real-time network response interceptor for GraphQL & HD photo streams
            page.on('response', async (res) => {
                try {
                    const text = await res.text();
                    this.extractHighResFromText(text);
                } catch (e) {}
            });

            // 1. Check if direct photo URL
            const isDirectPhoto = targetUrl.includes('photo.php') || targetUrl.includes('/photo/') || targetUrl.includes('fbid=');
            let firstPhotoUrl = isDirectPhoto ? targetUrl : null;

            if (!isDirectPhoto) {
                console.log(`[Scraper] Navigating to Photos page: ${targetUrl}`);
                await page.goto(targetUrl, {
                    waitUntil: 'domcontentloaded',
                    timeout: config.PAGE_TIMEOUT_MS
                }).catch(err => {
                    console.log(`[Scraper] Navigation note: ${err.message}`);
                });

                await new Promise(r => setTimeout(r, 2000));

                // Extract high-res photos from initial page content / scripts
                const initialContent = await page.content().catch(() => '');
                this.extractHighResFromText(initialContent);

                // Extract profile display name from page title
                const rawTitle = await page.title().catch(() => '');
                const cleanedTitle = this.cleanDisplayName(rawTitle);
                if (cleanedTitle && cleanedTitle.toLowerCase() !== 'facebook') {
                    profileDisplayName = cleanedTitle;
                }

                // Scroll photos page to stream GraphQL batches and discover photo links
                console.log(`[Scraper] Scrolling /photos page to stream high-resolution photos (up to ${maxScrolls} scrolls)...`);
                const photoLinks = new Set();
                let lastCount = 0;
                let noNewCount = 0;

                for (let scroll = 1; scroll <= maxScrolls; scroll++) {
                    const links = await page.evaluate(() => {
                        const anchors = Array.from(document.querySelectorAll('a[href*="/photo"], a[href*="fbid="]'));
                        return anchors.map(a => a.href).filter(h => h && h.includes('facebook.com') && (h.includes('fbid=') || h.includes('/photo/')));
                    }).catch(() => []);
                    links.forEach(l => photoLinks.add(l));

                    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 3));
                    await new Promise(r => setTimeout(r, 1400));

                    console.log(`[Scraper] Scroll ${scroll}/${maxScrolls}: Total unique high-res photos: ${this.collectedHighResUrls.size} (Discovered links: ${photoLinks.size})`);

                    if (this.collectedHighResUrls.size === lastCount) {
                        noNewCount++;
                        if (noNewCount >= 4 && this.collectedHighResUrls.size > 50) {
                            console.log(`[Scraper] Reached end of photo gallery.`);
                            break;
                        }
                    } else {
                        noNewCount = 0;
                        lastCount = this.collectedHighResUrls.size;
                    }
                }

                if (photoLinks.size > 0) {
                    firstPhotoUrl = Array.from(photoLinks)[0];
                }
            }

            // 2. Extract full-resolution photos in Theater Mode if direct photo or needed
            if (firstPhotoUrl && (isDirectPhoto || this.collectedHighResUrls.size < 20)) {
                console.log(`[Scraper] Opening high-resolution Theater View via: ${firstPhotoUrl}`);
                await page.goto(firstPhotoUrl, {
                    waitUntil: 'domcontentloaded',
                    timeout: config.PAGE_TIMEOUT_MS
                }).catch(err => console.log(`[Scraper] Theater navigation note: ${err.message}`));

                await new Promise(r => setTimeout(r, 2000));

                // If display name not yet found, check author link on photo page
                if (!profileDisplayName) {
                    const domName = await page.evaluate(() => {
                        const authors = Array.from(document.querySelectorAll('h1, h2 a, h3 a, strong a, a[role="link"]'))
                            .map(a => a.textContent.trim())
                            .filter(t => t.length > 1 && !t.toLowerCase().includes('facebook') && !t.toLowerCase().includes('view post') && !t.toLowerCase().includes('unread'));
                        return authors.length > 0 ? authors[0] : '';
                    }).catch(() => '');
                    if (domName) {
                        profileDisplayName = this.cleanDisplayName(domName);
                    }
                }

                const stepCount = isDirectPhoto ? 15 : 20;
                console.log(`[Scraper] Stepping through photos in HD Theater Mode...`);

                for (let step = 1; step <= stepCount; step++) {
                    const currentImg = await page.evaluate(() => {
                        const imgs = Array.from(document.querySelectorAll('img[data-visualcompletion="media-vc-image"], img[src*="scontent"]'));
                        let best = null;
                        let maxDim = 0;
                        for (const img of imgs) {
                            const w = img.naturalWidth || img.width || 0;
                            const h = img.naturalHeight || img.height || 0;
                            if (w > maxDim || h > maxDim) {
                                maxDim = Math.max(w, h);
                                best = img.src;
                            }
                        }
                        return { src: best, maxDim };
                    }).catch(() => null);

                    if (currentImg && currentImg.src) {
                        const clean = this.cleanUrl(currentImg.src);
                        if (this.isHighResPhotoUrl(clean) || currentImg.maxDim >= 600) {
                            this.collectedHighResUrls.add(clean);
                        }
                    }

                    // Press ArrowRight to navigate to the next photo in theater mode
                    await page.keyboard.press('ArrowRight');
                    await new Promise(r => setTimeout(r, 1200));
                }
            }

            const results = Array.from(this.collectedHighResUrls);
            console.log(`[Scraper] Scraping complete! Captured ${results.length} full-resolution photo URLs${profileDisplayName ? ` for "${profileDisplayName}"` : ''}.`);
            return {
                urls: results,
                displayName: profileDisplayName
            };
        } finally {
            if (page && !page.isClosed()) {
                await page.close().catch(() => {});
            }
        }
    }

    /**
     * Extracts high-resolution scontent URLs from raw text/JSON using regex patterns
     */
    extractHighResFromText(text) {
        if (!text || !text.includes('scontent')) return;

        const regex = /(https?:[\\\/]+[^\s"']*(?:fbcdn\.net|scontent)[^\s"']*)/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
            const rawUrl = match[1];
            const clean = this.cleanUrl(rawUrl);
            if (this.isHighResPhotoUrl(clean)) {
                this.collectedHighResUrls.add(clean);
            }
        }
    }

    /**
     * Cleans JSON-escaped slashes and entities
     */
    cleanUrl(url) {
        return url
            .replace(/\\\//g, '/')
            .replace(/\\u0026/g, '&')
            .replace(/&amp;/g, '&')
            .replace(/\\/g, '');
    }

    /**
     * Checks if a URL is a low-res thumbnail crop
     */
    isThumbnail(url) {
        if (!url || typeof url !== 'string') return true;
        const lower = url.toLowerCase();

        const thumbPatterns = [
            'ctp=s24', 'ctp=s32', 'ctp=s40', 'ctp=s50', 'ctp=s60', 'ctp=s74', 'ctp=s80',
            'ctp=s100', 'ctp=s120', 'ctp=s160', 'ctp=s200', 'ctp=s206', 'ctp=s240', 'ctp=s320', 'ctp=s480',
            's100x100', 's206x206', 'p100x100', 'p50x50', 'p160x160', 'p240x240', 'p320x320',
            'dst-jpg_s100x100', 'dst-jpg_p100x100', 'dst-png_s100x100',
            '/v/t1.6435-1/', '/v/t39.30808-1/', '/v/t1.30497-1/',
            'cp0/e15/q65_p', 'emoji.php', 'rsrc.php'
        ];

        for (const pat of thumbPatterns) {
            if (lower.includes(pat)) return true;
        }

        return false;
    }

    /**
     * Checks if a URL matches the high-resolution photo patterns
     */
    isHighResPhotoUrl(url) {
        if (!url || typeof url !== 'string') return false;
        if (!url.includes('scontent') || !url.includes('fbcdn.net')) return false;
        if (this.isThumbnail(url)) return false;

        const lower = url.toLowerCase();

        // 1. High ctp dimensions e.g. ctp=s1080x..., ctp=s2327x..., ctp=s2048x...
        if (lower.includes('ctp=s1') || lower.includes('ctp=s2') || lower.includes('ctp=s3') || 
            lower.includes('ctp=s4') || lower.includes('ctp=s5') || lower.includes('ctp=s6') ||
            lower.includes('ctp=s7') || lower.includes('ctp=s8') || lower.includes('ctp=s9') ||
            lower.includes('s1080x') || lower.includes('s2048x') || lower.includes('s960x') || lower.includes('p720x')) {
            return true;
        }

        // 2. Master photo endpoints (-6/, -9/, -15/)
        if (lower.includes('-6/') || lower.includes('-9/') || lower.includes('-15/')) {
            return true;
        }

        // 3. Large source metadata without tiny crop
        if (lower.includes('cstp=mx1') || lower.includes('cstp=mx2') || lower.includes('cstp=mx3')) {
            return true;
        }

        return false;
    }

    /**
     * Closes browser instance
     */
    async close() {
        if (this.browser) {
            await this.browser.close().catch(() => {});
            this.browser = null;
        }
    }
}

module.exports = FacebookScraper;
