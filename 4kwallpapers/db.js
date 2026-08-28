const fs = require('fs');
const config = require('./config');

class WallpaperDb {
    static MAX_USED_URLS = 500;

    constructor(dbFile = config.DB_FILE) {
        this.dbFile = dbFile;
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
                used_urls: [],
                history: []
            };
            fs.writeFileSync(this.dbFile, JSON.stringify(initial, null, 2), 'utf8');
        }
    }

    freshDb() {
        return {
            created_at: new Date().toISOString(),
            last_updated: new Date().toISOString(),
            used_urls: [],
            history: []
        };
    }

    initDb() {
        if (!fs.existsSync(config.WALLPAPERS_DIR)) {
            fs.mkdirSync(config.WALLPAPERS_DIR, { recursive: true });
        }
        if (!fs.existsSync(this.dbFile)) {
            fs.writeFileSync(this.dbFile, JSON.stringify(this.freshDb(), null, 2), 'utf8');
        }
    }

    load() {
        try {
            return JSON.parse(fs.readFileSync(this.dbFile, 'utf8'));
        } catch (e) {
            // Corrupt or unreadable file: start over
            const fresh = this.freshDb();
            this.save(fresh);
            return fresh;
        }
    }

    save(db) {
        db.last_updated = new Date().toISOString();
        const tmp = `${this.dbFile}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
        fs.renameSync(tmp, this.dbFile);
    }

    isUsed(url, db = this.load()) {
        return db.used_urls.includes(url);
    }

    /**
     * Records an applied wallpaper.
     */
    record(entry, db = this.load()) {
        db.used_urls.push(entry.url);
        // Keep the used-pool bounded
        if (db.used_urls.length > WallpaperDb.MAX_USED_URLS) {
            db.used_urls = db.used_urls.slice(-WallpaperDb.MAX_USED_URLS / 2);
        }
        db.history.push(entry);
        this.save(db);
    }

    reset(db = this.load()) {
        db.used_urls = [];
        this.save(db);
    }
}

module.exports = WallpaperDb;
