const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const { execSync } = require('child_process');
const config = require('./config');
const imageProcessor = require('./image_processor');

const UNIVERSAL_DB_FILE = path.join(__dirname, 'universal_db.json');
const CATEGORIES_ROOT_URL = 'https://santabanta.com/wallpapers/categories/';
const MIN_IMAGE_SIZE_BYTES = 20000;

class UniversalSantaBanta {
    constructor() {
        this.dbFile = UNIVERSAL_DB_FILE;
        this.initDb();
    }

    initDb() {
        if (!fs.existsSync(config.WALLPAPERS_DIR)) {
            fs.mkdirSync(config.WALLPAPERS_DIR, { recursive: true });
        }
        if (!fs.existsSync(this.dbFile)) {
            const initial = {
                created_at: new Date().toISOString(),
                last_updated: new Date().toISOString(),
                discovered_categories: [],
                history: [],
                galleries: {}
            };
            fs.writeFileSync(this.dbFile, JSON.stringify(initial, null, 2), 'utf8');
        }
    }

    loadDb() {
        try {
            return JSON.parse(fs.readFileSync(this.dbFile, 'utf8'));
        } catch (e) {
            this.initDb();
            return JSON.parse(fs.readFileSync(this.dbFile, 'utf8'));
        }
    }

    saveDb(db) {
        db.last_updated = new Date().toISOString();
        const tmp = `${this.dbFile}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
        fs.renameSync(tmp, this.dbFile);
    }

    /**
     * Fetches all available categories from https://santabanta.com/wallpapers/categories/
     */
    async fetchCategories() {
        console.log(`[Universal] Discovering categories from: ${CATEGORIES_ROOT_URL}`);
        const response = await axios.get(CATEGORIES_ROOT_URL, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });

        const $ = cheerio.load(response.data);
        const categories = [];
        const seen = new Set();

        $('a[href*="/wallpapers/categories/"]').each((_, el) => {
            const href = $(el).attr('href');
            if (!href) return;
            const fullUrl = href.startsWith('http') ? href : `https://santabanta.com${href}`;
            const parts = fullUrl.replace(/\/+$/, '').split('/');
            const slug = parts[parts.length - 1];

            if (slug && slug !== 'categories' && !seen.has(slug)) {
                seen.add(slug);
                const title = $(el).text().trim() || slug.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                categories.push({
                    slug,
                    title,
                    url: fullUrl
                });
            }
        });

        // Also add standard popular categories if not in root listing
        const standardSlugs = [
            { slug: 'outdoors', title: 'Outdoors' },
            { slug: 'nature', title: 'Nature' },
            { slug: 'cars', title: 'Cars' },
            { slug: 'bikes', title: 'Bikes' },
            { slug: 'animals', title: 'Animals' },
            { slug: 'indian-celebrities-f', title: 'Indian Celebrities (F)' },
            { slug: 'indian-celebrities-m', title: 'Indian Celebrities (M)' },
            { slug: 'global-celebrities-f', title: 'Global Celebrities (F)' },
            { slug: 'global-celebrities-m', title: 'Global Celebrities (M)' },
            { slug: 'bollywood-movies', title: 'Bollywood Movies' },
            { slug: 'hollywood-movies', title: 'Hollywood Movies' },
            { slug: 'sports', title: 'Sports' },
            { slug: 'cricket', title: 'Cricket' },
            { slug: 'miscellaneous', title: 'Miscellaneous' }
        ];

        for (const s of standardSlugs) {
            if (!seen.has(s.slug)) {
                categories.push({
                    slug: s.slug,
                    title: s.title,
                    url: `https://santabanta.com/wallpapers/categories/${s.slug}/`
                });
                seen.add(s.slug);
            }
        }

        const db = this.loadDb();
        db.discovered_categories = categories;
        this.saveDb(db);

        return categories;
    }

    /**
     * Fetches sub-galleries and pages from a category URL (e.g. /wallpapers/categories/outdoors/)
     */
    async fetchCategoryGalleries(categoryUrl) {
        console.log(`[Universal] Exploring Category: ${categoryUrl}`);
        const response = await axios.get(categoryUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });

        const $ = cheerio.load(response.data);

        // 1. Detect pagination
        let maxPage = 1;
        $('a[href*="page="]').each((_, el) => {
            const href = $(el).attr('href') || '';
            const match = href.match(/page=(\d+)/);
            if (match) {
                const p = parseInt(match[1], 10);
                if (p > maxPage) maxPage = p;
            }
        });

        // Pick a random page if multiple exist
        let targetPageUrl = categoryUrl;
        if (maxPage > 1) {
            const randomPage = Math.floor(Math.random() * maxPage) + 1;
            console.log(`[Universal] Category has ${maxPage} pages. Selected random page ${randomPage}/${maxPage}.`);
            if (randomPage > 1) {
                targetPageUrl = categoryUrl.includes('?') ? `${categoryUrl}&page=${randomPage}` : `${categoryUrl}?page=${randomPage}`;
            }
        }

        // Fetch target page
        const pageResp = (targetPageUrl === categoryUrl) ? response : await axios.get(targetPageUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });

        const page$ = cheerio.load(pageResp.data);
        const galleries = [];
        const seen = new Set();

        page$('a').each((_, el) => {
            const href = page$(el).attr('href') || '';
            // Sub-gallery links match e.g. /wallpapers/outdoors/summer/ or /wallpapers/indian-celebrities-f/pooja-hegde/
            if (href.includes('/wallpapers/') && !href.includes('/categories/') && !href.includes('order=') && !href.includes('page=')) {
                const fullUrl = href.startsWith('http') ? href : `https://santabanta.com${href}`;
                const parts = fullUrl.replace(/\/+$/, '').split('/');
                const subSlug = parts[parts.length - 1];
                const parentCat = parts[parts.length - 2];

                if (subSlug && subSlug !== 'wallpapers' && !seen.has(fullUrl)) {
                    seen.add(fullUrl);
                    const title = page$(el).text().trim() || subSlug.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    galleries.push({
                        slug: subSlug,
                        category: parentCat || 'general',
                        title,
                        url: fullUrl
                    });
                }
            }
        });

        return galleries;
    }

    /**
     * Scrapes wallpaper image links from a sub-gallery (e.g. /wallpapers/outdoors/summer/ or /sports/alexa-bliss/)
     */
    async fetchGalleryWallpapers(galleryUrl) {
        console.log(`[Universal] Scraping Gallery: ${galleryUrl}`);
        const response = await axios.get(galleryUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });

        const $ = cheerio.load(response.data);
        const wallpaperUrls = new Set();

        $('img').each((_, el) => {
            const rawSrc = $(el).attr('data-lazy-src') || $(el).attr('data-src') || $(el).attr('data-original') || $(el).attr('src');
            if (rawSrc && (rawSrc.includes('/wallpapers/') || rawSrc.includes('b-cdn.net')) && !rawSrc.includes('logo') && !rawSrc.includes('icon')) {
                const encoded = encodeURI(rawSrc.trim());
                const fullRes = encoded
                    .replace(/\/portrait-thumb\/\//i, '/Full5/')
                    .replace(/\/portrait-thumb\//i, '/Full5/')
                    .replace(/\/landscape-thumb\/\//i, '/Full5/')
                    .replace(/\/landscape-thumb\//i, '/Full5/')
                    .replace(/\/thumb\/\//i, '/Full5/')
                    .replace(/\/thumb\//i, '/Full5/');
                wallpaperUrls.add(fullRes);
            }
        });

        // Also check inside anchor tags
        $('a').each((_, el) => {
            const img = $(el).find('img');
            if (img.length > 0) {
                const rawSrc = img.attr('data-lazy-src') || img.attr('data-src') || img.attr('data-original') || img.attr('src');
                if (rawSrc && (rawSrc.includes('/wallpapers/') || rawSrc.includes('b-cdn.net')) && !rawSrc.includes('logo')) {
                    const encoded = encodeURI(rawSrc.trim());
                    const fullRes = encoded
                        .replace(/\/portrait-thumb\/\//i, '/Full5/')
                        .replace(/\/portrait-thumb\//i, '/Full5/')
                        .replace(/\/landscape-thumb\/\//i, '/Full5/')
                        .replace(/\/landscape-thumb\//i, '/Full5/')
                        .replace(/\/thumb\/\//i, '/Full5/')
                        .replace(/\/thumb\//i, '/Full5/');
                    wallpaperUrls.add(fullRes);
                }
            }
        });

        return Array.from(wallpaperUrls);
    }

    /**
     * Downloads image with candidate fallback resolution
     */
    async downloadWallpaper(url, destPath) {
        const candidateUrls = [
            url,
            url.replace('/Full5/', '/Full1/'),
            url.replace('/Full5/', '/Full/'),
            url.replace('/Full5/', '/portrait-thumb//'),
            url.replace('/Full5/', '/landscape-thumb//')
        ];

        const uniqueCandidates = Array.from(new Set(candidateUrls));
        let response = null;

        for (const targetUrl of uniqueCandidates) {
            try {
                console.log(`[Downloader] Trying: ${targetUrl}...`);
                const res = await axios({
                    method: 'GET',
                    url: targetUrl,
                    responseType: 'arraybuffer',
                    timeout: 25000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                        'Referer': 'https://santabanta.com/'
                    }
                });

                if (res.status === 200 && res.data.length >= MIN_IMAGE_SIZE_BYTES) {
                    response = res;
                    break;
                }
            } catch (e) {}
        }

        if (!response) {
            throw new Error(`Failed to download wallpaper from: ${url}`);
        }

        fs.writeFileSync(destPath, response.data);
        console.log(`[Downloader] Wallpaper saved: ${destPath} (${Math.round(response.data.length / 1024)} KB)`);
        return destPath;
    }

    applyWallpaper(imagePath) {
        const absolutePath = path.resolve(imagePath);
        console.log(`[Wallpaper] Applying desktop wallpaper: ${absolutePath}`);
        const cmd = `powershell -ExecutionPolicy Bypass -File "${config.SET_WALLPAPER_SCRIPT}" -ImagePath "${absolutePath}"`;
        const output = execSync(cmd, { encoding: 'utf8' });
        console.log(`[Wallpaper] ${output.trim()}`);
        return true;
    }

    cleanupOldWallpapers(keepFiles = []) {
        try {
            const keepSet = new Set(keepFiles.map(f => path.resolve(f).toLowerCase()));
            const files = fs.readdirSync(config.WALLPAPERS_DIR);
            let removedCount = 0;
            for (const file of files) {
                const fullPath = path.join(config.WALLPAPERS_DIR, file);
                if (!keepSet.has(fullPath.toLowerCase()) && fs.statSync(fullPath).isFile()) {
                    try {
                        fs.unlinkSync(fullPath);
                        removedCount++;
                    } catch (e) {}
                }
            }
            if (removedCount > 0) {
                console.log(`[Cleaner] Cleaned up ${removedCount} old wallpaper image(s).`);
            }
        } catch (err) {}
    }

    /**
     * Main execution: Random Category -> Random Page -> Random Gallery -> Full HD Wallpaper
     */
    async run(targetCategory = null) {
        console.log('================================================================');
        console.log('       SANTA BANTA UNIVERSAL RANDOM WALLPAPER CHANGER           ');
        console.log('================================================================\n');

        // Step 1: Select Category
        const categories = await this.fetchCategories();
        let selectedCategory = null;

        if (targetCategory) {
            const cleanTarget = targetCategory.toLowerCase().trim();
            selectedCategory = categories.find(c => c.slug === cleanTarget || c.title.toLowerCase().includes(cleanTarget));
            if (!selectedCategory) {
                selectedCategory = {
                    slug: cleanTarget,
                    title: cleanTarget.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                    url: `https://santabanta.com/wallpapers/categories/${cleanTarget}/`
                };
            }
        } else {
            // Pick a random category
            selectedCategory = categories[Math.floor(Math.random() * categories.length)];
        }

        console.log(`[Universal] Target Category: "${selectedCategory.title}" (${selectedCategory.url})`);

        // Step 2: Select Sub-Gallery
        const galleries = await this.fetchCategoryGalleries(selectedCategory.url);
        if (galleries.length === 0) {
            console.warn(`[Universal] No sub-galleries found for category "${selectedCategory.title}". Retrying with another category...`);
            return this.run(null);
        }

        const selectedGallery = galleries[Math.floor(Math.random() * galleries.length)];
        console.log(`[Universal] Selected Gallery: "${selectedGallery.title}" (${selectedGallery.url})`);

        // Step 3: Fetch Wallpapers
        const wallpapers = await this.fetchGalleryWallpapers(selectedGallery.url);
        if (wallpapers.length === 0) {
            console.warn(`[Universal] No wallpapers found in gallery "${selectedGallery.title}". Retrying...`);
            return this.run(null);
        }

        console.log(`[Universal] Found ${wallpapers.length} high-resolution wallpapers in "${selectedGallery.title}".`);

        // Step 4: Pick Wallpaper & Filter Used
        const db = this.loadDb();
        if (!db.galleries[selectedGallery.slug]) {
            db.galleries[selectedGallery.slug] = {
                title: selectedGallery.title,
                category: selectedCategory.title,
                url: selectedGallery.url,
                used_urls: []
            };
        }

        const galleryEntry = db.galleries[selectedGallery.slug];
        let availableUrls = wallpapers.filter(u => !galleryEntry.used_urls.includes(u));

        if (availableUrls.length === 0) {
            console.log(`[Universal] All wallpapers used for "${selectedGallery.title}". Resetting cycle.`);
            galleryEntry.used_urls = [];
            availableUrls = wallpapers;
        }

        const selectedUrl = availableUrls[Math.floor(Math.random() * availableUrls.length)];
        const fileName = `${selectedCategory.slug}_${selectedGallery.slug}_${Date.now()}.jpg`;
        const localFilePath = path.join(config.WALLPAPERS_DIR, fileName);

        // Step 5: Download & Apply
        try {
            await this.downloadWallpaper(selectedUrl, localFilePath);

            // Badge text (e.g. "Outdoors • Summer" or "Pooja Hegde")
            const badgeText = `${selectedCategory.title} • ${selectedGallery.title}`;
            const finalPath = await imageProcessor.processForDesktop(localFilePath, badgeText);

            this.applyWallpaper(finalPath);

            // Update DB
            galleryEntry.used_urls.push(selectedUrl);
            db.history.push({
                category: selectedCategory.title,
                gallery: selectedGallery.title,
                url: selectedUrl,
                applied_at: new Date().toISOString()
            });
            this.saveDb(db);

            // Clean up older wallpapers
            this.cleanupOldWallpapers([localFilePath, finalPath]);

            console.log(`\n[✔] Successfully set desktop wallpaper to: ${finalPath}`);
            console.log(`[✔] Topic: ${selectedCategory.title} -> ${selectedGallery.title}`);
        } catch (err) {
            console.error(`[❌] Error applying wallpaper: ${err.message}`);
            // Retry with another random category
            console.log('[Universal] Retrying with another gallery...');
            return this.run(null);
        }
    }
}

async function main() {
    const args = process.argv.slice(2);
    const app = new UniversalSantaBanta();

    if (args.includes('--categories') || args.includes('-c')) {
        const cats = await app.fetchCategories();
        console.log('\n========================================');
        console.log('    SANTABANTA AVAILABLE CATEGORIES    ');
        console.log('========================================');
        for (const c of cats) {
            console.log(` • ${c.title} (slug: ${c.slug}) -> ${c.url}`);
        }
        console.log('========================================\n');
        return;
    }

    if (args.includes('--status')) {
        const db = app.loadDb();
        console.log('\n========================================');
        console.log('   UNIVERSAL SANTABANTA WALLPAPER STATS ');
        console.log('========================================');
        console.log(`Discovered Categories: ${db.discovered_categories ? db.discovered_categories.length : 0}`);
        console.log(`Wallpapers Applied:     ${db.history ? db.history.length : 0}`);
        console.log(`Galleries Explored:     ${Object.keys(db.galleries || {}).length}`);
        if (db.history && db.history.length > 0) {
            const latest = db.history[db.history.length - 1];
            console.log(`Latest:                 ${latest.category} -> ${latest.gallery} (${latest.applied_at})`);
        }
        console.log('========================================\n');
        return;
    }

    const targetCategory = args.find(a => !a.startsWith('-')) || null;
    await app.run(targetCategory);
}

if (require.main === module) {
    main().catch(err => {
        console.error('Fatal error:', err.message);
        process.exit(1);
    });
}

module.exports = UniversalSantaBanta;
