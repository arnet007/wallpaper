# 🖼️ Wallpaper Changer Suite

Turn your Windows desktop into an automatic wallpaper rotator using photos from **Facebook profiles** and **SantaBanta galleries**.

The repo contains two independent, self-contained projects:

| Project | Directory | What it does |
| :--- | :--- | :--- |
| **Facebook Wallpaper Changer** | [`facebook/`](./facebook) | Scrapes high-resolution photos from Facebook profiles, cycles them as your wallpaper, and auto re-scrapes every 7 days. |
| **SantaBanta Wallpaper Changer** | [`santabanta/`](./santabanta) | Downloads full-HD wallpapers from SantaBanta — both targeted (celebrity/category) and universal random mode. |

---

## 📁 Repository Structure

```text
wallpaper/
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
├── install_context_menu.bat   # 🖱️ Install "Change Desktop Wallpaper" right-click menu
├── uninstall_context_menu.bat # 🖱️ Uninstall the right-click menu
└── .gitignore                 # Excludes cookies, wallpapers, node_modules, runtime DBs
```

---

## 🚀 Quick Start (Facebook)

```powershell
# 1. One-time login (saves cookies.json — required for private profiles)
cd facebook
node wallpaper.js --login

# 2. Add profile URLs to facebook\profiles.txt (one per line)
#    e.g. https://www.facebook.com/rajnandinideyrj/photos

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

## 🖱️ Right-Click Desktop Context Menu

Install a cascading "Change Desktop Wallpaper" menu on your desktop background:

```
double-click install_context_menu.bat
```

It adds entries for:
- **Next Facebook Wallpaper**
- **Next SantaBanta Wallpaper (Random)**
- **Next SantaBanta (Outdoors / Cars / Nature)**

Remove it anytime with `uninstall_context_menu.bat`.

---

## 🧪 Running Tests

Both projects use Node's built-in test runner — no extra dependencies.

```powershell
# Facebook project (23 tests)
npm test --prefix facebook

# SantaBanta project (14 tests)
npm test --prefix santabanta
```

---

## 🔒 Security Notes

- `cookies.json` (Facebook session) is **excluded via `.gitignore`** and must never be committed. Keep it local!
- Downloaded wallpaper images, `node_modules/`, and runtime JSON databases are also git-ignored.

## ✅ Requirements

- **Windows 10/11**
- **Node.js ≥ 18** (built-in `node:test` requires ≥ 18)
- **Google Chrome** (used via `puppeteer-core`)
- PowerShell (built into Windows)