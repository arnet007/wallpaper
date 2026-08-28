const fs = require('fs');
const path = require('path');
const config = require('./config');

class WallpaperDatabase {
    constructor(dbFile = config.DB_FILE, profilesFile = config.PROFILES_FILE) {
        this.dbFile = dbFile;
        this.profilesFile = profilesFile;
        this.init();
    }

    init() {
        if (!fs.existsSync(config.WALLPAPERS_DIR)) {
            fs.mkdirSync(config.WALLPAPERS_DIR, { recursive: true });
        }
        if (!fs.existsSync(this.dbFile)) {
            const initialDb = {
                created_at: new Date().toISOString(),
                last_updated: new Date().toISOString(),
                current_profile_index: 0,
                profiles: {},
                history: []
            };
            this.saveDb(initialDb);
        }
    }

    loadDb() {
        try {
            if (!fs.existsSync(this.dbFile)) {
                this.init();
            }
            const data = fs.readFileSync(this.dbFile, 'utf8');
            return JSON.parse(data);
        } catch (err) {
            console.error('[DB] Error loading database, initializing new:', err.message);
            const fallbackDb = {
                created_at: new Date().toISOString(),
                last_updated: new Date().toISOString(),
                current_profile_index: 0,
                profiles: {},
                history: []
            };
            this.saveDb(fallbackDb);
            return fallbackDb;
        }
    }

    saveDb(db) {
        db.last_updated = new Date().toISOString();
        const tmpFile = `${this.dbFile}.tmp`;
        fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf8');
        fs.renameSync(tmpFile, this.dbFile);
    }

    /**
     * Parses profiles.txt and returns list of profile objects
     * @returns {Array<{ id: string, name: string, url: string, photosUrl: string }>}
     */
    loadProfiles() {
        if (!fs.existsSync(this.profilesFile)) {
            fs.writeFileSync(this.profilesFile, 'https://www.facebook.com/rajnandinideyrj/photos\n', 'utf8');
        }

        const content = fs.readFileSync(this.profilesFile, 'utf8');
        const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));

        const profiles = [];
        for (const line of lines) {
            const parsed = this.parseProfileInput(line);
            if (parsed) {
                profiles.push(parsed);
            }
        }
        return profiles;
    }

    /**
     * Ensures a profile is added to profiles.txt if not already present
     */
    ensureProfileInList(profileObj) {
        if (!profileObj || !profileObj.photosUrl) return;
        const currentProfiles = this.loadProfiles();
        const exists = currentProfiles.some(p => p.id === profileObj.id);
        if (!exists) {
            fs.appendFileSync(this.profilesFile, `\n${profileObj.photosUrl}\n`, 'utf8');
            console.log(`[DB] Added new profile "${profileObj.id}" to profiles.txt`);
        }
    }

    /**
     * Parses a single profile line (URL, photo URL, or username)
     */
    parseProfileInput(input) {
        let cleanInput = input.trim();
        if (!cleanInput) return null;

        // If it's a full URL
        if (cleanInput.startsWith('http://') || cleanInput.startsWith('https://')) {
            try {
                const url = new URL(cleanInput);
                const pathParts = url.pathname.split('/').filter(Boolean);

                // Handle direct photo URLs (e.g. photo.php?fbid=...&set=pb.100009813407456... or /photo/?fbid=...)
                if (url.pathname.includes('photo.php') || url.pathname.includes('/photo/') || url.pathname.includes('/photo')) {
                    const setParam = url.searchParams.get('set') || '';
                    const pbMatch = setParam.match(/pb\.([0-9a-zA-Z_]+)/);
                    if (pbMatch && pbMatch[1]) {
                        const id = pbMatch[1];
                        return {
                            id: id,
                            name: id,
                            url: `https://www.facebook.com/${id}`,
                            photosUrl: `https://www.facebook.com/${id}/photos`
                        };
                    }
                    const fbid = url.searchParams.get('fbid');
                    if (fbid) {
                        return {
                            id: `photo_${fbid}`,
                            name: `Photo ${fbid}`,
                            url: cleanInput,
                            photosUrl: cleanInput
                        };
                    }
                }

                // Handle /profile.php?id=100012345678
                if (url.pathname.includes('profile.php')) {
                    const id = url.searchParams.get('id');
                    if (id) {
                        return {
                            id: `profile_${id}`,
                            name: `ID ${id}`,
                            url: `https://www.facebook.com/profile.php?id=${id}`,
                            photosUrl: `https://www.facebook.com/profile.php?id=${id}&sk=photos`
                        };
                    }
                }

                // Handle /username/photos or /username
                if (pathParts.length > 0) {
                    const username = pathParts[0];
                    return {
                        id: username,
                        name: username,
                        url: `https://www.facebook.com/${username}`,
                        photosUrl: `https://www.facebook.com/${username}/photos`
                    };
                }
            } catch (e) {
                // Ignore parse errors, fallback below
            }
        }

        // Clean bare username
        const username = cleanInput.replace(/[^a-zA-Z0-9._-]/g, '');
        return {
            id: username,
            name: username,
            url: `https://www.facebook.com/${username}`,
            photosUrl: `https://www.facebook.com/${username}/photos`
        };
    }

    /**
     * Helper to extract a unique signature / ID from a Facebook CDN URL
     */
    getImageIdFromUrl(url) {
        try {
            const u = new URL(url);
            const pathParts = u.pathname.split('/');
            const filename = pathParts[pathParts.length - 1]; // e.g. 715426534_18465772978106601_7553672841327514318_n.jpg
            if (filename && (filename.endsWith('.jpg') || filename.endsWith('.png'))) {
                return filename.split('.')[0];
            }
        } catch (e) {}
        // Fallback hash
        let hash = 0;
        for (let i = 0; i < url.length; i++) {
            hash = ((hash << 5) - hash) + url.charCodeAt(i);
            hash |= 0;
        }
        return `img_${Math.abs(hash)}`;
    }

    /**
     * Adds scraped image URLs to a profile in the DB, deduplicating and preserving existing state
     */
    addScrapedImages(profileId, profileUrl, newImageUrls, profileDisplayName = null) {
        const db = this.loadDb();
        if (!db.profiles[profileId]) {
            db.profiles[profileId] = {
                profile_id: profileId,
                display_name: profileDisplayName || profileId,
                photos_url: profileUrl,
                last_scraped_at: new Date().toISOString(),
                total_images: 0,
                used_count: 0,
                images: []
            };
        }

        const profile = db.profiles[profileId];
        profile.photos_url = profileUrl;
        profile.last_scraped_at = new Date().toISOString();
        if (profileDisplayName) {
            profile.display_name = profileDisplayName;
        }

        const existingMap = new Map();
        for (const img of profile.images) {
            existingMap.set(img.id, img);
            existingMap.set(img.url, img);
        }

        let addedCount = 0;
        for (const url of newImageUrls) {
            const imgId = this.getImageIdFromUrl(url);
            if (!existingMap.has(imgId) && !existingMap.has(url)) {
                const newEntry = {
                    id: imgId,
                    url: url,
                    scraped_at: new Date().toISOString(),
                    used: false,
                    used_at: null,
                    local_path: null
                };
                profile.images.push(newEntry);
                existingMap.set(imgId, newEntry);
                addedCount++;
            }
        }

        profile.total_images = profile.images.length;
        profile.used_count = profile.images.filter(img => img.used).length;

        this.saveDb(db);
        return { addedCount, total: profile.total_images, used: profile.used_count };
    }

    /**
     * Checks if a profile needs to be scraped / re-scraped
     * Re-scrapes if:
     * 1. Profile is not yet in DB or has 0 images
     * 2. All wallpapers have been used AND at least RE_SCRAPE_DAYS have passed since last scrape
     * 3. Force flag is set
     */
    needsRescrape(profileId, force = false, reScrapeDays = config.RE_SCRAPE_DAYS) {
        if (force) return true;

        const db = this.loadDb();
        const profile = db.profiles[profileId];

        if (!profile || !profile.images || profile.images.length === 0) {
            return true;
        }

        const unused = profile.images.filter(img => !img.used);
        if (unused.length === 0) {
            // All wallpapers have been used. Only re-scrape after RE_SCRAPE_DAYS
            // have passed; otherwise reuse existing images via
            // getNextUnusedWallpaper()'s built-in cycle reset.
            if (!profile.last_scraped_at) return true;
            const lastScraped = new Date(profile.last_scraped_at).getTime();
            const daysSinceScrape = (Date.now() - lastScraped) / (1000 * 60 * 60 * 24);
            return daysSinceScrape >= reScrapeDays;
        }

        return false;
    }

    /**
     * Selects the next unused wallpaper across profiles
     */
    getNextUnusedWallpaper(targetProfileId = null) {
        const db = this.loadDb();
        const profilesList = this.loadProfiles();

        if (profilesList.length === 0) {
            return null;
        }

        // Determine profile order
        let candidateProfileIds = [];
        if (targetProfileId) {
            candidateProfileIds = [targetProfileId];
        } else {
            // Rotate through profiles
            const count = profilesList.length;
            const startIdx = (db.current_profile_index || 0) % count;
            for (let i = 0; i < count; i++) {
                const idx = (startIdx + i) % count;
                candidateProfileIds.push(profilesList[idx].id);
            }
        }

        // 1. Try to find an unused wallpaper in current / subsequent profiles
        for (const pid of candidateProfileIds) {
            const profile = db.profiles[pid];
            if (profile && profile.images && profile.images.length > 0) {
                const unusedImages = profile.images.filter(img => !img.used);
                if (unusedImages.length > 0) {
                    // Pick the first unused (or random unused)
                    const selected = unusedImages[0];
                    return {
                        profileId: pid,
                        profileName: profile.display_name || profile.name || pid,
                        image: selected
                    };
                }
            }
        }

        // 2. If no unused wallpaper is found in any profile, check if we need to reset cycle (7-day rule)
        for (const pid of candidateProfileIds) {
            const profile = db.profiles[pid];
            if (profile && profile.images && profile.images.length > 0) {
                console.log(`[DB] All wallpapers for profile "${pid}" have been used. Resetting cycle for 7-day loop.`);
                // Reset used status
                for (const img of profile.images) {
                    img.used = false;
                    img.used_at = null;
                }
                profile.used_count = 0;
                this.saveDb(db);

                return {
                    profileId: pid,
                    image: profile.images[0]
                };
            }
        }

        return null;
    }

    /**
     * Marks a wallpaper as used and stores local path and timestamp
     */
    markWallpaperUsed(profileId, imageId, localPath) {
        const db = this.loadDb();
        const profile = db.profiles[profileId];
        if (!profile) return false;

        const img = profile.images.find(i => i.id === imageId || i.url === imageId);
        if (img) {
            img.used = true;
            img.used_at = new Date().toISOString();
            img.local_path = localPath;

            profile.used_count = profile.images.filter(i => i.used).length;

            db.history.push({
                profile_id: profileId,
                image_id: img.id,
                url: img.url,
                local_path: localPath,
                applied_at: img.used_at
            });

            // Update rotation index to next profile
            const profilesList = this.loadProfiles();
            if (profilesList.length > 0) {
                db.current_profile_index = ((db.current_profile_index || 0) + 1) % profilesList.length;
            }

            this.saveDb(db);
            return true;
        }
        return false;
    }

    /**
     * Returns stats for display
     */
    getStats() {
        const db = this.loadDb();
        const profilesList = this.loadProfiles();

        const stats = {
            totalProfilesConfigured: profilesList.length,
            profiles: []
        };

        for (const p of profilesList) {
            const data = db.profiles[p.id] || { total_images: 0, used_count: 0, last_scraped_at: 'Never', images: [] };
            const unusedCount = data.images ? data.images.filter(i => !i.used).length : 0;
            stats.profiles.push({
                id: p.id,
                photosUrl: p.photosUrl,
                totalImages: data.total_images || (data.images ? data.images.length : 0),
                usedImages: data.used_count || 0,
                unusedImages: unusedCount,
                lastScrapedAt: data.last_scraped_at || 'Never'
            });
        }

        return stats;
    }

    /**
     * Resets the used status for a profile or all profiles
     */
    resetUsed(profileId = null) {
        const db = this.loadDb();
        if (profileId) {
            if (db.profiles[profileId]) {
                for (const img of db.profiles[profileId].images) {
                    img.used = false;
                    img.used_at = null;
                }
                db.profiles[profileId].used_count = 0;
            }
        } else {
            for (const pid of Object.keys(db.profiles)) {
                for (const img of db.profiles[pid].images) {
                    img.used = false;
                    img.used_at = null;
                }
                db.profiles[pid].used_count = 0;
            }
        }
        this.saveDb(db);
    }
}

module.exports = new WallpaperDatabase();
module.exports.WallpaperDatabase = WallpaperDatabase;
