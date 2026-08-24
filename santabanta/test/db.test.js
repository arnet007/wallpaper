const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { SantaBantaDatabase } = require('../db');

function makeTempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'santabanta-db-test-'));
}

function destroyTempDir(dir) {
    try {
        fs.rmSync(dir, { recursive: true, force: true });
    } catch (e) {}
}

describe('SantaBantaDatabase', () => {
    let tmpDir;
    let dbFile;
    let categoriesFile;
    let db;

    beforeEach(() => {
        tmpDir = makeTempDir();
        dbFile = path.join(tmpDir, 'santabanta_db.json');
        categoriesFile = path.join(tmpDir, 'categories.txt');
        // Give the DB its own wallpapers directory (config.WALLPAPERS_DIR is
        // global, but init() only creates it if missing — use the temp dir).
        process.env.WALLPAPERS_DIR_TEST = tmpDir;
        db = new SantaBantaDatabase(dbFile, categoriesFile);
    });

    afterEach(() => {
        destroyTempDir(tmpDir);
        delete process.env.WALLPAPERS_DIR_TEST;
    });

    describe('getImageIdFromUrl', () => {
        test('returns the filename stem for .jpg URLs', () => {
            const url = 'https://scontent.xx.fbcdn.net/v/t39.30808-6/12345_67890_abcdefg_n.jpg?_nc_cat=1';
            assert.strictEqual(db.getImageIdFromUrl(url), '12345_67890_abcdefg_n');
        });

        test('returns the filename stem for .png URLs', () => {
            const url = 'https://scontent.xx.fbcdn.net/v/t39.30808-6/12345_67890_abcdefg_n.png';
            assert.strictEqual(db.getImageIdFromUrl(url), '12345_67890_abcdefg_n');
        });

        test('returns a deterministic hash for URLs without a recognizable filename', () => {
            const url = 'https://example.com/resource/unknown';
            const id1 = db.getImageIdFromUrl(url);
            const id2 = db.getImageIdFromUrl(url);
            // Deterministic: same input → same ID
            assert.strictEqual(id1, id2);
            // Hashed fallback prefix
            assert.ok(id1.startsWith('sb_'));
        });

        test('does not throw when filename is missing (regression: precedence bug)', () => {
            // A URL whose path ends in "/" — filename would be empty string.
            const url = 'https://scontent.xx.fbcdn.net/v/';
            assert.doesNotThrow(() => db.getImageIdFromUrl(url));
            const id = db.getImageIdFromUrl(url);
            assert.ok(id.startsWith('sb_'));
        });
    });

    describe('parseCategoryInput', () => {
        test('parses bare slug', () => {
            const c = db.parseCategoryInput('pooja-hegde');
            assert.deepStrictEqual(c, {
                id: 'pooja-hegde',
                name: 'Pooja Hegde',
                url: 'https://santabanta.com/wallpapers/indian-celebrities-f/pooja-hegde/'
            });
        });

        test('parses /slug/ URL', () => {
            const c = db.parseCategoryInput('https://santabanta.com/wallpapers/indian-celebrities-f/pooja-hegde/');
            assert.strictEqual(c.id, 'pooja-hegde');
            assert.ok(c.url.includes('/indian-celebrities-f/'));
        });
    });

    describe('addScrapedImages', () => {
        test('adds images and deduplicates by URL', () => {
            const urlA = 'https://scontent.xx.fbcdn.net/v/t39.30808-6/1111_abcd_n.jpg';
            const urlB = 'https://scontent.xx.fbcdn.net/v/t39.30808-6/2222_efgh_n.jpg';

            const first = db.addScrapedImages('pooja-hegde', 'https://santabanta.com/wallpapers/indian-celebrities-f/pooja-hegde/', [urlA, urlB]);
            assert.strictEqual(first.addedCount, 2);

            // Re-adding the same URLs adds nothing
            const second = db.addScrapedImages('pooja-hegde', 'https://santabanta.com/wallpapers/indian-celebrities-f/pooja-hegde/', [urlA, urlB]);
            assert.strictEqual(second.addedCount, 0);
            assert.strictEqual(second.total, 2);

            // Adding a new URL increases only by 1
            const urlC = 'https://scontent.xx.fbcdn.net/v/t39.30808-6/3333_ijkl_n.jpg';
            const third = db.addScrapedImages('pooja-hegde', 'https://santabanta.com/wallpapers/indian-celebrities-f/pooja-hegde/', [urlC]);
            assert.strictEqual(third.addedCount, 1);
            assert.strictEqual(third.total, 3);
        });
    });

    describe('getNextUnusedWallpaper & markWallpaperUsed', () => {
        test('selects unused images then cycles back after all used', () => {
            // Create categories.txt with two categories
            fs.writeFileSync(categoriesFile, [
                'https://santabanta.com/wallpapers/indian-celebrities-f/pooja-hegde/',
                'https://santabanta.com/wallpapers/bollywood-movies/pathaan/'
            ].join('\n') + '\n', 'utf8');

            const urlA = 'https://scontent.xx.fbcdn.net/v/t39.30808-6/1111_abcd_n.jpg';
            const urlB = 'https://scontent.xx.fbcdn.net/v/t39.30808-6/2222_efgh_n.jpg';
            db.addScrapedImages('pooja-hegde', 'https://santabanta.com/wallpapers/indian-celebrities-f/pooja-hegde/', [urlA]);
            db.addScrapedImages('pathaan', 'https://santabanta.com/wallpapers/bollywood-movies/pathaan/', [urlB]);

            const first = db.getNextUnusedWallpaper();
            assert.strictEqual(first.categoryId, 'pooja-hegde');
            assert.strictEqual(first.image.url, urlA);
            db.markWallpaperUsed('pooja-hegde', first.image.id, '/tmp/dummy.jpg');

            const second = db.getNextUnusedWallpaper();
            assert.strictEqual(second.categoryId, 'pathaan');
            assert.strictEqual(second.image.url, urlB);
            db.markWallpaperUsed('pathaan', second.image.id, '/tmp/dummy2.jpg');

            // All used → should reset & return first image again
            const third = db.getNextUnusedWallpaper();
            assert.strictEqual(third.categoryId, 'pooja-hegde');
            assert.strictEqual(third.image.url, urlA);
        });

        test('returns null when no categories configured', () => {
            fs.writeFileSync(categoriesFile, '# empty\n', 'utf8');
            assert.strictEqual(db.getNextUnusedWallpaper(), null);
        });
    });

    describe('needsRescrape', () => {
        test('returns true for a newly created / empty category', () => {
            assert.strictEqual(db.needsRescrape('nobody'), true);
        });

        test('returns false when unused images exist', () => {
            db.addScrapedImages('pooja-hegde', 'https://santabanta.com/wallpapers/indian-celebrities-f/pooja-hegde/', [
                'https://scontent.xx.fbcdn.net/v/t39.30808-6/1111_abcd_n.jpg'
            ]);
            assert.strictEqual(db.needsRescrape('pooja-hegde'), false);
        });

        test('returns false when all used but less than RE_SCRAPE_DAYS passed', () => {
            db.addScrapedImages('pooja-hegde', 'https://santabanta.com/wallpapers/bollywood-movies/pathaan/', [
                'https://scontent.xx.fbcdn.net/v/t39.30808-6/1111_abcd_n.jpg'
            ]);
            const sel = db.getNextUnusedWallpaper('pooja-hegde');
            db.markWallpaperUsed('pooja-hegde', sel.image.id, '/tmp/dummy.jpg');

            // last_scraped_at is "now", so days since = 0 < RE_SCRAPE_DAYS
            assert.strictEqual(db.needsRescrape('pooja-hegde'), false);
        });

        test('returns true when all used and RE_SCRAPE_DAYS have passed', () => {
            db.addScrapedImages('pooja-hegde', 'https://santabanta.com/wallpapers/indian-celebrities-f/pooja-hegde/photos', [
                'https://scontent.xx.fbcdn.net/v/t39.30808-6/1111_abcd_n.jpg'
            ]);
            const sel = db.getNextUnusedWallpaper('pooja-hegde');
            db.markWallpaperUsed('pooja-hegde', sel.image.id, '/tmp/dummy.jpg');

            // Force last_scraped_at back 8 days
            const currentDb = db.loadDb();
            currentDb.categories['pooja-hegde'].last_scraped_at = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
            db.saveDb(currentDb);

            assert.strictEqual(db.needsRescrape('pooja-hegde'), true);
        });

        test('force flag always returns true', () => {
            assert.strictEqual(db.needsRescrape('pooja-hegde', true), true);
        });
    });
});