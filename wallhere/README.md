# Wallhere Wallpaper Changer

High-resolution wallpaper downloader, processor, and Windows desktop changer for [wallhere.com](https://wallhere.com).

## 🚀 Features
- **True High-Resolution & 4K Master Extraction**: Resolves Wallhere detail pages to download original master images from `get.wallhere.com` (1080p, 2K, 4K, 5K) with automatic `!d` fallback.
- **Intelligent Processing**:
  - **Portrait / Narrow Artworks**: Formats to 16:9 widescreen canvas with Gaussian blur side-fills (`blur(35)`, brightness `0.82`) without cropping the original artwork.
  - **Widescreen / Landscape**: Precision screen-cover scaling with high-quality JPEG output (`chromaSubsampling: 4:4:4`, `quality: 95`).
- **Flexible Modes**:
  - Random wallpapers (`/en/random`)
  - Search by any keyword / tag (e.g. `cyberpunk`, `anime`, `nature`, `cars`)
  - Direct wallpaper ID or URL (e.g. `598299`, `https://wallhere.com/en/wallpaper/598299`)
  - Popular wallpapers (`--popular`)
- **Database & Cycle Hygiene**:
  - Prevents repeats within the cycle.
  - Automatically cleans up old cached files in `wallpapers/` to keep disk usage minimal.
- **Windows Integration**:
  - PowerShell Win32 `SystemParametersInfo` desktop wallpaper setter with registry persistence.
  - Right-click desktop context menu integration.

---

## 🛠️ Usage

```powershell
# In C:\Users\sumit\projects\wallpaper\wallhere

# 1. Random high-resolution wallpaper
node wallhere.js

# 2. Search by topic / keyword
node wallhere.js cyberpunk
node wallhere.js anime
node wallhere.js nature

# 3. Target specific wallpaper ID or URL
node wallhere.js 1084532
node wallhere.js https://wallhere.com/en/wallpaper/598299

# 4. Popular wallpapers
node wallhere.js --popular

# 5. Check statistics
node wallhere.js --status
```
