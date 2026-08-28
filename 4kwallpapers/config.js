const path = require('path');

const config = {
    PROJECT_DIR: __dirname,
    WALLPAPERS_DIR: path.join(__dirname, 'wallpapers'),
    DB_FILE: path.join(__dirname, 'wallpapers_db.json'),
    SET_WALLPAPER_SCRIPT: path.join(__dirname, 'set_wallpaper.ps1'),

    CATEGORY_URL: 'https://4kwallpapers.com/nature/',
    SITE_ROOT: 'https://4kwallpapers.com',
    USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',

    // Scraping settings
    PAGE_TIMEOUT_MS: 25000,
    MIN_IMAGE_SIZE_BYTES: 50000,
};

module.exports = config;
