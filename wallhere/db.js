const fs = require('fs');
const path = require('path');
const config = require('./config');

class WallhereDb {
    constructor() {
        this.dbDir = config.DB_DIR || path.join(__dirname, 'db');
        this.dbFile = path.join(this.dbDir, 'wallpapers_db.json');
        this.legacyFile = path.join(this.dbDir, 'db.json');
        this.ensureDir();
    }

    ensureDir() {
        if (!fs.existsSync(this.dbDir)) {
            fs.mkdirSync(this.dbDir, { recursive: true });
        }
    }

    /**
     * Loads the database, migrating legacy db.json if needed
     */
    load() {
        this.ensureDir();
        if (fs.existsSync(this.dbFile)) {
            try {
                const data = fs.readFileSync(this.dbFile, 'utf8');
                return JSON.parse(data);
            } catch (err) {
                console.warn('[DB] Error parsing database file, initializing empty state:', err.message);
            }
        }

        // Check legacy db.json
        if (fs.existsSync(this.legacyFile)) {
            try {
                const legacyData = JSON.parse(fs.readFileSync(this.legacyFile, 'utf8'));
                const legacyHistory = Array.isArray(legacyData.history) ? legacyData.history : [];
                const usedIds = [];
                for (const item of legacyHistory) {
                    if (typeof item === 'string') {
                        const m = item.match(/-(\d+)\./) || item.match(/\/(\d+)$/);
                        if (m) usedIds.push(m[1]);
                    }
                }
                const initial = {
                    used_ids: Array.from(new Set(usedIds)),
                    history: []
                };
                this.save(initial);
                return initial;
            } catch (e) {}
        }

        return {
            used_ids: [],
            history: []
        };
    }

    save(data) {
        try {
            this.ensureDir();
            fs.writeFileSync(this.dbFile, JSON.stringify(data, null, 2), 'utf8');
        } catch (err) {
            console.error('[DB] Failed to save database:', err.message);
        }
    }

    isUsed(id) {
        const db = this.load();
        return db.used_ids.includes(String(id));
    }

    record(item) {
        const db = this.load();
        const strId = String(item.id);
        if (!db.used_ids.includes(strId)) {
            db.used_ids.push(strId);
        }

        // Limit used_ids to last 200 items so we don't accumulate indefinitely
        if (db.used_ids.length > 200) {
            db.used_ids = db.used_ids.slice(-200);
        }

        db.history.push({
            id: strId,
            title: item.title || '',
            pageUrl: item.pageUrl || '',
            resolution: item.resolution || '',
            applied_at: item.applied_at || new Date().toISOString()
        });

        if (db.history.length > 50) {
            db.history = db.history.slice(-50);
        }

        this.save(db);
    }

    reset() {
        const db = this.load();
        db.used_ids = [];
        this.save(db);
        console.log('[DB] Wallhere cycle history reset successfully.');
    }

    getStatus() {
        const db = this.load();
        return {
            totalApplied: db.history.length,
            usedThisCycle: db.used_ids.length,
            latest: db.history.length > 0 ? db.history[db.history.length - 1] : null
        };
    }
}

module.exports = WallhereDb;
