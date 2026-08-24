const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const COOKIES_FILE = path.join(__dirname, 'cookies.json');

const SESSION_COOKIES = ['c_user', 'xs', 'fr', 'datr', 'sb'];

class AuthManager {
    constructor(cookiesFile = COOKIES_FILE) {
        this.cookiesFile = cookiesFile;
    }

    hasCookies() {
        if (!fs.existsSync(this.cookiesFile)) return false;
        try {
            const data = fs.readFileSync(this.cookiesFile, 'utf8');
            const parsed = JSON.parse(data);
            return Array.isArray(parsed) && parsed.length > 0;
        } catch (e) {
            return false;
        }
    }

    loadCookies() {
        if (!this.hasCookies()) return [];
        try {
            return JSON.parse(fs.readFileSync(this.cookiesFile, 'utf8'));
        } catch (e) {
            console.error('[Auth] Error reading cookies.json:', e.message);
            return [];
        }
    }

    saveCookies(cookies) {
        fs.writeFileSync(this.cookiesFile, JSON.stringify(cookies, null, 2), 'utf8');
        console.log(`[Auth] Saved ${cookies.length} cookies to ${this.cookiesFile}`);
    }

    /**
     * Returns the earliest expiration timestamp (ms) among auth-relevant cookies,
     * or null if there are no dated cookies (all session-only).
     */
    cookiesExpireAt() {
        const cookies = this.loadCookies();
        if (!Array.isArray(cookies) || cookies.length === 0) return null;

        let earliest = null;
        for (const c of cookies) {
            if (SESSION_COOKIES.includes(c.name) && c.expires && c.expires > 0) {
                const expiresMs = c.expires * 1000;
                if (earliest === null || expiresMs < earliest) {
                    earliest = expiresMs;
                }
            }
        }
        return earliest;
    }

    /**
     * Returns true if cookies exist and none of the dated auth cookies have expired.
     * Session-only cookies (no expiry) are treated as valid.
     */
    cookiesValid() {
        if (!this.hasCookies()) return false;
        const expireAt = this.cookiesExpireAt();
        if (expireAt === null) return true; // All session cookies, still valid
        return expireAt > Date.now();
    }

    /**
     * Human-readable cookie status for --status output.
     * @returns {{ state: 'ok'|'expired'|'missing', message: string }}
     */
    cookiesStatus() {
        if (!this.hasCookies()) {
            return { state: 'missing', message: 'No (Run --login once)' };
        }
        const expireAt = this.cookiesExpireAt();
        if (expireAt === null) {
            return { state: 'ok', message: 'Yes (session cookies, no expiry)' };
        }
        if (expireAt <= Date.now()) {
            return { state: 'expired', message: `Expired (${new Date(expireAt).toLocaleString()}). Run --login to refresh.` };
        }
        const daysLeft = Math.ceil((expireAt - Date.now()) / (1000 * 60 * 60 * 24));
        return { state: 'ok', message: `Yes (expires in ~${daysLeft} day(s))` };
    }

    /**
     * One-time interactive login to capture Facebook cookies
     */
    async loginOneTime() {
        console.log('\n================================================================');
        console.log('         FACEBOOK ONE-TIME LOGIN (COOKIE STORAGE)               ');
        console.log('================================================================');
        console.log('Opening Chrome window for Facebook login...');
        console.log('Please log into your Facebook account in the opened window.');
        console.log('Your cookies will be saved to cookies.json for all future runs.\n');

        const tempDir = path.join(__dirname, '.chrome-temp-login');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const browser = await puppeteer.launch({
            executablePath: config.CHROME_PATH,
            userDataDir: tempDir,
            headless: false,
            defaultViewport: null,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized']
        });

        try {
            const page = await browser.newPage();
            await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2' });

            console.log('[Auth] Waiting for Facebook login... (Please enter credentials in the browser)');

            // Poll for c_user cookie or successful navigation away from login
            let loggedIn = false;
            const startTime = Date.now();
            const maxWaitMs = 180000; // 3 minutes

            while (Date.now() - startTime < maxWaitMs) {
                const cookies = await page.cookies();
                const hasUserCookie = cookies.some(c => c.name === 'c_user' || c.name === 'xs');
                const currentUrl = page.url();

                if (hasUserCookie && !currentUrl.includes('/login') && !currentUrl.includes('login.php')) {
                    loggedIn = true;
                    console.log('\n[Auth] Login successful! Capturing cookies...');
                    this.saveCookies(cookies);
                    break;
                }

                await new Promise(r => setTimeout(r, 2000));
            }

            if (!loggedIn) {
                console.warn('[Auth] Login timed out or not completed.');
            } else {
                console.log('================================================================');
                console.log('[OK] One-time login complete! cookies.json created.');
                console.log('[OK] No Chrome Developer Mode / port 9222 needed anymore.');
                console.log('================================================================\n');
            }

            return loggedIn;
        } finally {
            await browser.close().catch(() => {});
            // Clean up temp login profile
            try {
                fs.rmSync(tempDir, { recursive: true, force: true });
            } catch (e) {}
        }
    }
}

module.exports = new AuthManager();
module.exports.AuthManager = AuthManager;
module.exports.SESSION_COOKIES = SESSION_COOKIES;
