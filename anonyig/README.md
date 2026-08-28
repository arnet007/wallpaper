# Instagram Desktop Wallpaper Changer (AnonyIG) 📸

High-resolution desktop wallpaper changer for Instagram profiles powered by **AnonyIG** (`https://anonyig.com/en1/iganony/`).

Fetches public Instagram profiles anonymously without requiring login credentials, extracts full-resolution photos & carousels (1080p+), generates aesthetic widescreen blurred side-fills for portrait photos, overlays a frosted glass Instagram badge in the top-right corner, and sets your Windows desktop wallpaper automatically.

---

## 📁 Project Structure

```text
C:\Users\sumit\projects\wallpaper\anonyig\
│
├── wallpaper.js            # Main CLI & Wallpaper Orchestrator
├── scraper.js              # AnonyIG Puppeteer network & DOM scraper
├── db.js                   # JSON tracking database & 7-day cycle manager
├── image_processor.js      # Portrait blur side-fills & Instagram SVG badge overlay
├── config.js               # Paths, timeouts, and scraper settings
├── profiles.txt            # Target Instagram profiles list (editable)
├── set_wallpaper.ps1       # Win32 SPI_SETDESKWALLPAPER native wallpaper setter
├── run_wallpaper.bat       # Quick double-clickable launcher
├── run_silent.vbs          # Invisible execution for right-click context menu
├── run_visible.vbs         # Visible console runner for status & rescrape
├── wallpapers/             # Cache directory where active wallpaper is stored (auto-cleaned)
├── wallpapers_db.json      # Persistent tracking database
└── test/                   # Comprehensive unit tests
    └── anonyig.test.js
```

---

## 🚀 Usage

### 1. Cycle Through Configured Profiles
Rotates through profiles in `profiles.txt` (or picks an unused photo from the active profile):
```powershell
cd C:\Users\sumit\projects\wallpaper\anonyig
node wallpaper.js
```
*(Or double-click `run_wallpaper.bat`)*

### 2. Target a Specific Instagram Profile
Pass any Instagram username or profile URL:
```powershell
node wallpaper.js aliaabhatt
node wallpaper.js shraddhakapoor
node wallpaper.js https://www.instagram.com/dishapatani/
node wallpaper.js @kritisanon
```

### 3. Check Statistics
View pool counts, unused wallpapers, and last scraped timestamps:
```powershell
node wallpaper.js --status
```

### 4. Force a Fresh Re-scrape
Force refresh the image pool from AnonyIG:
```powershell
node wallpaper.js aliaabhatt --force-scrape
node wallpaper.js -f
```

### 5. Include Active Stories
Fetch and include active Instagram stories in the wallpaper candidate pool:
```powershell
node wallpaper.js aliaabhatt --stories
```

### 6. Reset Used Wallpaper Cycle
Reset the cycle to re-use previously applied wallpapers:
```powershell
node wallpaper.js --reset aliaabhatt
node wallpaper.js --reset
```

---

## 🎨 Aesthetic Image Processing

- **Portrait Aspect Ratio Detection**: Automatically detects vertical / 4:5 / 9:16 portrait photos.
- **Widescreen Gaussian Blur Side-Fills**: Renders a 16:9 widescreen canvas (`1920x1080` or primary monitor resolution) with heavy background blur (`blur(35)`, brightness `0.82`) and centers the sharp uncropped portrait photo.
- **Frosted Glass Vector Badge**: Dynamically overlays a pill badge in the top-right corner with the official Instagram gradient camera icon and `@username`.

---

## ⚙️ Configuration (`config.js` & `profiles.txt`)

- **Add More Profiles**: Edit `profiles.txt` with your favorite Instagram creators, artists, or celebrities (one username or profile URL per line).
- **Auto-Cleanup**: Only the currently active wallpaper is preserved in `wallpapers/`; older cached images are purged automatically.
