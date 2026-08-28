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

    ANONYIG_URL: 'https://anonyig.com/en1/iganony/',
    CHROME_PATH: findChromeExecutable(),
    CHROME_TEMP_DIR: path.join(__dirname, '.chrome-temp'),

    PAGE_TIMEOUT_MS: 45000,
    API_WAIT_TIMEOUT_MS: 20000,
    MIN_IMAGE_SIZE_BYTES: 20480, // 20 KB minimum for valid image
    RE_SCRAPE_DAYS: 7, // Re-scrape if all images used or after 7 days
    USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

module.exports = config;
