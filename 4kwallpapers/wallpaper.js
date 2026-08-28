const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const config = require('./config');
const { FourKWallpapersScraper } = require('./scraper');
const WallpaperDb = require('./db');
const imageProcessor = require('./image_processor');

class FourKWallpaperChanger {
    constructor() {
        this.scraper = new FourKWallpapersScraper();
        this.db = new WallpaperDb();
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
     * Main execution: Random listing page -> unused wallpaper -> 4K download -> desktop
     */
    async run() {
        console.log('================================================================');
        console.log('       4KWALLPAPERS.COM NATURE WALLPAPER CHANGER                ');
        console.log('================================================================\n');

        // Step 1: Collect candidates from a random page of the category
        const links = await this.scraper.fetchWallpaperLinks();
        if (links.length === 0) {
            throw new Error('No wallpapers found on the nature category pages.');
        }
        console.log(`[Scraper] Found ${links.length} wallpapers on the selected page.`);

        // Step 2: Pick an unused one (fall back to any if all used)
        const usedDb = this.db.load();
        let available = links.filter(l => !usedDb.used_urls.includes(l.url));
        if (available.length === 0) {
            console.log('[Cycle] All wallpapers on this page already used. Starting a new cycle.');
            this.db.reset(usedDb);
            available = links;
        }

        const selected = available[Math.floor(Math.random() * available.length)];
        console.log(`[Selected] "${selected.title}" (${selected.url})`);

        // Step 3: Resolve full-resolution URL and download
        const downloadUrl = await this.scraper.resolveDownloadUrl(selected.url);
        console.log(`[Downloader] Resolution source: ${downloadUrl}`);

        const fileName = `${selected.slug}_${selected.id}_${Date.now()}.jpg`;
        const localFilePath = path.join(config.WALLPAPERS_DIR, fileName);
        await this.scraper.downloadWallpaper(downloadUrl, localFilePath);

        // Step 4: Process & apply
        const badgeText = `Nature • ${selected.title}`;
        const finalPath = await imageProcessor.processForDesktop(localFilePath, badgeText);
        this.applyWallpaper(finalPath);

        // Step 5: Record & clean up
        this.db.record({
            title: selected.title,
            url: selected.url,
            image: downloadUrl,
            applied_at: new Date().toISOString()
        });

        this.cleanupOldWallpapers([localFilePath, finalPath]);

        console.log(`\n[✔] Successfully set desktop wallpaper to: ${finalPath}`);
        console.log(`[✔] Topic: Nature -> ${selected.title}`);
    }
}

async function main() {
    const args = process.argv.slice(2);
    const app = new FourKWallpaperChanger();

    if (args.includes('--status')) {
        const db = app.db.load();
        console.log('\n========================================');
        console.log('   4KWALLPAPERS WALLPAPER STATS         ');
        console.log('========================================');
        console.log(`Wallpapers Applied:     ${(db.history || []).length}`);
        console.log(`URLs Used This Cycle:   ${(db.used_urls || []).length}`);
        if ((db.history || []).length > 0) {
            const latest = db.history[db.history.length - 1];
            console.log(`Latest:                 ${latest.title} (${latest.applied_at})`);
        }
        console.log('========================================\n');
        return;
    }

    await app.run();
}

if (require.main === module) {
    main().catch(err => {
        console.error('Fatal error:', err.message);
        process.exit(1);
    });
}

module.exports = FourKWallpaperChanger;
