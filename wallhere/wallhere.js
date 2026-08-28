const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const config = require('./config');
const WallhereScraper = require('./scraper');
const WallhereDb = require('./db');
const imageProcessor = require('./image_processor_wallhere');

class WallhereWallpaperChanger {
    constructor() {
        this.scraper = new WallhereScraper();
        this.db = new WallhereDb();
        this.ensureDirectories();
    }

    ensureDirectories() {
        [config.WALLPAPERS_DIR, config.DB_DIR].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    /**
     * Applies wallpaper using Win32 API script
     */
    applyWallpaper(imagePath) {
        const absolutePath = path.resolve(imagePath);
        if (!fs.existsSync(absolutePath)) {
            throw new Error(`Wallpaper file not found: ${absolutePath}`);
        }

        console.log(`[Wallpaper] Applying desktop wallpaper: ${absolutePath}`);
        try {
            const cmd = `powershell -ExecutionPolicy Bypass -File "${config.SET_WALLPAPER_SCRIPT}" -ImagePath "${absolutePath}"`;
            const output = execSync(cmd, { encoding: 'utf8' });
            console.log(`[Wallpaper] ${output.trim()}`);
            return true;
        } catch (err) {
            console.error('[Wallpaper] Error setting wallpaper:', err.message);
            throw err;
        }
    }

    /**
     * Cleans up old wallpaper files in the wallpapers directory
     */
    cleanupOldWallpapers(keepFiles = []) {
        try {
            const keepSet = new Set(keepFiles.map(f => path.resolve(f).toLowerCase()));
            const files = fs.readdirSync(config.WALLPAPERS_DIR)
                .filter(f => f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png'))
                .map(f => {
                    const fullPath = path.join(config.WALLPAPERS_DIR, f);
                    return {
                        path: fullPath,
                        time: fs.statSync(fullPath).mtime.getTime()
                    };
                })
                .sort((a, b) => b.time - a.time);

            let removedCount = 0;
            // Always keep files in keepFiles, and keep the latest config.KEEP_WALLPAPERS_COUNT * 2 files
            const maxToKeep = Math.max((config.KEEP_WALLPAPERS_COUNT || 2) * 2, 4);
            const candidatesToDelete = files.slice(maxToKeep);

            for (const item of candidatesToDelete) {
                if (!keepSet.has(item.path.toLowerCase())) {
                    try {
                        fs.unlinkSync(item.path);
                        removedCount++;
                    } catch (e) {}
                }
            }

            if (removedCount > 0) {
                console.log(`[Cleaner] Cleaned up ${removedCount} old wallpaper image(s).`);
            }
        } catch (err) {
            console.warn('[Cleaner] Cleanup notice:', err.message);
        }
    }

    /**
     * Main run function
     */
    async run(targetArg = 'random') {
        console.log('================================================================');
        console.log('            WALLHERE HIGH-RESOLUTION WALLPAPER CHANGER          ');
        console.log('================================================================\n');

        let wallpaperDetail = null;

        // Check if argument is a direct wallpaper ID or full wallpaper URL
        const isDirectIdOrUrl = /^\d+$/.test(targetArg) || /wallhere\.com\/.*\/wallpaper\/\d+/i.test(targetArg);

        if (isDirectIdOrUrl) {
            console.log(`[Mode] Direct Wallpaper: ${targetArg}`);
            wallpaperDetail = await this.scraper.resolveWallpaperDetail(targetArg);
        } else {
            // Fetch listing of candidates
            let modeOrQuery = targetArg;
            if (targetArg === '--popular') modeOrQuery = 'popular';
            else if (targetArg === '--latest') modeOrQuery = 'latest';

            console.log(`[Mode] Searching/Fetching candidates: "${modeOrQuery}"`);
            const candidates = await this.scraper.fetchWallpapers(modeOrQuery);
            if (candidates.length === 0) {
                throw new Error(`No wallpapers found for query: ${targetArg}`);
            }

            console.log(`[Scraper] Found ${candidates.length} candidates.`);

            // Filter unused candidates
            let available = candidates.filter(c => !this.db.isUsed(c.id));
            if (available.length === 0) {
                console.log('[Cycle] All candidate wallpapers in this set were already used. Resetting cycle history.');
                this.db.reset();
                available = candidates;
            }

            // Pick a random wallpaper from available
            const selected = available[Math.floor(Math.random() * available.length)];
            console.log(`[Selected] Wallpaper ID: ${selected.id} ("${selected.title}")`);

            // Resolve full-resolution details
            wallpaperDetail = await this.scraper.resolveWallpaperDetail(selected.pageUrl);
        }

        console.log(`[Detail] Title: "${wallpaperDetail.title}"`);
        if (wallpaperDetail.resolution) {
            console.log(`[Detail] Declared Resolution: ${wallpaperDetail.resolution}`);
        }

        // Generate clean file name
        const timestamp = Date.now();
        const safeTitle = (wallpaperDetail.title || 'wallhere')
            .replace(/[^a-z0-9_-]/gi, '_')
            .substring(0, 40);
        const fileName = `wallhere_${wallpaperDetail.id}_${safeTitle}_${timestamp}.jpg`;
        const localFilePath = path.join(config.WALLPAPERS_DIR, fileName);

        // Download high-resolution master image
        const downloadInfo = await this.scraper.downloadWallpaper(wallpaperDetail, localFilePath);

        // Process for desktop widescreen
        const badgeText = config.BADGE_ENABLED ? (wallpaperDetail.title ? `WallHere • ${wallpaperDetail.title.slice(0, 20)}` : 'WallHere') : '';
        const finalWallpaperPath = await imageProcessor.processForDesktop(localFilePath, badgeText);

        // Set as Windows desktop wallpaper
        this.applyWallpaper(finalWallpaperPath);

        // Record in database
        this.db.record({
            id: wallpaperDetail.id,
            title: wallpaperDetail.title,
            pageUrl: wallpaperDetail.pageUrl,
            resolution: `${downloadInfo.width}x${downloadInfo.height}`
        });

        // Cleanup old files
        this.cleanupOldWallpapers([localFilePath, finalWallpaperPath]);

        console.log(`\n[✔] Successfully set desktop wallpaper!`);
        console.log(`[✔] ID: ${wallpaperDetail.id}`);
        console.log(`[✔] Resolution: ${downloadInfo.width}x${downloadInfo.height} (${Math.round(downloadInfo.sizeBytes / 1024)} KB)`);
        console.log(`[✔] Path: ${finalWallpaperPath}`);
        return finalWallpaperPath;
    }
}

async function main() {
    const args = process.argv.slice(2);
    const app = new WallhereWallpaperChanger();

    if (args.includes('--status')) {
        const status = app.db.getStatus();
        console.log('\n========================================');
        console.log('       WALLHERE WALLPAPER STATS         ');
        console.log('========================================');
        console.log(`Wallpapers Applied:     ${status.totalApplied}`);
        console.log(`Used This Cycle:        ${status.usedThisCycle}`);
        if (status.latest) {
            console.log(`Latest Wallpaper:       ${status.latest.title || status.latest.id}`);
            console.log(`Latest Resolution:      ${status.latest.resolution || 'HD'}`);
            console.log(`Applied At:             ${status.latest.applied_at}`);
        }
        console.log('========================================\n');
        return;
    }

    if (args.includes('--reset')) {
        app.db.reset();
        return;
    }

    if (args.includes('--clean')) {
        app.cleanupOldWallpapers([]);
        console.log('[Cleaner] Cleaned wallpaper directory.');
        return;
    }

    const target = args.length > 0 ? args[0] : 'random';
    await app.run(target);
}

if (require.main === module) {
    main().catch(err => {
        console.error('\n[❌] Fatal error:', err.message);
        process.exit(1);
    });
}

module.exports = WallhereWallpaperChanger;