const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { AuthManager } = require('../auth');

function makeTempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'wallpaper-auth-test-'));
}

function destroyTempDir(dir) {
    try {
        fs.rmSync(dir, { recursive: true, force: true });
    } catch (e) {}
}

describe('AuthManager cookie expiry', () => {
    let tmpDir;
    let cookiesFile;
    let auth;

    beforeEach(() => {
        tmpDir = makeTempDir();
        cookiesFile = path.join(tmpDir, 'cookies.json');
        auth = new AuthManager(cookiesFile);
    });

    afterEach(() => {
        destroyTempDir(tmpDir);
    });

    function writeCookies(cookies) {
        fs.writeFileSync(cookiesFile, JSON.stringify(cookies), 'utf8');
    }

    test('hasCookies() is false when file is missing', () => {
        assert.strictEqual(auth.hasCookies(), false);
    });

    test('cookiesStatus() reports missing when no cookies exist', () => {
        const status = auth.cookiesStatus();
        assert.strictEqual(status.state, 'missing');
    });

    test('session-only cookies (no expiry) are treated as valid', () => {
        writeCookies([
            { name: 'c_user', value: '12345' },
            { name: 'xs', value: 'abc' }
        ]);
        assert.strictEqual(auth.hasCookies(), true);
        assert.strictEqual(auth.cookiesExpireAt(), null);
        assert.strictEqual(auth.cookiesValid(), true);
        const status = auth.cookiesStatus();
        assert.strictEqual(status.state, 'ok');
        assert.ok(status.message.includes('session'));
    });

    test('dated session cookie in the future reports valid with expiry', () => {
        const futureTs = Math.floor(Date.now() / 1000) + 10 * 24 * 60 * 60; // ~10 days
        writeCookies([
            { name: 'c_user', value: '12345' },
            { name: 'xs', value: 'abc', expires: futureTs }
        ]);
        const expireAt = auth.cookiesExpireAt();
        assert.ok(expireAt !== null);
        assert.ok(expireAt > Date.now());
        assert.strictEqual(auth.cookiesValid(), true);
        const status = auth.cookiesStatus();
        assert.strictEqual(status.state, 'ok');
        assert.ok(status.message.includes('expires'));
    });

    test('expired session cookie reports invalid / expired', () => {
        const pastTs = Math.floor(Date.now() / 1000) - 24 * 60 * 60; // 1 day ago
        writeCookies([
            { name: 'c_user', value: '12345' },
            { name: 'xs', value: 'abc', expires: pastTs }
        ]);
        assert.strictEqual(auth.cookiesValid(), false);
        const status = auth.cookiesStatus();
        assert.strictEqual(status.state, 'expired');
        assert.ok(status.message.includes('Expired'));
    });

    test('non-session cookies with expiry are ignored', () => {
        const pastTs = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
        writeCookies([
            { name: 'sb', value: '123', expires: pastTs },
            { name: 'fr', value: '456' }
        ]);
        // 'sb' & 'fr' are both in SESSION_COOKIES, so this should be expired.
        assert.strictEqual(auth.cookiesValid(), false);

        // A cookie NOT in SESSION_COOKIES with an expiry should be ignored.
        writeCookies([
            { name: 'wd', value: '123', expires: pastTs }
        ]);
        assert.strictEqual(auth.cookiesExpireAt(), null);
        assert.strictEqual(auth.cookiesValid(), true);
    });

    test('invalid JSON is treated as no cookies', () => {
        fs.writeFileSync(cookiesFile, 'not json', 'utf8');
        assert.strictEqual(auth.hasCookies(), false);
        assert.strictEqual(auth.cookiesValid(), false);
    });

    test('cookiesExpireAt returns earliest expiry among session cookies', () => {
        const tsA = Math.floor(Date.now() / 1000) + 5 * 24 * 60 * 60;
        const tsB = Math.floor(Date.now() / 1000) + 2 * 24 * 60 * 60;
        writeCookies([
            { name: 'c_user', value: '1', expires: tsA },
            { name: 'xs', value: '2', expires: tsB }
        ]);
        const expireAt = auth.cookiesExpireAt();
        // Earliest = tsB
        assert.ok(Math.abs(expireAt - tsB * 1000) < 2000);
    });
});