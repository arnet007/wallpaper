const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const config = require('./config');

/**
 * Extracts wallpaper detail links (e.g. /nature/mountain-landscape-26973.html)
 * from a category listing page.
 */
function extractDetailLinks(html) {
    const $ = cheerio.load(html);
    const links = [];
    const seen = new Set();

    $('a.wallpapers__canvas_image').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        const url = href.startsWith('http') ? href : `${config.SITE_ROOT}${href}`;
        if (seen.has(url)) return;

        const match = url.match(/\/([a-z0-9-]+)-(\d+)\.html$/i);
        if (!match) return;

        seen.add(url);
        links.push({
            url,
            slug: match[1],
            id: match[2],
            title: ($(el).attr('title') || match[1].replace(/-/g, ' ')).replace(/ Wallpaper$/i, '').trim()
        });
    });

    return links;
}

/**
 * Detects the highest ?page=N referenced by a category listing page.
 */
function extractMaxPage(html) {
    const $ = cheerio.load(html);
    let maxPage = 1;

    $('a[href*="page="]').each((_, el) => {
        const match = ($(el).attr('href') || '').match(/page=(\d+)/);
        if (match) maxPage = Math.max(maxPage, parseInt(match[1], 10));
    });

    return maxPage;
}

/**
 * Extracts the full-resolution download URL from a wallpaper detail page.
 * Prefers the exact 3840x2160 4K rendition, falling back to the widest
 * /images/wallpapers/ link available (rather than a phone-sized crop).
 */
function extractDownloadUrl(html) {
    const $ = cheerio.load(html);
    const candidates = [];

    $('a[href*="/images/wallpapers/"]').each((_, el) => {
        const href = $(el).attr('href');
        const match = href.match(/(\d+)x(\d+)/);
        candidates.push({
            url: href,
            width: match ? parseInt(match[1], 10) : 0
        });
    });

    if (candidates.length === 0) return null;

    const resolve = u => (u.startsWith('http') ? u : `${config.SITE_ROOT}${u}`);

    const fourK = candidates.find(c => c.width === 3840);
    if (fourK) return resolve(fourK.url);

    const best = candidates.reduce((a, b) => (b.width > a.width ? b : a));
    return resolve(best.url);
}

class FourKWallpapersScraper {
    async fetchPage(url) {
        const response = await axios.get(url, {
            timeout: config.PAGE_TIMEOUT_MS,
            headers: {
                'User-Agent': config.USER_AGENT,
                'Referer': config.CATEGORY_URL
            }
        });
        return response.data;
    }

    /**
     * Returns the detail links from a random page of the nature category.
     */
    async fetchWallpaperLinks(categoryUrl = config.CATEGORY_URL) {
        console.log(`[Scraper] Fetching category: ${categoryUrl}`);
        const html = await this.fetchPage(categoryUrl);
        const maxPage = extractMaxPage(html);

        let targetUrl = categoryUrl;
        if (maxPage > 1) {
            const randomPage = Math.floor(Math.random() * maxPage) + 1;
            console.log(`[Scraper] Category has ${maxPage} pages. Selected random page ${randomPage}/${maxPage}.`);
            targetUrl = `${categoryUrl.replace(/\/+$/, '')}/?page=${randomPage}`;
            return extractDetailLinks(await this.fetchPage(targetUrl));
        }

        return extractDetailLinks(html);
    }

    /**
     * Resolves the full-resolution image URL for a detail page.
     */
    async resolveDownloadUrl(detailUrl) {
        console.log(`[Scraper] Resolving download URL: ${detailUrl}`);
        const html = await this.fetchPage(detailUrl);
        const downloadUrl = extractDownloadUrl(html);
        if (!downloadUrl) {
            throw new Error(`No downloadable image found on: ${detailUrl}`);
        }
        return downloadUrl;
    }

    /**
     * Downloads the image, retrying with the Original resolution if 4K fails.
     */
    async downloadWallpaper(downloadUrl, destPath) {
        const candidateUrls = Array.from(new Set([
            downloadUrl,
            downloadUrl.replace(/3840x2160/i, '4800x3600')
        ]));

        for (const targetUrl of candidateUrls) {
            try {
                console.log(`[Downloader] Trying: ${targetUrl}...`);
                const res = await axios({
                    method: 'GET',
                    url: targetUrl,
                    responseType: 'arraybuffer',
                    timeout: 60000,
                    headers: {
                        'User-Agent': config.USER_AGENT,
                        'Referer': config.SITE_ROOT + '/'
                    }
                });

                if (res.status === 200 && res.data.length >= config.MIN_IMAGE_SIZE_BYTES) {
                    fs.writeFileSync(destPath, res.data);
                    console.log(`[Downloader] Wallpaper saved: ${destPath} (${Math.round(res.data.length / 1024)} KB)`);
                    return destPath;
                }
            } catch (e) {}
        }

        throw new Error(`Failed to download wallpaper from: ${downloadUrl}`);
    }
}

module.exports = { FourKWallpapersScraper, extractDetailLinks, extractMaxPage, extractDownloadUrl };
