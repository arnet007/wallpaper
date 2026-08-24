const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { execSync } = require('child_process');
const config = require('./config');
const db = require('./db');
const SantaBantaScraper = require('./scraper');
const imageProcessor = require('./image_processor');

const MIN_IMAGE_SIZE_BYTES = 20000;

/**
 * Downloads image from URL to local file path, upgrading to Full Landscape resolution when available
 */
async function downloadImage(url, destPath) {
    // Generate candidate high-resolution landscape URLs
    const candidateUrls = [
        url.replace(/\/portrait-thumb\/\//i, '/Full5/').replace(/\/portrait-thumb\//i, '/Full5/').replace(/\/landscape-thumb\/\//i, '/Full5/'),
        url.replace(/\/portrait-thumb\/\//i, '/Full1/').replace(/\/portrait-thumb\//i, '/Full1/'),
        url.replace(/\/portrait-thumb\/\//i, '/Full/').replace(/\/portrait-thumb\//i, '/Full/'),
        url
    ];

    const uniqueCandidates = Array.from(new Set(candidateUrls));
    let response = null;
    let successfulUrl = url;

    for (const targetUrl of uniqueCandidates) {
        try {
            console.log(`[Downloader] Attempting to fetch: ${targetUrl}...`);
            const res = await axios({
                method: 'GET',
                url: targetUrl,
                responseType: 'arraybuffer',
                timeout: 25000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://santabanta.com/'
                }
            });

            if (res.status === 200 && res.data.length >= MIN_IMAGE_SIZE_BYTES) {
                response = res;
                successfulUrl = targetUrl;
                break;
            }
        } catch (e) {}
    }

    if (!response) {
        throw new Error(`Failed to download valid image from: ${url}`);
    }

    const size = response.data.length;
    fs.writeFileSync(destPath, response.data);
    console.log(`[Downloader] Full landscape wallpaper saved: ${destPath} (${Math.round(size / 1024)} KB)`);
    return destPath;
}

/**
 * Calls PowerShell script to set Windows wallpaper
 */
function applyDesktopWallpaper(imagePath) {
    const absolutePath = path.resolve(imagePath);
    if (!fs.existsSync(absolutePath)) {
        throw new Error(`Wallpaper file does not exist: ${absolutePath}`);
    }

    console.log(`[Wallpaper] Applying desktop wallpaper: ${absolutePath}`);

    try {
        const cmd = `powershell -ExecutionPolicy Bypass -File "${config.SET_WALLPAPER_SCRIPT}" -ImagePath "${absolutePath}"`;
        const output = execSync(cmd, { encoding: 'utf8' });
        console.log(`[Wallpaper] ${output.trim()}`);
        return true;
    } catch (err) {
        console.error('[Wallpaper] Error setting wallpaper via PowerShell:', err.message);
        throw err;
    }
}

/**
 * Cleans up old wallpaper images from the wallpapers folder
 */
function cleanupOldWallpapers(keepFiles = []) {
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
            console.log(`[Cleaner] Cleaned up ${removedCount} old wallpaper image(s) to keep directory uncluttered.`);
        }
    } catch (err) {
        console.warn('[Cleaner] Cleanup note:', err.message);
    }
}

/**
 * Scrapes a category/gallery and updates DB
 */
async function scrapeCategory(scraper, catObj, maxScrolls, cleanOld = false) {
    console.log(`\n========================================`);
    console.log(`[Scraper] Processing SantaBanta: ${catObj.name} (${catObj.url})`);
    console.log(`========================================`);

    try {
        const urls = await scraper.scrapeGallery(catObj.url, maxScrolls);
        if (urls && urls.length > 0) {
            if (cleanOld) {
                const currentDb = db.loadDb();
                if (currentDb.categories[catObj.id]) {
                    currentDb.categories[catObj.id].images = [];
                    currentDb.categories[catObj.id].total_images = 0;
                    currentDb.categories[catObj.id].used_count = 0;
                    db.saveDb(currentDb);
                }
            }
            const result = db.addScrapedImages(catObj.id, catObj.url, urls);
            console.log(`[DB] Category "${catObj.id}" updated: +${result.addedCount} wallpapers (Total: ${result.total}, Used: ${result.used})`);
            return result;
        } else {
            console.warn(`[Scraper] No wallpapers found for category: ${catObj.name}`);
            return null;
        }
    } catch (err) {
        console.error(`[Scraper] Error scraping ${catObj.name}:`, err.message);
        return null;
    }
}

/**
 * Main routine
 */
async function run(options = {}) {
    let categories = db.loadCategories();

    if (options.targetCatObj) {
        const exists = categories.some(c => c.id === options.targetCatObj.id);
        if (!exists) {
            categories.push(options.targetCatObj);
        }
    }

    if (categories.length === 0) {
        console.error('[!] No categories found in categories.txt. Please add gallery URLs.');
        return;
    }

    const activeCategories = options.targetCategory
        ? categories.filter(c => c.id === options.targetCategory)
        : categories;

    if (activeCategories.length === 0) {
        console.error(`[!] Target category "${options.targetCategory}" not found.`);
        return;
    }

    console.log(`[Wallpaper] Active Target: ${options.targetCategory || 'All Categories (Rotation Mode)'}`);

    // 1. Scrape if needed
    let scraperInstance = null;
    const getScraper = async () => {
        if (!scraperInstance) {
            scraperInstance = new SantaBantaScraper();
            await scraperInstance.init(options.headless !== false);
        }
        return scraperInstance;
    };

    try {
        if (options.scrapeOnly || options.forceScrape) {
            const scraper = await getScraper();
            for (const c of activeCategories) {
                await scrapeCategory(scraper, c, options.maxScrolls || config.MAX_SCROLLS, true);
            }
            if (options.scrapeOnly) {
                console.log('\n[✔] Scraping complete.');
                return;
            }
        } else {
            for (const c of activeCategories) {
                if (db.needsRescrape(c.id)) {
                    console.log(`[!] Category "${c.id}" requires scraping.`);
                    const scraper = await getScraper();
                    await scrapeCategory(scraper, c, options.maxScrolls || config.MAX_SCROLLS, false);
                }
            }
        }
    } finally {
        if (scraperInstance) {
            await scraperInstance.close();
        }
    }

    if (options.scrapeOnly) return;

    // 2. Select next unused wallpaper
    console.log('\n[Wallpaper] Selecting next unused SantaBanta wallpaper...');

    let attempts = 0;
    while (attempts < 10) {
        attempts++;
        let selection = db.getNextUnusedWallpaper(options.targetCategory);

        if (!selection) {
            console.log(`[!] No unused wallpapers in DB for ${options.targetCategory || 'selected category'}. Triggering scrape...`);
            scraperInstance = new SantaBantaScraper();
            try {
                await scraperInstance.init(options.headless !== false);
                for (const c of activeCategories) {
                    await scrapeCategory(scraperInstance, c, options.maxScrolls || config.MAX_SCROLLS, true);
                }
            } finally {
                await scraperInstance.close();
            }
            selection = db.getNextUnusedWallpaper(options.targetCategory);
        }

        if (!selection) {
            console.error(`[❌] Could not find or scrape any wallpapers for ${options.targetCategory || 'category'}.`);
            return;
        }

        const { categoryId, image } = selection;
        const catName = options.targetCatObj ? options.targetCatObj.name : categoryId.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        console.log(`[Wallpaper] Selected photo ID: ${image.id} from category: ${categoryId}`);

        const fileName = `${categoryId}_${image.id}.jpg`;
        const localFilePath = path.join(config.WALLPAPERS_DIR, fileName);

        try {
            await downloadImage(image.url, localFilePath);

            // Process portrait / narrow image with aesthetic blurred side fills and top-right SantaBanta badge
            const finalWallpaperPath = await imageProcessor.processForDesktop(localFilePath, catName);

            applyDesktopWallpaper(finalWallpaperPath);
            db.markWallpaperUsed(categoryId, image.id, finalWallpaperPath);

            // Clean up old wallpapers to keep directory uncluttered
            cleanupOldWallpapers([localFilePath, finalWallpaperPath]);

            console.log(`\n[✔] Successfully set desktop wallpaper to: ${finalWallpaperPath}`);
            return;
        } catch (downloadErr) {
            console.warn(`[!] Skipped photo ${image.id}: ${downloadErr.message}`);
            db.markWallpaperUsed(categoryId, image.id, null);
        }
    }
}

/**
 * Command line interface
 */
async function main() {
    const args = process.argv.slice(2);

    const options = {
        scrapeOnly: args.includes('--scrape') || args.includes('-s'),
        forceScrape: args.includes('--force-scrape') || args.includes('-f'),
        status: args.includes('--status') || args.includes('-st'),
        reset: args.includes('--reset'),
        restore: args.includes('--restore'),
        headless: !args.includes('--visible'),
        targetCategory: null,
        targetCatObj: null,
        maxScrolls: config.MAX_SCROLLS
    };

    let rawTarget = null;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if ((arg === '--category' || arg === '--profile') && args[i + 1]) {
            rawTarget = args[i + 1];
            i++;
        } else if (!arg.startsWith('-') && !rawTarget) {
            rawTarget = arg;
        }
    }

    if (rawTarget) {
        const parsed = db.parseCategoryInput(rawTarget);
        if (parsed) {
            options.targetCategory = parsed.id;
            options.targetCatObj = parsed;
            db.ensureCategoryInList(parsed);
        }
    }

    const scrollsIdx = args.indexOf('--scrolls');
    if (scrollsIdx !== -1 && args[scrollsIdx + 1]) {
        options.maxScrolls = parseInt(args[scrollsIdx + 1]) || config.MAX_SCROLLS;
    }

    if (options.restore) {
        const files = fs.readdirSync(config.WALLPAPERS_DIR)
            .filter(f => (f.endsWith('.jpg') || f.endsWith('.png')) && !f.includes('_desktop'));
        if (files.length > 0) {
            const latestFile = path.join(config.WALLPAPERS_DIR, files[files.length - 1]);
            const catId = path.basename(latestFile).split('_')[0];
            const catName = catId.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            console.log(`[Wallpaper] Restoring desktop wallpaper from: ${latestFile}`);
            const processed = await imageProcessor.processForDesktop(latestFile, catName);
            applyDesktopWallpaper(processed);
            console.log('[✔] Wallpaper restored successfully.');
        } else {
            console.error('[!] No cached wallpaper files found in wallpapers/ folder.');
        }
        return;
    }

    if (options.status) {
        const stats = db.getStats();
        console.log('\n========================================');
        console.log('       SANTABANTA WALLPAPER STATUS      ');
        console.log('========================================');
        console.log(`Configured Categories: ${stats.totalCategoriesConfigured}`);
        for (const c of stats.categories) {
            console.log(`\n Category: ${c.name} (${c.id})`);
            console.log(`   URL: ${c.url}`);
            console.log(`   Total Wallpapers:  ${c.totalImages}`);
            console.log(`   Used Wallpapers:   ${c.usedImages}`);
            console.log(`   Unused Wallpapers: ${c.unusedImages}`);
            console.log(`   Last Scraped:      ${c.lastScrapedAt}`);
        }
        console.log('========================================\n');
        return;
    }

    if (options.reset) {
        db.resetUsed(options.targetCategory);
        console.log(`[✔] Reset used wallpaper status for ${options.targetCategory || 'all categories'}.`);
        return;
    }

    await run(options);
}

if (require.main === module) {
    main().catch(err => {
        console.error('\n[❌] Fatal error:', err.message);
        process.exit(1);
    });
}

module.exports = { run, applyDesktopWallpaper, downloadImage };
