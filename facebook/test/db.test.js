const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { WallpaperDatabase } = require('../db');

function makeTempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'wallpaper-db-test-'));
}

function destroyTempDir(dir) {
    try {
        fs.rmSync(dir, { recursive: true, force: true });
    } catch (e) {}
}

describe('WallpaperDatabase', () => {
    let tmpDir;
    let dbFile;
    let profilesFile;
    let db;

    beforeEach(() => {
        tmpDir = makeTempDir();
        dbFile = path.join(tmpDir, 'wallpapers_db.json');
        profilesFile = path.join(tmpDir, 'profiles.txt');
        // Give the DB its own wallpapers directory (config.WALLPAPERS_DIR is
        // global, but init() only creates it if missing — use the temp dir).
        process.env.WALLPAPERS_DIR_TEST = tmpDir;
        db = new WallpaperDatabase(dbFile, profilesFile);
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
            assert.ok(id1.startsWith('img_'));
        });

        test('does not throw when filename is missing (regression: operator precedence bug)', () => {
            // A URL whose path ends in "/" — filename would be empty string.
            const url = 'https://scontent.xx.fbcdn.net/v/';
            assert.doesNotThrow(() => db.getImageIdFromUrl(url));
            const id = db.getImageIdFromUrl(url);
            assert.ok(id.startsWith('img_'));
        });
    });

    describe('parseProfileInput', () => {
        test('parses bare username', () => {
            const p = db.parseProfileInput('rajnandinideyrj');
            assert.deepStrictEqual(p, {
                id: 'rajnandinideyrj',
                name: 'rajnandinideyrj',
                url: 'https://www.facebook.com/rajnandinideyrj',
                photosUrl: 'https://www.facebook.com/rajnandinideyrj/photos'
            });
        });

        test('parses /username/photos URL', () => {
            const p = db.parseProfileInput('https://www.facebook.com/rajnandinideyrj/photos');
            assert.strictEqual(p.id, 'rajnandinideyrj');
            assert.strictEqual(p.photosUrl, 'https://www.facebook.com/rajnandinideyrj/photos');
        });

        test('parses profile.php?id= URL', () => {
            const p = db.parseProfileInput('https://www.facebook.com/profile.php?id=100012345678');
            assert.strictEqual(p.id, 'profile_100012345678');
            assert.ok(p.photosUrl.includes('sk=photos'));
        });
    });

    describe('addScrapedImages', () => {
        test('adds images and deduplicates by URL', () => {
            const urlA = 'https://scontent.xx.fbcdn.net/v/t39.30808-6/1111_abcd_n.jpg';
            const urlB = 'https://scontent.xx.fbcdn.net/v/t39.30808-6/2222_efgh_n.jpg';

            const first = db.addScrapedImages('rajnandinideyrj', 'https://www.facebook.com/rajnandinideyrj/photos', [urlA, urlB]);
            assert.strictEqual(first.addedCount, 2);

            // Re-adding the same URLs adds nothing
            const second = db.addScrapedImages('rajnandinideyrj', 'https://www.facebook.com/rajnandinideyrj/photos', [urlA, urlB]);
            assert.strictEqual(second.addedCount, 0);
            assert.strictEqual(second.total, 2);

            // Adding a new URL increases only by 1
            const urlC = 'https://scontent.xx.fbcdn.net/v/t39.30808-6/3333_ijkl_n.jpg';
            const third = db.addScrapedImages('rajnandinideyrj', 'https://www.facebook.com/rajnandinideyrj/photos', [urlC]);
            assert.strictEqual(third.addedCount, 1);
            assert.strictEqual(third.total, 3);
        });
    });

    describe('getNextUnusedWallpaper & markWallpaperUsed', () => {
        test('selects unused images then cycles back after all used', () => {
            // Create profiles.txt with two profiles
            fs.writeFileSync(profilesFile, [
                'https://www.facebook.com/rajnandinideyrj/photos',
                'https://www.facebook.com/jyotshnapanda.bulbul/photos'
            ].join('\n') + '\n', 'utf8');

            const urlA = 'https://scontent.xx.fbcdn.net/v/t39.30808-6/1111_abcd_n.jpg';
            const urlB = 'https://scontent.xx.fbcdn.net/v/t39.30808-6/2222_efgh_n.jpg';
            db.addScrapedImages('rajnandinideyrj', 'https://www.facebook.com/rajnandinideyrj/photos', [urlA]);
            db.addScrapedImages('jyotshnapanda.bulbul', 'https://www.facebook.com/jyotshnapanda.bulbul/photos', [urlB]);

            const first = db.getNextUnusedWallpaper();
            assert.strictEqual(first.profileId, 'rajnandinideyrj');
            assert.strictEqual(first.image.url, urlA);
            db.markWallpaperUsed('rajnandinideyrj', first.image.id, '/tmp/dummy.jpg');

            const second = db.getNextUnusedWallpaper();
            assert.strictEqual(second.profileId, 'jyotshnapanda.bulbul');
            assert.strictEqual(second.image.url, urlB);
            db.markWallpaperUsed('jyotshnapanda.bulbul', second.image.id, '/tmp/dummy2.jpg');

            // All used → should reset & return first image again
            const third = db.getNextUnusedWallpaper();
            assert.strictEqual(third.profileId, 'rajnandinideyrj');
            assert.strictEqual(third.image.url, urlA);
        });

        test('returns null when no profiles configured', () => {
            fs.writeFileSync(profilesFile, '# empty\n', 'utf8');
            assert.strictEqual(db.getNextUnusedWallpaper(), null);
        });
    });

    describe('needsRescrape', () => {
        test('returns true for a newly created / empty profile', () => {
            assert.strictEqual(db.needsRescrape('nobody'), true);
        });

        test('returns false when unused images exist', () => {
            db.addScrapedImages('rajnandinideyrj', 'https://www.facebook.com/rajnandinideyrj/photos', [
                'https://scontent.xx.fbcdn.net/v/t39.30808-6/1111_abcd_n.jpg'
            ]);
            assert.strictEqual(db.needsRescrape('rajnandinideyrj'), false);
        });

        test('returns false when all used but less than RE_SCRAPE_DAYS passed', () => {
            db.addScrapedImages('rajnandinideyrj', 'https://www.facebook.com/rajnandinideyrj/photos', [
                'https://scontent.xx.fbcdn.net/v/t39.30808-6/1111_abcd_n.jpg'
            ]);
            const sel = db.getNextUnusedWallpaper('rajnandinideyrj');
            db.markWallpaperUsed('rajnandinideyrj', sel.image.id, '/tmp/dummy.jpg');

            // last_scraped_at is "now", so days since = 0 < RE_SCRAPE_DAYS
            assert.strictEqual(db.needsRescrape('rajnandinideyrj'), false);
        });

        test('returns true when all used and RE_SCRAPE_DAYS have passed', () => {
            db.addScrapedImages('rajnandinideyrj', 'https://www.facebook.com/rajnandinideyrj/photos', [
                'https://scontent.xx.fbcdn.net/v/t39.30808-6/1111_abcd_n.jpg'
            ]);
            const sel = db.getNextUnusedWallpaper('rajnandinideyrj');
            db.markWallpaperUsed('rajnandinideyrj', sel.image.id, '/tmp/dummy.jpg');

            // Force last_scraped_at back 8 days
            const currentDb = db.loadDb();
            currentDb.profiles['rajnandinideyrj'].last_scraped_at = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
            db.saveDb(currentDb);

            assert.strictEqual(db.needsRescrape('rajnandinideyrj'), true);
        });

        test('force flag always returns true', () => {
            assert.strictEqual(db.needsRescrape('rajnandinideyrj', true), true);
        });
    });
});