const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const config = require('./config');

class SantaBantaScraper {
    constructor() {
        this.browser = null;
    }

    async init(headless = true) {
        const tempDir = path.join(__dirname, '.chrome-temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

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
     * Converts thumbnail URL to Full landscape HD wallpaper URL (e.g. /Full5/)
     */
    transformToFullResolution(url) {
        if (!url || typeof url !== 'string') return url;
        return url
            .replace(/\/portrait-thumb\/\//i, '/Full5/')
            .replace(/\/portrait-thumb\//i, '/Full5/')
            .replace(/\/landscape-thumb\/\//i, '/Full5/')
            .replace(/\/landscape-thumb\//i, '/Full5/')
            .replace(/\/thumb\/\//i, '/Full5/')
            .replace(/\/thumb\//i, '/Full5/');
    }

    async scrapeGallery(galleryUrl, maxScrolls = config.MAX_SCROLLS) {
        if (!this.browser) {
            await this.init(true);
        }

        console.log(`[Scraper] Navigating to SantaBanta gallery: ${galleryUrl}`);
        const page = await this.browser.newPage();
        const collectedUrls = new Set();

        try {
            await page.setViewport({ width: 1920, height: 1080 });
            await page.goto(galleryUrl, {
                waitUntil: 'networkidle2',
                timeout: config.PAGE_TIMEOUT_MS
            }).catch(err => {
                console.log(`[Scraper] Navigation note: ${err.message}`);
            });

            await new Promise(r => setTimeout(r, 2000));

            console.log(`[Scraper] Scrolling gallery page to load all full landscape wallpapers (up to ${maxScrolls} scrolls)...`);

            for (let i = 0; i < maxScrolls; i++) {
                const foundOnPage = await page.evaluate(() => {
                    const urls = [];
                    const imgs = Array.from(document.querySelectorAll('img'));
                    for (const img of imgs) {
                        const src = img.getAttribute('data-lazy-src') || img.getAttribute('data-src') || img.getAttribute('data-original') || img.currentSrc || img.src;
                        if (src && (src.includes('b-cdn.net/wallpapers') || src.includes('media.santabanta.com') || src.includes('/wallpapers/'))) {
                            if (!src.includes('logo') && !src.includes('icon') && !src.includes('ad')) {
                                urls.push(src.trim());
                            }
                        }
                    }
                    return urls;
                });

                for (const u of foundOnPage) {
                    if (this.isValidWallpaperUrl(u)) {
                        // Transform thumbnail to Full Landscape /Full5/ URL with proper encoding
                        const encoded = encodeURI(u);
                        const fullResUrl = this.transformToFullResolution(encoded);
                        collectedUrls.add(fullResUrl);
                    }
                }

                console.log(`[Scraper] Scroll ${i + 1}/${maxScrolls}: Total wallpapers found: ${collectedUrls.size}`);
                await page.evaluate(() => window.scrollBy(0, window.innerHeight * 1.5));
                await new Promise(r => setTimeout(r, config.SCROLL_DELAY_MS));
            }

            const results = Array.from(collectedUrls);
            console.log(`[Scraper] Scraping complete! Found ${results.length} full-resolution landscape wallpapers.`);
            return results;
        } finally {
            if (page && !page.isClosed()) {
                await page.close().catch(() => {});
            }
        }
    }

    isValidWallpaperUrl(url) {
        if (!url || typeof url !== 'string') return false;
        const lower = url.toLowerCase();
        if (lower.includes('logo') || lower.includes('banner') || lower.includes('favicon')) return false;
        if (lower.endsWith('.jpg') || lower.endsWith('.png') || lower.endsWith('.webp') || lower.endsWith('.jpeg')) {
            return true;
        }
        return false;
    }

    async close() {
        if (this.browser) {
            await this.browser.close().catch(() => {});
            this.browser = null;
        }
    }
}

module.exports = SantaBantaScraper;
