const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const config = require('./config');

class WallhereScraper {
    constructor() {
        this.userAgent = config.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    }

    /**
     * Fetches HTML content with proper headers
     */
    async fetchPage(url, referer = 'https://wallhere.com/') {
        const response = await axios.get(url, {
            timeout: config.PAGE_TIMEOUT_MS || 15000,
            headers: {
                'User-Agent': this.userAgent,
                'Referer': referer,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });
        return response.data;
    }

    /**
     * Extracts wallpaper detail links from listing HTML
     */
    extractListingLinks(html) {
        const $ = cheerio.load(html);
        const wallpapers = [];
        const seen = new Set();

        $('a[href*="/wallpaper/"]').each((_, el) => {
            const href = $(el).attr('href');
            if (!href) return;

            const match = href.match(/\/wallpaper\/(\d+)$/);
            if (!match) return;

            const id = match[1];
            if (seen.has(id)) return;
            seen.add(id);

            const pageUrl = href.startsWith('http') ? href : `https://wallhere.com/en/wallpaper/${id}`;
            const img = $(el).find('img');
            const thumbSrc = img.attr('src') || '';
            const title = img.attr('alt') || $(el).attr('title') || `Wallpaper ${id}`;

            wallpapers.push({
                id,
                pageUrl,
                thumbSrc,
                title: title.trim()
            });
        });

        return wallpapers;
    }

    /**
     * Detects maximum pagination page if available
     */
    extractMaxPage(html) {
        const $ = cheerio.load(html);
        let maxPage = 1;

        $('.pagination a, .pages a, a[href*="page="]').each((_, el) => {
            const href = $(el).attr('href') || '';
            const match = href.match(/page=(\d+)/);
            if (match) {
                maxPage = Math.max(maxPage, parseInt(match[1], 10));
            }
        });

        return Math.min(maxPage, 100); // Cap at 100 for sanity
    }

    /**
     * Fetches candidate wallpapers based on query/mode
     */
    async fetchWallpapers(queryOrMode = 'random') {
        let targetUrl = 'https://wallhere.com/en/random';

        if (queryOrMode === 'random') {
            targetUrl = 'https://wallhere.com/en/random';
        } else if (queryOrMode === 'popular') {
            targetUrl = 'https://wallhere.com/en/wallpapers?order=popular';
        } else if (queryOrMode === 'latest') {
            targetUrl = 'https://wallhere.com/en/wallpapers?order=latest';
        } else if (queryOrMode.startsWith('http')) {
            // If it's a direct URL to a category/search or wallpaper
            targetUrl = queryOrMode;
        } else {
            // Search query
            const encoded = encodeURIComponent(queryOrMode);
            targetUrl = `https://wallhere.com/en/wallpapers?q=${encoded}&order=popular`;
        }

        console.log(`[Scraper] Fetching listing: ${targetUrl}`);
        const html = await this.fetchPage(targetUrl);
        const maxPage = this.extractMaxPage(html);

        // If search/popular with multiple pages, optionally randomize page
        if (maxPage > 1 && queryOrMode !== 'random') {
            const randomPage = Math.floor(Math.random() * Math.min(maxPage, 20)) + 1;
            if (randomPage > 1) {
                const separator = targetUrl.includes('?') ? '&' : '?';
                const pagedUrl = `${targetUrl}${separator}page=${randomPage}`;
                console.log(`[Scraper] Query has ${maxPage} pages. Picking random page ${randomPage}: ${pagedUrl}`);
                try {
                    const pagedHtml = await this.fetchPage(pagedUrl, targetUrl);
                    const pagedItems = this.extractListingLinks(pagedHtml);
                    if (pagedItems.length > 0) {
                        return pagedItems;
                    }
                } catch (e) {
                    console.warn(`[Scraper] Could not fetch page ${randomPage}, falling back to initial page.`);
                }
            }
        }

        return this.extractListingLinks(html);
    }

    /**
     * Fetches the detail page for a wallpaper and resolves high-resolution URLs
     */
    async resolveWallpaperDetail(wallpaperUrlOrId) {
        let pageUrl = wallpaperUrlOrId;
        if (/^\d+$/.test(wallpaperUrlOrId)) {
            pageUrl = `https://wallhere.com/en/wallpaper/${wallpaperUrlOrId}`;
        } else if (!pageUrl.startsWith('http')) {
            pageUrl = `https://wallhere.com/en/wallpaper/${wallpaperUrlOrId}`;
        }

        console.log(`[Scraper] Resolving wallpaper details: ${pageUrl}`);
        const html = await this.fetchPage(pageUrl);
        const $ = cheerio.load(html);

        // Extract ID from URL
        const idMatch = pageUrl.match(/\/wallpaper\/(\d+)/);
        const id = idMatch ? idMatch[1] : Date.now().toString();

        // 1. Primary Full-Resolution Master URL
        let fullMasterUrl = $('a.current-page-photo').attr('href') || null;
        if (!fullMasterUrl) {
            $('a[href*="get.wallhere.com/photo/"]').each((_, el) => {
                fullMasterUrl = $(el).attr('href');
            });
        }

        // 2. Secondary Display Preview URL (!d on c.wallhere.com)
        let displayPreviewUrl = null;
        const mainImgSrc = $('a.current-page-photo img').attr('src') || $('img[src*="c.wallhere.com/photos/"]').first().attr('src');
        if (mainImgSrc) {
            displayPreviewUrl = mainImgSrc.replace(/!s1$/, '!d');
            if (!displayPreviewUrl.endsWith('!d')) {
                displayPreviewUrl += '!d';
            }
        }

        // 3. Metadata
        let title = $('h1').text().trim() || $('title').text().replace(/HD Wallpapers.*$/i, '').trim();
        title = title.replace(/^Wallpaper\s*:\s*/i, '').trim();

        let resolution = '';
        const resMatch = html.match(/(\d{3,5})x(\d{3,5})\s*Resolution/i) || title.match(/(\d{3,5})x(\d{3,5})/);
        if (resMatch) {
            resolution = `${resMatch[1]}x${resMatch[2]}`;
        }

        return {
            id,
            pageUrl,
            fullMasterUrl,
            displayPreviewUrl,
            title: title || `Wallhere ${id}`,
            resolution
        };
    }

    /**
     * Downloads the wallpaper image, testing master resolution first and falling back to HD display preview
     */
    async downloadWallpaper(detail, destPath) {
        const candidates = [];
        if (detail.fullMasterUrl) {
            candidates.push({ type: 'Master Full Resolution', url: detail.fullMasterUrl });
        }
        if (detail.displayPreviewUrl) {
            candidates.push({ type: 'HD Display Preview (!d)', url: detail.displayPreviewUrl });
        }

        if (candidates.length === 0) {
            throw new Error(`No image URLs found for wallpaper ID: ${detail.id}`);
        }

        for (const candidate of candidates) {
            try {
                console.log(`[Downloader] Trying [${candidate.type}]: ${candidate.url.substring(0, 85)}...`);
                const response = await axios.get(candidate.url, {
                    method: 'GET',
                    responseType: 'arraybuffer',
                    timeout: config.DOWNLOAD_TIMEOUT_MS || 45000,
                    headers: {
                        'User-Agent': this.userAgent,
                        'Referer': detail.pageUrl,
                        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
                    }
                });

                if (response.status === 200 && response.data && response.data.length >= (config.MIN_IMAGE_SIZE_BYTES || 50000)) {
                    // Verify image validity with Sharp
                    const meta = await sharp(response.data).metadata();
                    if (meta.width && meta.height && meta.width >= 1000) {
                        fs.writeFileSync(destPath, response.data);
                        console.log(`[Downloader] High-resolution image saved: ${meta.width}x${meta.height} (${Math.round(response.data.length / 1024)} KB) -> ${destPath}`);
                        return {
                            filePath: destPath,
                            width: meta.width,
                            height: meta.height,
                            sizeBytes: response.data.length,
                            sourceUrl: candidate.url
                        };
                    } else {
                        console.warn(`[Downloader] Image resolution too small (${meta.width}x${meta.height}), trying next candidate.`);
                    }
                }
            } catch (err) {
                console.warn(`[Downloader] Candidate [${candidate.type}] failed: ${err.message}`);
            }
        }

        throw new Error(`Failed to download valid high-resolution image for wallpaper ID ${detail.id}`);
    }
}

module.exports = WallhereScraper;
