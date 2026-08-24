const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const auth = require('./auth');

class FacebookScraper {
    constructor() {
        this.browser = null;
        this.page = null;
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
     * Scrapes high-resolution photos directly from /photos page using pattern matching and GraphQL streams
     * (Does NOT visit or click individual photo pages)
     */
    async scrapePhotos(profileUrl, maxScrolls = config.MAX_SCROLLS) {
        if (!this.browser) {
            await this.init(true);
        }

        console.log(`[Scraper] Navigating to Photos page: ${profileUrl}`);
        const page = await this.browser.newPage();
        this.collectedHighResUrls.clear();

        try {
            await page.setViewport({ width: 1920, height: 1080 });

            // Apply stored cookies
            const cookies = auth.loadCookies();
            if (cookies.length > 0) {
                console.log(`[Auth] Loaded ${cookies.length} cookies from cookies.json.`);
                await page.setCookie(...cookies);
            }

            // Listen to all network responses (GraphQL & JSON streams) to capture high-res URLs in real-time
            page.on('response', async (res) => {
                try {
                    const url = res.url();
                    const contentType = res.headers()['content-type'] || '';
                    if (url.includes('graphql') || url.includes('/api/graphql') || contentType.includes('json') || contentType.includes('javascript')) {
                        const text = await res.text();
                        this.extractHighResFromText(text);
                    }
                } catch (e) {}
            });

            await page.goto(profileUrl, {
                waitUntil: 'networkidle2',
                timeout: config.PAGE_TIMEOUT_MS
            }).catch(err => {
                console.log(`[Scraper] Navigation note: ${err.message}`);
            });

            await new Promise(r => setTimeout(r, 2500));

            // Extract from initial page HTML and script tags
            const initialHtml = await page.content();
            this.extractHighResFromText(initialHtml);

            console.log(`[Scraper] Scrolling /photos page to stream high-resolution photo patterns (up to ${maxScrolls} scrolls)...`);

            for (let i = 0; i < maxScrolls; i++) {
                // Extract high-res URLs from DOM image elements and script tags
                const domData = await page.evaluate(() => {
                    const urls = [];
                    // 1. Check all img src and srcset
                    const imgElements = Array.from(document.querySelectorAll('img'));
                    for (const img of imgElements) {
                        if (img.src && img.src.includes('scontent')) {
                            urls.push(img.src);
                        }
                        if (img.srcset) {
                            const parts = img.srcset.split(',').map(s => s.trim().split(' ')[0]);
                            urls.push(...parts);
                        }
                    }

                    // 2. Check JSON script tags
                    const scripts = Array.from(document.querySelectorAll('script[type="application/json"]'));
                    for (const s of scripts) {
                        if (s.textContent && s.textContent.includes('scontent')) {
                            urls.push(s.textContent);
                        }
                    }

                    return urls;
                });

                for (const item of domData) {
                    if (item.length > 500) {
                        this.extractHighResFromText(item);
                    } else if (this.isHighResPhotoUrl(item)) {
                        this.collectedHighResUrls.add(this.cleanUrl(item));
                    }
                }

                console.log(`[Scraper] Scroll ${i + 1}/${maxScrolls}: Total unique high-res photos: ${this.collectedHighResUrls.size}`);

                // Scroll down to trigger pagination stream
                await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
                await new Promise(r => setTimeout(r, config.SCROLL_DELAY_MS));
            }

            const results = Array.from(this.collectedHighResUrls);
            console.log(`[Scraper] Scraping complete! Captured ${results.length} full-resolution photo URLs directly via pattern extraction.`);
            return results;
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

        // Match escaped and unescaped scontent URLs
        const regex = /(https:[\\\/]+scontent[^"'\s\\]+)/g;
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
            .replace(/&amp;/g, '&');
    }

    /**
     * Checks if a URL matches the high-resolution photo patterns
     */
    isHighResPhotoUrl(url) {
        if (!url || typeof url !== 'string') return false;
        if (!url.includes('scontent') || !url.includes('fbcdn.net')) return false;

        const lower = url.toLowerCase();

        // 1. Discard low-res thumbnail patterns
        if (lower.includes('p50x50') || lower.includes('p100x100') || lower.includes('s100x100') || lower.includes('s50x50')) return false;
        if (lower.includes('p160x160') || lower.includes('s320x320') || lower.includes('p240x240') || lower.includes('p320x320')) return false;
        if (lower.includes('s206x206') || lower.includes('cp0/e15/q65_p') || lower.includes('emoji.php') || lower.includes('rsrc.php')) return false;
        if (lower.includes('c0.') && lower.includes('a_dst-jpg')) return false; // Grid cropped squares

        // 2. Accept large / full resolution patterns
        if (lower.includes('cstp=mx1080') || lower.includes('ctp=s1080') || lower.includes('dst-jpg_tt6') || 
            lower.includes('s1080x') || lower.includes('s2048x') || lower.includes('s960x') || lower.includes('p720x') ||
            lower.includes('cstp=mx') || lower.includes('dst-jpg_s') || lower.includes('/v/t51.') || lower.includes('/v/t39.')) {
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
