# Facebook Desktop Wallpaper Changer 🖼️

Automatically scrape high-resolution photos from Facebook profiles, store them in a local JSON database, cycle through them as your Windows desktop wallpaper, and re-scrape automatically every 7 days.

---

## 🌟 Key Features

- **No Chrome Developer Mode Required**: Runs a simple **one-time login** to save `cookies.json`. After that, your normal Chrome browser can stay open without any port conflicts or locks!
- **Direct Pattern Extraction**: Does **NOT** visit or click each photo individually. Scrapes large, uncropped master images directly from the `/photos` stream matching full-resolution patterns (`dst-jpg_tt6`, `cstp=mx1080x1350`, `s2048x2048`).
- **Profile Management (`profiles.txt`)**: Support for Facebook usernames (`rajnandinideyrj`), full photo URLs (`https://www.facebook.com/rajnandinideyrj/photos`), or profile IDs.
- **Smart JSON Database (`wallpapers_db.json`)**:
  - Tracks every scraped image URL with unique IDs and timestamps.
  - Keeps history of applied wallpapers.
  - Ensures no image is reused until all wallpapers have been used.
- **7-Day Auto Re-scrape**:
  - Automatically re-scrapes the profile photos when all wallpapers have been used or when 7 days have passed.
  - Deduplicates new uploads while preserving previous usage history.
- **Windows Desktop API**: Instantly sets your wallpaper via high-performance Win32 API.

---

## 📁 Project Structure

```text
C:\Users\sumit\projects\wallpaper\
│
├── profiles.txt            # List of Facebook profiles to scrape from
├── install_context_menu.bat# 🖱️ Install Right-Click Desktop Context Menu
├── uninstall_context_menu.bat# 🖱️ Uninstall Right-Click Desktop Context Menu
├── login.bat               # One-time login to save cookies.json
├── run_wallpaper.bat       # Double-click launcher to cycle wallpaper
├── wallpaper.js            # Main script (Scrapes, downloads, applies wallpaper, updates DB)
├── scraper.js              # Pattern-based scraper using stored cookies
├── auth.js                 # Authentication & cookies.json manager
├── db.js                   # JSON database manager (tracks used wallpapers, 7-day checks)
├── config.js               # Paths and configuration settings
├── set_wallpaper.ps1       # Native Windows PowerShell wallpaper setter
├── run_silent.vbs          # Silent background execution runner for Context Menu
├── cookies.json            # Stored session cookies (created after one-time login)
├── santabanta/             # SantaBanta wallpaper project & Universal Random Changer
├── wallpapers/             # Directory where downloaded full-res wallpapers are stored
└── wallpapers_db.json      # JSON database tracking photos and usage status
```

---

## 🚀 Quick Setup & Usage

### Step 1: One-Time Login Setup (Store Cookies)
Run the one-time login activity to save your Facebook cookies:
```powershell
node wallpaper.js --login
```
*(Or double-click **`login.bat`**)*

Log into your Facebook account in the opened window. Once logged in, your session is saved to `cookies.json`, and you're done!

---

### Step 2: Configure Profiles in `profiles.txt`
Add Facebook profiles or photo URLs to `profiles.txt` (one per line):
```text
https://www.facebook.com/rajnandinideyrj/photos
```

---

### Step 3: Run the Wallpaper Changer
Change to a new wallpaper anytime:
```powershell
node wallpaper.js
```
*(Or double-click **`run_wallpaper.bat`**)*

To do a fresh high-resolution scrape:
```powershell
node wallpaper.js --force-scrape
```

---

## ⚙️ CLI Commands

| Command | Description |
| :--- | :--- |
| `node wallpaper.js` | Changes wallpaper to next unused high-resolution image |
| `node wallpaper.js --login` | Performs the one-time login activity to save `cookies.json` |
| `node wallpaper.js --force-scrape` | Scrapes fresh high-resolution photos using URL pattern extraction |
| `node wallpaper.js --status` | Shows status of profiles, stored cookies, and photos count |
| `node wallpaper.js --reset` | Resets all photos back to "unused" state |
| `node wallpaper.js --restore` | Restores desktop wallpaper to the latest downloaded image |
| `node wallpaper.js --scrolls 15` | Sets the number of scroll cycles (default: 12) |
