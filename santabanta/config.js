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
    CATEGORIES_FILE: path.join(__dirname, 'categories.txt'),
    SET_WALLPAPER_SCRIPT: path.join(__dirname, 'set_wallpaper.ps1'),
    
    CHROME_PATH: findChromeExecutable(),
    BASE_URL: 'https://santabanta.com/wallpapers/',

    // Scraping settings
    MAX_SCROLLS: 8,
    SCROLL_DELAY_MS: 1500,
    PAGE_TIMEOUT_MS: 35000,
    RE_SCRAPE_DAYS: 7, // Re-scrape if all used or after 7 days
};

module.exports = config;
