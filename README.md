# 🖼️ Wallpaper Changer Suite

Turn your Windows desktop into an automatic wallpaper rotator using photos from **Instagram (AnonyIG)**, **Facebook profiles**, **SantaBanta galleries**, **4kwallpapers.com**, and **Wallhere.com**.

The repo contains five independent, self-contained projects:

| Project | Directory | What it does |
| :--- | :--- | :--- |
| **Instagram Wallpaper Changer** | [`anonyig/`](./anonyig) | Scrapes high-resolution photos and carousels anonymously from Instagram profiles via AnonyIG, adds aesthetic widescreen blur & Instagram badges, and rotates desktop wallpapers. |
| **Facebook Wallpaper Changer** | [`facebook/`](./facebook) | Scrapes high-resolution photos from Facebook profiles, cycles them as your wallpaper, and auto re-scrapes every 7 days. |
| **SantaBanta Wallpaper Changer** | [`santabanta/`](./santabanta) | Downloads full-HD wallpapers from SantaBanta — both targeted (celebrity/category) and universal random mode. |
| **4K Wallpapers Nature Changer** | [`4kwallpapers/`](./4kwallpapers) | Downloads a random true-4K wallpaper from the 4kwallpapers.com Nature category and sets it as your wallpaper. |
| **Wallhere Wallpaper Changer** | [`wallhere/`](./wallhere) | Fetches high-resolution wallpapers (random, topic search, popular) from Wallhere.com, formats with widescreen blur side-fills, and rotates desktop wallpapers. |

---

## 📁 Repository Structure

```text
wallpaper/
├── anonyig/                   # Instagram / AnonyIG project (self-contained)
│   ├── wallpaper.js           #   Main CLI (scrape, cycle, status, stories…)
│   ├── scraper.js             #   Puppeteer network & JSON feed scraper
│   ├── db.js                  #   JSON tracking database & cycle reset
│   ├── image_processor.js     #   sharp processing (blur side-fills + Instagram badge)
│   ├── profiles.txt           #   Target Instagram profiles list
│   ├── run_wallpaper.bat      #   Double-click launcher
│   ├── test/                  #   7 unit tests (node:test)
│   └── README.md
├── facebook/                  # Facebook project (self-contained)
│   ├── wallpaper.js           #   Main CLI (scrape, cycle, restore, status…)
│   ├── auth.js                #   One-time cookie login
│   ├── scraper.js             #   Puppeteer pattern-based Facebook scraper
│   ├── db.js                  #   JSON wallpaper database
│   ├── image_processor.js     #   sharp-based processing (blur fills + badge)
│   ├── login.bat              #   One-time login launcher
│   ├── run_wallpaper.bat      #   Double-click launcher
│   ├── test/                  #   23 unit tests (node:test)
│   └── README.md
├── santabanta/                # SantaBanta project (self-contained)
│   ├── universal.js           #   Universal random wallpaper changer
│   ├── wallpaper.js           #   Targeted category changer
│   ├── scraper.js / db.js / image_processor.js
│   ├── run_universal.bat      #   Random-mode launcher
│   ├── run_wallpaper.bat      #   Targeted-mode launcher
│   ├── test/                  #   14 unit tests (node:test)
│   └── README.md
├── 4kwallpapers/              # 4kwallpapers.com project (self-contained)
│   ├── wallpaper.js           #   Main CLI (random nature 4K download + set, status…)
│   ├── scraper.js / db.js / image_processor.js
│   ├── run_wallpaper.bat      #   Double-click launcher
│   ├── run_silent.vbs         #   Silent launcher (Task Scheduler)
│   ├── test/                  #   15 unit tests (node:test)
│   └── README.md
├── wallhere/                  # Wallhere.com project (self-contained)
│   ├── wallhere.js            #   Main CLI (random, search keyword, popular, status…)
│   ├── scraper.js             #   Axios/Cheerio scraper for Wallhere detail & master images
│   ├── db.js                  #   JSON tracking database
│   ├── image_processor_wallhere.js # sharp widescreen blur side-fills & cover scaling
│   ├── run_wallpaper.bat      #   Double-click launcher
│   ├── run_silent.vbs         #   Silent launcher (context menu / scheduler)
│   ├── run_visible.vbs        #   Visible console launcher (status)
│   └── README.md
├── install_context_menu.bat   # 🖱️ Install "Change Desktop Wallpaper" right-click menu
├── uninstall_context_menu.bat # 🖱️ Uninstall the right-click menu
└── .gitignore                 # Excludes cookies, wallpapers, node_modules, runtime DBs
```

---

## 🚀 Quick Start (Instagram / AnonyIG)

```powershell
cd anonyig

# 1. Rotate through configured profiles in profiles.txt
node wallpaper.js

# 2. Target a specific Instagram user or profile URL
node wallpaper.js aliaabhatt
node wallpaper.js https://www.instagram.com/shraddhakapoor/

# 3. View status / image counts
node wallpaper.js --status
```

See [`anonyig/README.md`](./anonyig/README.md) for details.

---

## 🚀 Quick Start (Facebook)

```powershell
# 1. One-time login (saves cookies.json — required for private profiles)
cd facebook
node wallpaper.js --login

# 2. Add profile URLs to facebook\profiles.txt (one per line)
#    e.g. https://www.facebook.com/yourprofile/photos

# 3. Set your next wallpaper
node wallpaper.js
```

See [`facebook/README.md`](./facebook/README.md) for the full command reference (`--force-scrape`, `--restore`, `--status`, `--reset`, `--scrolls`).

---

## 🚀 Quick Start (SantaBanta)

```powershell
# Universal random wallpaper (any category)
cd santabanta
node universal.js

# Random wallpaper from a specific category
node universal.js outdoors
node universal.js cars
node universal.js nature

# Targeted celebrity / category
node wallpaper.js pooja-hegde
```

See [`santabanta/README.md`](./santabanta/README.md) for details.

---

## 🚀 Quick Start (4kwallpapers.com)

```powershell
# Random 4K nature wallpaper from 4kwallpapers.com
cd 4kwallpapers
npm install        # one-time
node wallpaper.js

# Show stats (applied count, latest wallpaper)
node wallpaper.js --status
```

See [`4kwallpapers/README.md`](./4kwallpapers/README.md) for details.

---

## 🚀 Quick Start (Wallhere)

```powershell
# 1. Random high-resolution wallpaper
cd wallhere
npm install        # one-time
node wallhere.js

# 2. Search wallpapers by keyword/topic
node wallhere.js cyberpunk
node wallhere.js anime
node wallhere.js nature

# 3. Popular wallpapers
node wallhere.js --popular

# 4. View stats / cycle count
node wallhere.js --status
```

See [`wallhere/README.md`](./wallhere/README.md) for details.

---

## 🖱️ Right-Click Desktop Context Menu

Install a cascading "Change Desktop Wallpaper" menu on your desktop background:

```
double-click install_context_menu.bat
```

Menu structure:

```text
Change Desktop Wallpaper
├─ Next Instagram Wallpaper
├─ Instagram Status
├─ Re-scrape Instagram (AnonyIG)
├─ Open Instagram Wallpapers
├─ Edit Instagram Profiles (profiles.txt)
├─ Next Facebook Wallpaper
├─ Facebook Status
├─ Re-scrape Facebook (High-Res)
├─ Open Facebook Wallpapers
├─ Edit Facebook Profiles (profiles.txt)
├─ Next SantaBanta (Random)
├─ SantaBanta - Indian Celebrities (Female)
├─ SantaBanta - Bollywood / Cars / Nature / Outdoors
├─ SantaBanta Status
├─ Open SantaBanta Wallpapers
├─ Edit SantaBanta Categories (categories.txt)
├─ Next Wallhere Wallpaper (Random)
├─ Wallhere - Popular Wallpapers
├─ Wallhere Status
└─ Open Wallhere Wallpapers
```

> **Note:** Status & Re-scrape commands open a visible terminal window so you can read the output. Wallpaper actions run silently via `run_silent.vbs`.

Remove the menu anytime with `uninstall_context_menu.bat`.

---

## 🧪 Running Tests

All projects use Node's built-in test runner — no extra test frameworks needed.

```powershell
# Instagram project (7 tests)
npm test --prefix anonyig

# Facebook project (23 tests)
npm test --prefix facebook

# SantaBanta project (14 tests)
npm test --prefix santabanta

# 4kwallpapers project (15 tests)
npm test --prefix 4kwallpapers
```

---

## 🔒 Security Notes

- `cookies.json` (Facebook session) is **excluded via `.gitignore`** and must never be committed. Keep it local!
- AnonyIG fetches public Instagram posts anonymously without requiring Instagram logins.
- Downloaded wallpaper images, `node_modules/`, and runtime JSON databases are also git-ignored.

## ✅ Requirements

- **Windows 10/11**
- **Node.js ≥ 18** (built-in `node:test` requires ≥ 18)
- **Google Chrome** (used via `puppeteer-core`)
- PowerShell (built into Windows)
