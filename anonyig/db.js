const fs = require('fs');
const path = require('path');
const config = require('./config');

class AnonyIGDatabase {
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
            console.error('[DB] Error loading database, initializing fresh:', err.message);
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

    cleanUsername(input) {
        if (!input || typeof input !== 'string') return '';
        let clean = input.trim();
        // Remove trailing slash
        clean = clean.replace(/\/+$/, '');
        // Extract from URL: e.g. https://www.instagram.com/aliaabhatt or https://anonyig.com/en1/iganony/aliaabhatt
        if (clean.startsWith('http://') || clean.startsWith('https://')) {
            try {
                const u = new URL(clean);
                const parts = u.pathname.split('/').filter(Boolean);
                if (parts.length > 0) {
                    clean = parts[parts.length - 1];
                }
            } catch (e) {}
        }
        // Remove leading @
        clean = clean.replace(/^@+/, '');
        // Clean out invalid characters
        clean = clean.replace(/[^a-zA-Z0-9._]/g, '').toLowerCase();
        return clean;
    }

    loadProfiles() {
        if (!fs.existsSync(this.profilesFile)) {
            fs.writeFileSync(this.profilesFile, 'aliaabhatt\nshraddhakapoor\ndishapatani\n', 'utf8');
        }

        const content = fs.readFileSync(this.profilesFile, 'utf8');
        const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));

        const profiles = [];
        const seen = new Set();
        for (const line of lines) {
            const username = this.cleanUsername(line);
            if (username && !seen.has(username)) {
                seen.add(username);
                profiles.push({
                    username,
                    raw: line
                });
            }
        }
        return profiles;
    }

    ensureProfileInList(username) {
        const clean = this.cleanUsername(username);
        if (!clean) return;
        const current = this.loadProfiles();
        const exists = current.some(p => p.username === clean);
        if (!exists) {
            fs.appendFileSync(this.profilesFile, `\n${clean}\n`, 'utf8');
            console.log(`[DB] Added new profile "${clean}" to profiles.txt`);
        }
    }

    getImageId(item) {
        if (item.id) return String(item.id);
        if (item.childId) return String(item.childId);
        if (item.shortcode) return String(item.shortcode);
        // Fallback hash of URL
        const str = item.url || item.downloadUrl || String(Date.now());
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return `ig_${Math.abs(hash)}`;
    }

    addScrapedImages(username, newImages) {
        const clean = this.cleanUsername(username);
        const db = this.loadDb();
        if (!db.profiles[clean]) {
            db.profiles[clean] = {
                username: clean,
                last_scraped_at: new Date().toISOString(),
                total_images: 0,
                used_count: 0,
                images: []
            };
        }

        const profile = db.profiles[clean];
        profile.last_scraped_at = new Date().toISOString();

        const existingMap = new Map();
        for (const img of profile.images) {
            existingMap.set(img.id, img);
            existingMap.set(img.url, img);
        }

        let addedCount = 0;
        for (const item of newImages) {
            const imgId = this.getImageId(item);
            const imgUrl = item.url || item.downloadUrl;
            if (!imgUrl) continue;

            if (!existingMap.has(imgId) && !existingMap.has(imgUrl)) {
                const newEntry = {
                    id: imgId,
                    url: imgUrl,
                    download_url: item.downloadUrl || imgUrl,
                    shortcode: item.shortcode || null,
                    width: item.width || null,
                    height: item.height || null,
                    type: item.type || 'post',
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

    needsRescrape(username, force = false, reScrapeDays = config.RE_SCRAPE_DAYS) {
        if (force) return true;

        const clean = this.cleanUsername(username);
        const db = this.loadDb();
        const profile = db.profiles[clean];

        if (!profile || !profile.images || profile.images.length === 0) {
            return true;
        }

        const unused = profile.images.filter(img => !img.used);
        if (unused.length === 0) {
            if (!profile.last_scraped_at) return true;
            const lastScraped = new Date(profile.last_scraped_at).getTime();
            const daysSinceScrape = (Date.now() - lastScraped) / (1000 * 60 * 60 * 24);
            return daysSinceScrape >= reScrapeDays;
        }

        return false;
    }

    getNextUnusedWallpaper(targetUsername = null) {
        const db = this.loadDb();
        const profileList = this.loadProfiles();

        if (profileList.length === 0 && !targetUsername) return null;

        let candidateUsernames = [];
        if (targetUsername) {
            candidateUsernames = [this.cleanUsername(targetUsername)];
        } else {
            const count = profileList.length;
            const startIdx = (db.current_profile_index || 0) % count;
            for (let i = 0; i < count; i++) {
                const idx = (startIdx + i) % count;
                candidateUsernames.push(profileList[idx].username);
            }
        }

        // 1. Check for unused wallpapers in candidate profiles
        for (const u of candidateUsernames) {
            const profile = db.profiles[u];
            if (profile && profile.images && profile.images.length > 0) {
                const unused = profile.images.filter(img => !img.used);
                if (unused.length > 0) {
                    return {
                        username: u,
                        image: unused[0]
                    };
                }
            }
        }

        // 2. If all images are used, reset cycle for candidate profile
        for (const u of candidateUsernames) {
            const profile = db.profiles[u];
            if (profile && profile.images && profile.images.length > 0) {
                console.log(`[DB] All wallpapers for "@${u}" used. Resetting cycle.`);
                for (const img of profile.images) {
                    img.used = false;
                    img.used_at = null;
                }
                profile.used_count = 0;
                this.saveDb(db);

                return {
                    username: u,
                    image: profile.images[0]
                };
            }
        }

        return null;
    }

    markWallpaperUsed(username, imageId, localPath) {
        const clean = this.cleanUsername(username);
        const db = this.loadDb();
        const profile = db.profiles[clean];
        if (!profile) return false;

        const img = profile.images.find(i => i.id === imageId || i.url === imageId);
        if (img) {
            img.used = true;
            img.used_at = new Date().toISOString();
            img.local_path = localPath;

            profile.used_count = profile.images.filter(i => i.used).length;

            db.history.push({
                username: clean,
                image_id: img.id,
                url: img.url,
                local_path: localPath,
                applied_at: img.used_at
            });

            const profileList = this.loadProfiles();
            if (profileList.length > 0) {
                db.current_profile_index = ((db.current_profile_index || 0) + 1) % profileList.length;
            }

            this.saveDb(db);
            return true;
        }
        return false;
    }

    getStats() {
        const db = this.loadDb();
        const profileList = this.loadProfiles();

        const stats = {
            totalProfilesConfigured: profileList.length,
            profiles: [],
            totalHistoryCount: (db.history || []).length
        };

        for (const p of profileList) {
            const data = db.profiles[p.username] || { total_images: 0, used_count: 0, last_scraped_at: 'Never', images: [] };
            const unusedCount = data.images ? data.images.filter(i => !i.used).length : 0;
            stats.profiles.push({
                username: p.username,
                totalImages: data.total_images || (data.images ? data.images.length : 0),
                usedImages: data.used_count || 0,
                unusedImages: unusedCount,
                lastScrapedAt: data.last_scraped_at || 'Never'
            });
        }

        return stats;
    }

    resetUsed(username = null) {
        const db = this.loadDb();
        if (username) {
            const clean = this.cleanUsername(username);
            if (db.profiles[clean]) {
                for (const img of db.profiles[clean].images) {
                    img.used = false;
                    img.used_at = null;
                }
                db.profiles[clean].used_count = 0;
            }
        } else {
            for (const u of Object.keys(db.profiles)) {
                for (const img of db.profiles[u].images) {
                    img.used = false;
                    img.used_at = null;
                }
                db.profiles[u].used_count = 0;
            }
        }
        this.saveDb(db);
    }
}

module.exports = new AnonyIGDatabase();
module.exports.AnonyIGDatabase = AnonyIGDatabase;
