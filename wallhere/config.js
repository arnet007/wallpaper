const path = require('path');
require('dotenv').config();

module.exports = {
  // Directories
  WALLPAPERS_DIR: path.join(__dirname, 'wallpapers'),
  DB_DIR: path.join(__dirname, 'db'),

  // Site URLs
  SITE_ROOT: 'https://wallhere.com',
  RANDOM_URL: 'https://wallhere.com/en/random',

  // Network & Scraper settings
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  PAGE_TIMEOUT_MS: 15000,
  DOWNLOAD_TIMEOUT_MS: 45000,

  // Minimum image size in bytes (50 KB to filter out thumbnails)
  MIN_IMAGE_SIZE_BYTES: 50000,

  // Retention: number of recent processed wallpapers to keep in the wallpapers folder
  KEEP_WALLPAPERS_COUNT: 2,

  // PowerShell script to set wallpaper
  SET_WALLPAPER_SCRIPT: path.join(__dirname, 'set_wallpaper.ps1'),

  // Optional vector badge in the top-right corner
  BADGE_ENABLED: false,
};