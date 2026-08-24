const path = require('path');
const fs = require('fs');

function findChromeExecutable() {
    const localAppData = process.env.LOCALAPPDATA || '';
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

    const candidates = [
        path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ];

    for (const p of candidates) {
        if (fs.existsSync(p)) {
            return p;
        }
    }
    return 'chrome.exe';
}

const config = {
    PROJECT_DIR: __dirname,
    WALLPAPERS_DIR: path.join(__dirname, 'wallpapers'),
    DB_FILE: path.join(__dirname, 'wallpapers_db.json'),
    PROFILES_FILE: path.join(__dirname, 'profiles.txt'),
    SET_WALLPAPER_SCRIPT: path.join(__dirname, 'set_wallpaper.ps1'),
    
    CHROME_PATH: findChromeExecutable(),
    CHROME_USER_DATA_DIR: path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data'),
    CHROME_PROFILE: 'Default',
    CHROME_DEBUG_PORT: 9222,
    CHROME_DEBUG_URL: 'http://127.0.0.1:9222',
    SESSION_DIR: path.join(__dirname, '.chrome-session'),

    // Scraping settings
    MAX_SCROLLS: 12,
    SCROLL_DELAY_MS: 1500,
    PAGE_TIMEOUT_MS: 45000,
    RE_SCRAPE_DAYS: 7, // Re-scrape if all used or after 7 days
};

module.exports = config;
