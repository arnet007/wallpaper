const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { execSync } = require('child_process');
const config = require('./config');
const db = require('./db');
const FacebookScraper = require('./scraper');
const auth = require('./auth');
const imageProcessor = require('./image_processor');

const MIN_IMAGE_SIZE_BYTES = 30000; // 30 KB threshold to ensure full HD / 4K wallpapers

/**
 * Downloads image from URL to local file path
 */
async function downloadImage(url, destPath) {
    console.log(`[Downloader] Downloading wallpaper: ${url.substring(0, 80)}...`);
    const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'arraybuffer',
        timeout: 25000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://www.facebook.com/'
        }
    });

    if (response.status !== 200) {
        throw new Error(`HTTP error ${response.status} when downloading image`);
    }

    const size = response.data.length;
    if (size < MIN_IMAGE_SIZE_BYTES) {
        throw new Error(`Image size is too small (${size} bytes). Rejected thumbnail in favor of full resolution.`);
    }

    fs.writeFileSync(destPath, response.data);
    console.log(`[Downloader] High-resolution image saved: ${destPath} (${Math.round(size / 1024)} KB)`);
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

    const stats = fs.statSync(absolutePath);
    if (stats.size < MIN_IMAGE_SIZE_BYTES) {
        throw new Error(`Wallpaper file is too small or invalid (${stats.size} bytes)`);
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
 * Scrapes a profile using direct pattern matching and updates DB
 */
async function scrapeProfile(scraper, profile, maxScrolls, cleanOld = false) {
    console.log(`\n========================================`);
    console.log(`[Scraper] Processing Profile: ${profile.name} (${profile.photosUrl})`);
    console.log(`========================================`);

    try {
        const scrapeResult = await scraper.scrapePhotos(profile.photosUrl, maxScrolls);
        const urls = Array.isArray(scrapeResult) ? scrapeResult : (scrapeResult.urls || []);
        const displayName = (!Array.isArray(scrapeResult) && scrapeResult.displayName) ? scrapeResult.displayName : null;

        if (urls && urls.length > 0) {
            if (cleanOld) {
                console.log(`[DB] Clearing old entries for "${profile.id}" to store full-resolution photos.`);
                const currentDb = db.loadDb();
                if (currentDb.profiles[profile.id]) {
                    currentDb.profiles[profile.id].images = [];
                    currentDb.profiles[profile.id].total_images = 0;
                    currentDb.profiles[profile.id].used_count = 0;
                    db.saveDb(currentDb);
                }
            }
            const result = db.addScrapedImages(profile.id, profile.photosUrl, urls, displayName);
            if (displayName) {
                console.log(`[DB] Captured display name: "${displayName}" for profile "${profile.id}"`);
            }
            console.log(`[DB] Profile "${profile.id}" updated: +${result.addedCount} high-res images (Total: ${result.total}, Used: ${result.used})`);
            return result;
        } else {
            console.warn(`[Scraper] No high-res photos found for profile: ${profile.name}`);
            return null;
        }
    } catch (err) {
        console.error(`[Scraper] Error scraping ${profile.name}:`, err.message);
        return null;
    }
}

/**
 * Cleans up old wallpaper images from the wallpapers folder to prevent disk clutter
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
 * Main routine to scrape profiles if needed, pick unused wallpaper, process aspect ratio, and apply
 */
async function run(options = {}) {
    let profiles = db.loadProfiles();
    
    // If a target profile object was specified (e.g. passed via CLI argument)
    if (options.targetProfileObj) {
        const exists = profiles.some(p => p.id === options.targetProfileObj.id);
        if (!exists) {
            profiles.push(options.targetProfileObj);
        }
    }

    if (profiles.length === 0) {
        console.error('[!] No profiles found in profiles.txt. Please add profile URLs to profiles.txt');
        return;
    }

    // Filter profiles if target specified
    const activeProfiles = options.targetProfile
        ? profiles.filter(p => p.id === options.targetProfile)
        : profiles;

    if (activeProfiles.length === 0) {
        console.error(`[!] Target profile "${options.targetProfile}" not found.`);
        return;
    }

    console.log(`[Wallpaper] Active Profile Target: ${options.targetProfile || 'All Profiles (Rotation Mode)'}`);

    // 1. Check if scraping is needed for active profile(s)
    let scraperInstance = null;
    const getScraper = async () => {
        if (!scraperInstance) {
            scraperInstance = new FacebookScraper();
            await scraperInstance.init(options.headless !== false);
        }
        return scraperInstance;
    };

    try {
        if (options.scrapeOnly || options.forceScrape) {
            const scraper = await getScraper();
            for (const p of activeProfiles) {
                await scrapeProfile(scraper, p, options.maxScrolls || config.MAX_SCROLLS, true);
            }
            if (options.scrapeOnly) {
                console.log('\n[✔] High-resolution scraping complete.');
                return;
            }
        } else {
            for (const p of activeProfiles) {
                if (db.needsRescrape(p.id)) {
                    console.log(`[!] Profile "${p.id}" requires scraping (new profile, empty, or 7-day re-scrape cycle).`);
                    const scraper = await getScraper();
                    await scrapeProfile(scraper, p, options.maxScrolls || config.MAX_SCROLLS, false);
                }
            }
        }
    } finally {
        if (scraperInstance) {
            await scraperInstance.close();
        }
    }

    if (options.scrapeOnly) return;

    // 2. Select next unused wallpaper from the targeted profile(s)
    console.log('\n[Wallpaper] Selecting next unused high-resolution wallpaper...');
    
    let attempts = 0;
    while (attempts < 10) {
        attempts++;
        let selection = db.getNextUnusedWallpaper(options.targetProfile);

        if (!selection) {
            console.log(`[!] No unused wallpapers in DB for ${options.targetProfile || 'selected profile'}. Triggering fresh scrape...`);
            scraperInstance = new FacebookScraper();
            try {
                await scraperInstance.init(options.headless !== false);
                for (const p of activeProfiles) {
                    await scrapeProfile(scraperInstance, p, options.maxScrolls || config.MAX_SCROLLS, true);
                }
            } finally {
                await scraperInstance.close();
            }
            selection = db.getNextUnusedWallpaper(options.targetProfile);
        }

        if (!selection) {
            console.error(`[❌] Could not find or scrape any high-resolution wallpapers for ${options.targetProfile || 'profile'}.`);
            return;
        }

        const { profileId, profileName, image } = selection;
        const displayName = profileName || profileId;
        console.log(`[Wallpaper] Selected photo ID: ${image.id} from profile: ${displayName}`);

        const fileName = `${profileId}_${image.id}.jpg`;
        const localFilePath = path.join(config.WALLPAPERS_DIR, fileName);

        try {
            await downloadImage(image.url, localFilePath);
            
            // Process portrait / narrow image with aesthetic blurred side fills and top-right Facebook badge
            const finalWallpaperPath = await imageProcessor.processForDesktop(localFilePath, displayName);

            applyDesktopWallpaper(finalWallpaperPath);
            db.markWallpaperUsed(profileId, image.id, finalWallpaperPath);

            // Clean up old wallpapers to prevent disk clutter
            cleanupOldWallpapers([localFilePath, finalWallpaperPath]);

            console.log(`\n[✔] Successfully set desktop wallpaper to: ${finalWallpaperPath}`);
            return;
        } catch (downloadErr) {
            console.warn(`[!] Skipped photo ${image.id}: ${downloadErr.message}`);
            db.markWallpaperUsed(profileId, image.id, null);
        }
    }
}

/**
 * Command line interface
 */
async function main() {
    const args = process.argv.slice(2);

    if (args.includes('--login')) {
        await auth.loginOneTime();
        return;
    }

    const options = {
        scrapeOnly: args.includes('--scrape') || args.includes('-s'),
        forceScrape: args.includes('--force-scrape') || args.includes('-f'),
        status: args.includes('--status') || args.includes('-st'),
        reset: args.includes('--reset'),
        restore: args.includes('--restore'),
        headless: !args.includes('--visible'),
        targetProfile: null,
        targetProfileObj: null,
        maxScrolls: config.MAX_SCROLLS
    };

    // Extract target profile from --profile flag OR positional arguments
    let rawTarget = null;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--profile' && args[i + 1]) {
            rawTarget = args[i + 1];
            i++;
        } else if (!arg.startsWith('-') && !rawTarget) {
            // Positional argument (e.g. "jyotshnapanda.bulbul" or "https://www.facebook.com/...")
            rawTarget = arg;
        }
    }

    if (rawTarget) {
        const parsed = db.parseProfileInput(rawTarget);
        if (parsed) {
            options.targetProfile = parsed.id;
            options.targetProfileObj = parsed;
            db.ensureProfileInList(parsed);
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
            const profileId = path.basename(latestFile).split('_')[0];
            console.log(`[Wallpaper] Restoring desktop wallpaper from: ${latestFile} (Profile: ${profileId})`);
            const processed = await imageProcessor.processForDesktop(latestFile, profileId);
            applyDesktopWallpaper(processed);
            console.log('[✔] Wallpaper restored successfully.');
        } else {
            console.error('[!] No cached wallpaper files found in wallpapers/ folder.');
        }
        return;
    }

    if (options.status) {
        const stats = db.getStats();
        const cookieStatus = auth.cookiesStatus();
        console.log('\n========================================');
        console.log('       FACEBOOK WALLPAPER STATUS        ');
        console.log('========================================');
        console.log(`Configured Profiles: ${stats.totalProfilesConfigured}`);
        console.log(`Stored Cookies:      ${cookieStatus.message}`);
        for (const p of stats.profiles) {
            console.log(`\n Profile: ${p.id}`);
            console.log(`   URL: ${p.photosUrl}`);
            console.log(`   Total Photos:  ${p.totalImages}`);
            console.log(`   Used Photos:   ${p.usedImages}`);
            console.log(`   Unused Photos: ${p.unusedImages}`);
            console.log(`   Last Scraped:  ${p.lastScrapedAt}`);
        }
        console.log('========================================\n');
        return;
    }

    if (options.reset) {
        db.resetUsed(options.targetProfile);
        console.log(`[✔] Reset used wallpaper status for ${options.targetProfile || 'all profiles'}.`);
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
