const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const config = require('./config');
const scraper = require('./scraper');
const db = require('./db');
const imageProcessor = require('./image_processor');

class AnonyIGWallpaperChanger {
    constructor() {
        this.scraper = scraper;
        this.db = db;
        this.imageProcessor = imageProcessor;
    }

    /**
     * Applies desktop wallpaper via PowerShell Win32 API script
     */
    applyWallpaper(imagePath) {
        const absolutePath = path.resolve(imagePath);
        console.log(`[Wallpaper] Applying desktop wallpaper: ${absolutePath}`);
        const cmd = `powershell -ExecutionPolicy Bypass -File "${config.SET_WALLPAPER_SCRIPT}" -ImagePath "${absolutePath}"`;
        const output = execSync(cmd, { encoding: 'utf8' });
        console.log(`[Wallpaper] ${output.trim()}`);
        return true;
    }

    /**
     * Cleans up old cached wallpaper files keeping only the currently active files
     */
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
     * Scrapes a profile and saves images into the database
     */
    async scrapeAndSaveProfile(username, options = {}) {
        const cleanName = this.db.cleanUsername(username);
        if (!cleanName) {
            throw new Error(`Invalid username provided: "${username}"`);
        }

        console.log(`\n================================================================`);
        console.log(`     SCRAPING INSTAGRAM PROFILE: @${cleanName} (AnonyIG)         `);
        console.log(`================================================================\n`);

        const result = await this.scraper.scrapeProfile(cleanName, options);
        if (!result.images || result.images.length === 0) {
            throw new Error(`No downloadable images found for "@${cleanName}". Profile might be private or empty.`);
        }

        const stats = this.db.addScrapedImages(cleanName, result.images);
        this.db.ensureProfileInList(cleanName);

        console.log(`[DB] Scraped ${result.images.length} images. Added ${stats.addedCount} new images. Total in pool: ${stats.total} (Used: ${stats.used}).`);
        return stats;
    }

    /**
     * Main flow: determine target profile -> scrape if needed -> select unused image -> download -> process -> set wallpaper
     */
    async run(targetInput = null, options = {}) {
        console.log('================================================================');
        console.log('     INSTAGRAM DESKTOP WALLPAPER CHANGER (AnonyIG)              ');
        console.log('================================================================\n');

        let targetProfile = targetInput ? this.db.cleanUsername(targetInput) : null;

        // If specific target provided, ensure it's recorded
        if (targetProfile) {
            this.db.ensureProfileInList(targetProfile);
        }

        // Check configured profiles
        const profiles = this.db.loadProfiles();
        if (profiles.length === 0 && !targetProfile) {
            throw new Error(`No profiles found in profiles.txt. Please add at least one Instagram username.`);
        }

        // Determine active profile to check
        const activeProfile = targetProfile || this.db.getNextUnusedWallpaper()?.username || profiles[0]?.username;

        // Check if scraping is needed
        const forceScrape = !!options.forceScrape;
        if (this.db.needsRescrape(activeProfile, forceScrape)) {
            console.log(`[Scraper] Profile "@${activeProfile}" needs scraping (force: ${forceScrape}).`);
            await this.scrapeAndSaveProfile(activeProfile, options);
        }

        // Pick next unused image
        let item = this.db.getNextUnusedWallpaper(targetProfile);

        // If still no item (e.g. first run without data), scrape immediately
        if (!item) {
            const chosen = targetProfile || profiles[0].username;
            console.log(`[Scraper] Initializing image pool for "@${chosen}"...`);
            await this.scrapeAndSaveProfile(chosen, options);
            item = this.db.getNextUnusedWallpaper(chosen);
        }

        if (!item || !item.image) {
            throw new Error(`Could not find an available wallpaper for "@${activeProfile}".`);
        }

        let selectedItem = item;
        let downloadedPath = null;
        let finalWallpaperPath = null;
        let attempts = 0;
        const maxAttempts = 5;

        while (selectedItem && selectedItem.image && attempts < maxAttempts) {
            const { username, image } = selectedItem;
            console.log(`\n[Selected] Next wallpaper from "@${username}": Image ID ${image.id}`);

            const timestamp = Date.now();
            const rawFileName = `ig_${username}_${image.id}_${timestamp}_raw.jpg`;
            const rawFilePath = path.join(config.WALLPAPERS_DIR, rawFileName);

            try {
                await this.scraper.downloadImage(image, rawFilePath);
                downloadedPath = rawFilePath;

                // Aesthetic Processing: portrait blur fill + frosted Instagram SVG badge
                finalWallpaperPath = await this.imageProcessor.processForDesktop(rawFilePath, username);

                // Apply wallpaper
                this.applyWallpaper(finalWallpaperPath);

                // Mark as used in database
                this.db.markWallpaperUsed(username, image.id, finalWallpaperPath);

                // Clean up older wallpaper files
                this.cleanupOldWallpapers([rawFilePath, finalWallpaperPath]);

                console.log(`\n[✔] Successfully set desktop wallpaper to: ${finalWallpaperPath}`);
                console.log(`[✔] Instagram Source: @${username}`);
                break;
            } catch (err) {
                console.warn(`[Downloader] Failed on image ID ${image.id}: ${err.message}. Trying next image...`);
                this.db.markWallpaperUsed(username, image.id, null); // Skip problematic image
                selectedItem = this.db.getNextUnusedWallpaper(targetProfile);
                attempts++;
            }
        }

        if (!finalWallpaperPath) {
            throw new Error(`Failed to download and apply any wallpaper after ${attempts} attempts.`);
        }

        // Close scraper browser
        await this.scraper.close();
    }

    /**
     * Displays summary statistics
     */
    showStatus() {
        const stats = this.db.getStats();
        console.log('\n===============================================================');
        console.log('       INSTAGRAM (ANONYIG) WALLPAPER CHANGER STATS             ');
        console.log('===============================================================');
        console.log(`Configured Profiles:    ${stats.totalProfilesConfigured}`);
        console.log(`Total Wallpapers Set:   ${stats.totalHistoryCount}`);
        console.log('---------------------------------------------------------------');
        console.log(
            'Username'.padEnd(24) +
            'Total'.padEnd(10) +
            'Unused'.padEnd(10) +
            'Used'.padEnd(8) +
            'Last Scraped'
        );
        console.log('---------------------------------------------------------------');

        for (const p of stats.profiles) {
            const uName = `@${p.username}`.padEnd(24);
            const total = String(p.totalImages).padEnd(10);
            const unused = String(p.unusedImages).padEnd(10);
            const used = String(p.usedImages).padEnd(8);
            const dateStr = p.lastScrapedAt === 'Never' ? 'Never' : new Date(p.lastScrapedAt).toLocaleDateString();
            console.log(`${uName}${total}${unused}${used}${dateStr}`);
        }
        console.log('===============================================================\n');
    }
}

async function main() {
    const args = process.argv.slice(2);
    const app = new AnonyIGWallpaperChanger();

    if (args.includes('--status') || args.includes('-s')) {
        app.showStatus();
        return;
    }

    if (args.includes('--clean')) {
        app.cleanupOldWallpapers([]);
        console.log('[Cleaner] Cache cleanup completed.');
        return;
    }

    if (args.includes('--reset')) {
        const target = args.find(a => !a.startsWith('-'));
        app.db.resetUsed(target);
        console.log(`[DB] Reset used wallpaper cycle for ${target ? `@${target}` : 'all profiles'}.`);
        return;
    }

    const forceScrape = args.includes('--force-scrape') || args.includes('-f');
    const includeStories = args.includes('--stories');
    const targetProfile = args.find(a => !a.startsWith('-'));

    await app.run(targetProfile, {
        forceScrape,
        includeStories
    });
}

if (require.main === module) {
    main().catch(err => {
        console.error('\n[Fatal Error]:', err.message);
        process.exit(1);
    });
}

module.exports = AnonyIGWallpaperChanger;
