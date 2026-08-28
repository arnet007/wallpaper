# 4K Wallpapers Nature Changer 🏔️

Downloads a random 4K wallpaper from the [Nature category](https://4kwallpapers.com/nature/) of 4kwallpapers.com and sets it as your Windows desktop wallpaper — with blurred side-fills for portrait images, a top-right source badge, and an applied-URL database so wallpapers don't repeat until a page's pool is exhausted.

## 📁 Project Structure

```text
C:\Users\sumit\projects\wallpaper\4kwallpapers\
│
├── wallpaper.js            # Main CLI (download + set wallpaper, --status)
├── scraper.js              # Category/detail page scraper + downloader
├── db.js                   # JSON database tracking used wallpaper URLs
├── image_processor.js      # Portrait blur side-fills & Top-Right badge overlay
├── config.js               # Configuration and paths
├── set_wallpaper.ps1       # Native Windows wallpaper setter
├── run_wallpaper.bat       # Double-click launcher
├── run_silent.vbs          # Silent launcher (for Task Scheduler)
├── test/                   # 15 unit tests (node:test)
└── wallpapers/             # Directory where active wallpaper is stored (auto-cleaned)
```

## 🚀 Usage

```powershell
cd C:\Users\sumit\projects\wallpaper\4kwallpapers
npm install        # one-time
```

- **Set a random nature wallpaper**:
  ```powershell
  node wallpaper.js
  ```
- **Show stats**:
  ```powershell
  node wallpaper.js --status
  ```
- **Double-click**: `run_wallpaper.bat`
- **Task Scheduler / silent**: `wscript.exe run_silent.vbs "C:\Users\sumit\projects\wallpaper\4kwallpapers\wallpaper.js"`

## ⚙️ How It Works

1. Picks a random page out of all pages of `https://4kwallpapers.com/nature/`.
2. Collects the wallpaper detail links on that page and picks one not yet used (tracked in `wallpapers_db.json`; resets the cycle when a page is exhausted).
3. Opens the detail page and picks the best rendition: exact 3840×2160 4K if available, otherwise the widest download link.
4. Downloads it (with browser UA + Referer), applies portrait blur-fill processing + badge, sets it via Win32 `SystemParametersInfo`.
5. Cleans up old images in `wallpapers/`.

## 🧪 Tests

```powershell
npm test
```
