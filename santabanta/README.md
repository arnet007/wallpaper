# SantaBanta Desktop Wallpaper Changer 🌟

Comprehensive tool to download and set high-definition wallpapers from SantaBanta, with automatic category discovery, random gallery selection, full-resolution HD landscape pattern transformation (`/Full5/`), portrait blurred side-fills, top-right badges, and disk cleanup.

---

## 📁 Project Structure

```text
C:\Users\sumit\projects\wallpaper\santabanta\
│
├── universal.js            # Universal random wallpaper changer (Random Category -> Random Page -> Random Gallery -> Full HD Wallpaper)
├── wallpaper.js            # Targeted category/celebrity wallpaper changer
├── categories.txt          # List of targeted SantaBanta gallery URLs or names
├── run_universal.bat       # One-click launcher for Universal Random Wallpaper
├── run_wallpaper.bat       # One-click launcher for Targeted Wallpaper
├── scraper.js              # SantaBanta gallery scraper
├── db.js                   # JSON database tracking used wallpapers & 7-day cycles
├── image_processor.js      # Portrait blur side-fills & Top-Right badge overlay
├── config.js               # Configuration and paths
├── set_wallpaper.ps1       # Native Windows wallpaper setter
├── wallpapers/             # Directory where active wallpaper is stored (auto-cleaned)
├── universal_db.json       # Database for universal random wallpapers
└── wallpapers_db.json      # Database for targeted category wallpapers
```

---

## 🎲 Universal Random Wallpaper Changer (`universal.js`)

Picks a random category from `https://santabanta.com/wallpapers/categories/`, selects a random page, chooses a random sub-gallery (e.g. `outdoors/summer/`, `animals/camels/`, `cars/bmw/`), downloads the **1920x1080 Full Landscape HD Master Wallpaper** (`/Full5/`), and sets your wallpaper.

### 🚀 Usage:

```powershell
cd C:\Users\sumit\projects\wallpaper\santabanta
```

- **Set a completely random wallpaper across ALL SantaBanta categories**:
  ```powershell
  node universal.js
  ```
  *(Or double-click **`run_universal.bat`**)*

- **Set a random wallpaper from a specific category**:
  ```powershell
  node universal.js outdoors
  ```
  ```powershell
  node universal.js cars
  ```
  ```powershell
  node universal.js nature
  ```
  ```powershell
  node universal.js animals
  ```
  ```powershell
  node universal.js indian-celebrities-f
  ```
  ```powershell
  node universal.js bollywood-movies
  ```

- **List all discovered SantaBanta categories**:
  ```powershell
  node universal.js --categories
  ```

- **Check universal stats**:
  ```powershell
  node universal.js --status
  ```

---

## 🎯 Targeted Celebrity & Category Changer (`wallpaper.js`)

- **Set wallpaper for a specific celebrity/category**:
  ```powershell
  node wallpaper.js pooja-hegde
  ```
  ```powershell
  node wallpaper.js pratibha-ranta
  ```
  ```powershell
  node wallpaper.js https://santabanta.com/wallpapers/cars/bmw/
  ```

- **Rotate through categories in `categories.txt`**:
  ```powershell
  node wallpaper.js
  ```
