const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const WallpaperDb = require('../db');

let tmpDir;
let dbFile;

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fourk-db-'));
    dbFile = path.join(tmpDir, 'db.json');
    // Point WALLPAPERS_DIR at the temp dir so initDb doesn't create real folders
    const config = require('../config');
    config.WALLPAPERS_DIR = tmpDir;
});

test('initDb creates an empty database on first use', () => {
    const db = new WallpaperDb(dbFile);
    const data = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    assert.deepStrictEqual(data.used_urls, []);
    assert.deepStrictEqual(data.history, []);
    assert.ok(data.created_at);
    void db;
});

test('record appends to used_urls and history', () => {
    const db = new WallpaperDb(dbFile);
    db.record({ title: 'A', url: 'u1', applied_at: 't1' });
    db.record({ title: 'B', url: 'u2', applied_at: 't2' });

    const data = db.load();
    assert.deepStrictEqual(data.used_urls, ['u1', 'u2']);
    assert.strictEqual(data.history.length, 2);
    assert.strictEqual(data.history[1].title, 'B');
});

test('isUsed detects previously recorded URLs', () => {
    const db = new WallpaperDb(dbFile);
    db.record({ title: 'A', url: 'u1', applied_at: 't1' });
    assert.strictEqual(db.isUsed('u1'), true);
    assert.strictEqual(db.isUsed('u2'), false);
});

test('reset clears the used pool but keeps history', () => {
    const db = new WallpaperDb(dbFile);
    db.record({ title: 'A', url: 'u1', applied_at: 't1' });
    db.reset();
    assert.strictEqual(db.load().used_urls.length, 0);
    assert.strictEqual(db.load().history.length, 1);
});

test('used pool is bounded by MAX_USED_URLS', () => {
    const db = new WallpaperDb(dbFile);
    for (let i = 0; i < WallpaperDb.MAX_USED_URLS + 10; i++) {
        db.record({ title: `T${i}`, url: `u${i}`, applied_at: 't' });
    }
    const data = db.load();
    assert.ok(data.used_urls.length <= WallpaperDb.MAX_USED_URLS);
    assert.strictEqual(data.history.length, WallpaperDb.MAX_USED_URLS + 10);
});

test('load recovers from a corrupt database file', () => {
    fs.writeFileSync(dbFile, '{ not valid json', 'utf8');
    const db = new WallpaperDb(dbFile);
    const data = db.load();
    assert.deepStrictEqual(data.used_urls, []);
});
