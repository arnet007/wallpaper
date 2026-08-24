const fs = require('fs');
const path = require('path');
const config = require('./config');

class SantaBantaDatabase {
    constructor(dbFile = config.DB_FILE, categoriesFile = config.CATEGORIES_FILE) {
        this.dbFile = dbFile;
        this.categoriesFile = categoriesFile;
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
                current_category_index: 0,
                categories: {},
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
                current_category_index: 0,
                categories: {},
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

    loadCategories() {
        if (!fs.existsSync(this.categoriesFile)) {
            fs.writeFileSync(this.categoriesFile, 'https://santabanta.com/wallpapers/indian-celebrities-f/pooja-hegde/\n', 'utf8');
        }

        const content = fs.readFileSync(this.categoriesFile, 'utf8');
        const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));

        const categories = [];
        for (const line of lines) {
            const parsed = this.parseCategoryInput(line);
            if (parsed) {
                categories.push(parsed);
            }
        }
        return categories;
    }

    ensureCategoryInList(catObj) {
        if (!catObj || !catObj.url) return;
        const current = this.loadCategories();
        const exists = current.some(c => c.id === catObj.id);
        if (!exists) {
            fs.appendFileSync(this.categoriesFile, `\n${catObj.url}\n`, 'utf8');
            console.log(`[DB] Added new category "${catObj.id}" to categories.txt`);
        }
    }

    parseCategoryInput(input) {
        let clean = input.trim();
        if (!clean) return null;

        if (clean.startsWith('http://') || clean.startsWith('https://')) {
            try {
                const url = new URL(clean);
                const pathParts = url.pathname.split('/').filter(Boolean);
                // e.g. /wallpapers/indian-celebrities-f/pooja-hegde/
                const id = pathParts[pathParts.length - 1] || 'general';
                const formattedName = id.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

                return {
                    id: id.toLowerCase(),
                    name: formattedName,
                    url: clean
                };
            } catch (e) {}
        }

        // Clean slug input (e.g. "pooja-hegde" or "bmw")
        const slug = clean.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/^-+|-+$/g, '');
        const formattedName = slug.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

        // Construct standard URL
        let categoryUrl = `https://santabanta.com/wallpapers/indian-celebrities-f/${slug}/`;
        if (slug === 'bmw' || slug === 'audi' || slug === 'ferrari') {
            categoryUrl = `https://santabanta.com/wallpapers/cars/${slug}/`;
        } else if (slug === 'universe' || slug === 'sunset' || slug === 'waterfall') {
            categoryUrl = `https://santabanta.com/wallpapers/nature/${slug}/`;
        }

        return {
            id: slug,
            name: formattedName,
            url: categoryUrl
        };
    }

    getImageIdFromUrl(url) {
        try {
            const u = new URL(url);
            const pathParts = u.pathname.split('/');
            const filename = pathParts[pathParts.length - 1];
            if (filename && (filename.endsWith('.jpg') || filename.endsWith('.png'))) {
                return filename.split('.')[0];
            }
        } catch (e) {}
        // Deterministic fallback hash so repeated calls for the same URL return the same ID
        let hash = 0;
        for (let i = 0; i < url.length; i++) {
            hash = ((hash << 5) - hash) + url.charCodeAt(i);
            hash |= 0;
        }
        return `sb_${Math.abs(hash)}`;
    }

    addScrapedImages(categoryId, categoryUrl, newImageUrls) {
        const db = this.loadDb();
        if (!db.categories[categoryId]) {
            db.categories[categoryId] = {
                category_id: categoryId,
                url: categoryUrl,
                last_scraped_at: new Date().toISOString(),
                total_images: 0,
                used_count: 0,
                images: []
            };
        }

        const cat = db.categories[categoryId];
        cat.url = categoryUrl;
        cat.last_scraped_at = new Date().toISOString();

        const existingMap = new Map();
        for (const img of cat.images) {
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
                cat.images.push(newEntry);
                existingMap.set(imgId, newEntry);
                addedCount++;
            }
        }

        cat.total_images = cat.images.length;
        cat.used_count = cat.images.filter(img => img.used).length;

        this.saveDb(db);
        return { addedCount, total: cat.total_images, used: cat.used_count };
    }

    needsRescrape(categoryId, force = false, reScrapeDays = config.RE_SCRAPE_DAYS) {
        if (force) return true;

        const db = this.loadDb();
        const cat = db.categories[categoryId];

        if (!cat || !cat.images || cat.images.length === 0) {
            return true;
        }

        const unused = cat.images.filter(img => !img.used);
        if (unused.length === 0) {
            // Only re-scrape after RE_SCRAPE_DAYS have passed; otherwise reuse
            // existing images via getNextUnusedWallpaper()'s cycle reset.
            if (!cat.last_scraped_at) return true;
            const lastScraped = new Date(cat.last_scraped_at).getTime();
            const daysSinceScrape = (Date.now() - lastScraped) / (1000 * 60 * 60 * 24);
            return daysSinceScrape >= reScrapeDays;
        }

        return false;
    }

    getNextUnusedWallpaper(targetCategoryId = null) {
        const db = this.loadDb();
        const catList = this.loadCategories();

        if (catList.length === 0) return null;

        let candidateIds = [];
        if (targetCategoryId) {
            candidateIds = [targetCategoryId];
        } else {
            const count = catList.length;
            const startIdx = (db.current_category_index || 0) % count;
            for (let i = 0; i < count; i++) {
                const idx = (startIdx + i) % count;
                candidateIds.push(catList[idx].id);
            }
        }

        // 1. Check for unused wallpapers
        for (const cid of candidateIds) {
            const cat = db.categories[cid];
            if (cat && cat.images && cat.images.length > 0) {
                const unused = cat.images.filter(img => !img.used);
                if (unused.length > 0) {
                    return {
                        categoryId: cid,
                        image: unused[0]
                    };
                }
            }
        }

        // 2. Reset 7-day cycle if all used
        for (const cid of candidateIds) {
            const cat = db.categories[cid];
            if (cat && cat.images && cat.images.length > 0) {
                console.log(`[DB] All wallpapers for "${cid}" used. Resetting cycle.`);
                for (const img of cat.images) {
                    img.used = false;
                    img.used_at = null;
                }
                cat.used_count = 0;
                this.saveDb(db);

                return {
                    categoryId: cid,
                    image: cat.images[0]
                };
            }
        }

        return null;
    }

    markWallpaperUsed(categoryId, imageId, localPath) {
        const db = this.loadDb();
        const cat = db.categories[categoryId];
        if (!cat) return false;

        const img = cat.images.find(i => i.id === imageId || i.url === imageId);
        if (img) {
            img.used = true;
            img.used_at = new Date().toISOString();
            img.local_path = localPath;

            cat.used_count = cat.images.filter(i => i.used).length;

            db.history.push({
                category_id: categoryId,
                image_id: img.id,
                url: img.url,
                local_path: localPath,
                applied_at: img.used_at
            });

            const catList = this.loadCategories();
            if (catList.length > 0) {
                db.current_category_index = ((db.current_category_index || 0) + 1) % catList.length;
            }

            this.saveDb(db);
            return true;
        }
        return false;
    }

    getStats() {
        const db = this.loadDb();
        const catList = this.loadCategories();

        const stats = {
            totalCategoriesConfigured: catList.length,
            categories: []
        };

        for (const c of catList) {
            const data = db.categories[c.id] || { total_images: 0, used_count: 0, last_scraped_at: 'Never', images: [] };
            const unusedCount = data.images ? data.images.filter(i => !i.used).length : 0;
            stats.categories.push({
                id: c.id,
                name: c.name,
                url: c.url,
                totalImages: data.total_images || (data.images ? data.images.length : 0),
                usedImages: data.used_count || 0,
                unusedImages: unusedCount,
                lastScrapedAt: data.last_scraped_at || 'Never'
            });
        }

        return stats;
    }

    resetUsed(categoryId = null) {
        const db = this.loadDb();
        if (categoryId) {
            if (db.categories[categoryId]) {
                for (const img of db.categories[categoryId].images) {
                    img.used = false;
                    img.used_at = null;
                }
                db.categories[categoryId].used_count = 0;
            }
        } else {
            for (const cid of Object.keys(db.categories)) {
                for (const img of db.categories[cid].images) {
                    img.used = false;
                    img.used_at = null;
                }
                db.categories[cid].used_count = 0;
            }
        }
        this.saveDb(db);
    }
}

module.exports = new SantaBantaDatabase();
module.exports.SantaBantaDatabase = SantaBantaDatabase;
