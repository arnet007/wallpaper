const puppeteer = require('puppeteer-core');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('./config');

class AnonyIGScraper {
    constructor() {
        this.browser = null;
    }

    /**
     * Launches headless Chrome browser instance
     */
    async initBrowser(headless = true) {
        if (this.browser) return this.browser;

        if (!fs.existsSync(config.CHROME_TEMP_DIR)) {
            fs.mkdirSync(config.CHROME_TEMP_DIR, { recursive: true });
        }

        console.log(`[Browser] Launching Chrome (${config.CHROME_PATH})...`);
        this.browser = await puppeteer.launch({
            executablePath: config.CHROME_PATH,
            userDataDir: config.CHROME_TEMP_DIR,
            headless: headless ? 'new' : false,
            defaultViewport: null,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-notifications',
                '--disable-infobars',
                '--window-size=1920,1080'
            ]
        });

        return this.browser;
    }

    /**
     * Scrapes high-resolution Instagram photos for a given username via AnonyIG
     * Handles public profiles, carousels, stories, as well as private profiles (extracting 1080p HD profile pictures).
     * @param {string} username Raw username or profile URL
     * @param {object} options Optional flags (includeStories, maxScrolls)
     * @returns {Promise<{ username: string, userInfo: object, images: Array }>}
     */
    async scrapeProfile(username, options = {}) {
        const cleanName = username.replace(/^@/, '').trim().toLowerCase();
        console.log(`[Scraper] Starting AnonyIG scrape for "@${cleanName}"...`);

        await this.initBrowser(true);
        const page = await this.browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        let userInfoData = null;
        let postsData = null;
        let storiesData = null;
        const domImageUrls = new Set();

        try {
            // Intercept background API responses
            page.on('response', async (res) => {
                const url = res.url();
                try {
                    if (url.includes('/api/v1/instagram/userInfo')) {
                        userInfoData = await res.json();
                        console.log(`[Scraper] Captured userInfo for "@${cleanName}".`);
                    } else if (url.includes('/api/v1/instagram/postsV2') || url.includes('/api/v1/instagram/posts')) {
                        postsData = await res.json();
                        console.log(`[Scraper] Captured posts feed for "@${cleanName}".`);
                    } else if (url.includes('/api/v1/instagram/stories')) {
                        storiesData = await res.json();
                        console.log(`[Scraper] Captured active stories for "@${cleanName}".`);
                    }
                } catch (e) {}
            });

            console.log(`[Scraper] Navigating to ${config.ANONYIG_URL}...`);
            await page.goto(config.ANONYIG_URL, {
                waitUntil: 'networkidle2',
                timeout: config.PAGE_TIMEOUT_MS
            });

            // Enter username into search input
            const inputSelector = '.search-form__input';
            await page.waitForSelector(inputSelector, { timeout: 15000 });
            await page.type(inputSelector, cleanName, { delay: 40 });

            console.log(`[Scraper] Submitting search for "@${cleanName}"...`);
            const btnSelector = '.search-form__button';
            await page.click(btnSelector);

            // Wait for posts/userInfo API response or timeout
            const startTime = Date.now();
            while (Date.now() - startTime < config.API_WAIT_TIMEOUT_MS) {
                if (postsData && userInfoData) break;
                // If userInfoData is captured and we gave sufficient time for posts (or private profile)
                if (userInfoData && Date.now() - startTime > 4000) break;
                await new Promise(r => setTimeout(r, 400));
            }

            // If stories requested or available, check stories tab
            if (options.includeStories) {
                try {
                    const storiesTab = await page.$x("//button[contains(text(), 'STORIES')]");
                    if (storiesTab.length > 0) {
                        console.log(`[Scraper] Clicking STORIES tab...`);
                        await storiesTab[0].click();
                        await new Promise(r => setTimeout(r, 3000));
                    }
                } catch (e) {}
            }

            // Also extract any direct image elements from DOM as fallback
            const domElements = await page.evaluate(() => {
                const items = [];
                document.querySelectorAll('img, a.download-btn, a[href*="media.anonyig.com"]').forEach(el => {
                    const src = el.src || el.href;
                    if (src && (src.includes('cdninstagram.com') || src.includes('media.anonyig.com'))) {
                        items.push(src);
                    }
                });
                return items;
            });

            domElements.forEach(u => domImageUrls.add(u));

            // Extract high-resolution images from structured API JSON
            const images = this.extractImagesFromResponses({
                userInfoData,
                postsData,
                storiesData,
                domImageUrls: Array.from(domImageUrls)
            });

            console.log(`[Scraper] Successfully extracted ${images.length} high-resolution image candidates for "@${cleanName}".`);

            return {
                username: cleanName,
                userInfo: userInfoData ? (userInfoData.result || userInfoData) : null,
                images
            };

        } finally {
            if (page && !page.isClosed()) {
                await page.close().catch(() => {});
            }
        }
    }

    /**
     * Parses structured JSON responses and extracts high-resolution image entries
     */
    extractImagesFromResponses({ userInfoData, postsData, storiesData, domImageUrls = [] }) {
        const images = [];
        const seenUrls = new Set();

        const addImage = (item) => {
            const primaryUrl = item.url || item.downloadUrl;
            if (!primaryUrl || seenUrls.has(primaryUrl)) return;
            seenUrls.add(primaryUrl);
            images.push(item);
        };

        // 1. Process posts and carousels
        if (postsData) {
            let edges = [];
            if (postsData.result && postsData.result.edges) {
                edges = postsData.result.edges;
            } else if (Array.isArray(postsData.result)) {
                edges = postsData.result;
            } else if (Array.isArray(postsData)) {
                edges = postsData;
            }

            for (const edge of edges) {
                const node = edge.node || edge;
                if (!node) continue;

                const isSidecar = node.__typename === 'GraphSidecar' || !!node.edge_sidecar_to_children;
                const isVideo = node.is_video;

                if (isSidecar && node.edge_sidecar_to_children) {
                    const children = node.edge_sidecar_to_children.edges || [];
                    for (const cEdge of children) {
                        const cNode = cEdge.node || cEdge;
                        if (!cNode || cNode.is_video) continue;

                        const resources = cNode.display_resources || [];
                        const bestRes = resources.length > 0 ? resources[resources.length - 1] : { src: cNode.display_url };
                        
                        addImage({
                            id: cNode.id || `${node.id}_child`,
                            postId: node.id,
                            shortcode: node.shortcode,
                            url: bestRes.src || cNode.display_url,
                            downloadUrl: bestRes.url_downloadable || bestRes.url_wrapped || bestRes.src || cNode.display_url,
                            width: bestRes.config_width || (cNode.dimensions ? cNode.dimensions.width : 1080),
                            height: bestRes.config_height || (cNode.dimensions ? cNode.dimensions.height : 1080),
                            type: 'carousel_slide'
                        });
                    }
                } else if (!isVideo) {
                    const resources = node.display_resources || [];
                    const bestRes = resources.length > 0 ? resources[resources.length - 1] : { src: node.display_url };

                    addImage({
                        id: node.id || node.shortcode,
                        postId: node.id,
                        shortcode: node.shortcode,
                        url: bestRes.src || node.display_url,
                        downloadUrl: bestRes.url_downloadable || bestRes.url_wrapped || bestRes.src || node.display_url,
                        width: bestRes.config_width || (node.dimensions ? node.dimensions.width : 1080),
                        height: bestRes.config_height || (node.dimensions ? node.dimensions.height : 1080),
                        type: 'post'
                    });
                }
            }
        }

        // 2. Process active stories
        if (storiesData && storiesData.result) {
            const storyList = Array.isArray(storiesData.result) ? storiesData.result : [storiesData.result];
            for (const story of storyList) {
                if (story.is_video) continue;
                const storyUrl = story.display_url || story.image_versions2?.candidates?.[0]?.url || story.url;
                if (storyUrl) {
                    addImage({
                        id: story.id || `story_${Date.now()}`,
                        url: storyUrl,
                        downloadUrl: story.download_url || storyUrl,
                        width: story.dimensions?.width || 1080,
                        height: story.dimensions?.height || 1920,
                        type: 'story'
                    });
                }
            }
        }

        // 3. Process HD Profile Picture from userInfo (crucial for private profiles or profile pic avatars)
        if (userInfoData) {
            let user = null;
            if (userInfoData.result && Array.isArray(userInfoData.result) && userInfoData.result[0]) {
                user = userInfoData.result[0].user || userInfoData.result[0];
            } else if (userInfoData.user) {
                user = userInfoData.user;
            } else if (userInfoData.result && userInfoData.result.user) {
                user = userInfoData.result.user;
            } else {
                user = userInfoData;
            }

            if (user && (user.hd_profile_pic_url_info || user.hd_profile_pic_versions || user.profile_pic_url)) {
                const hdInfo = user.hd_profile_pic_url_info;
                const hdVersions = user.hd_profile_pic_versions || [];
                const highestHdVersion = hdVersions.length > 0 ? hdVersions[hdVersions.length - 1] : null;

                const profilePicUrl = hdInfo?.url || highestHdVersion?.url || user.profile_pic_url_hd || user.profile_pic_url;
                const profilePicDownloadUrl = hdInfo?.url_downloadable || hdInfo?.url_wrapped || highestHdVersion?.url_downloadable || highestHdVersion?.url_wrapped || user.profile_pic_url_downloadable || user.profile_pic_url_wrapped || profilePicUrl;

                if (profilePicUrl) {
                    addImage({
                        id: `profile_pic_${user.pk || user.id || 'hd'}`,
                        url: profilePicUrl,
                        downloadUrl: profilePicDownloadUrl,
                        width: hdInfo?.width || highestHdVersion?.width || 1080,
                        height: hdInfo?.height || highestHdVersion?.height || 1080,
                        type: 'profile_pic'
                    });
                }
            }
        }

        // 4. Fallback from DOM image elements
        if (images.length === 0 && domImageUrls.length > 0) {
            for (const u of domImageUrls) {
                // Ignore tiny icons / favicons
                if (u.includes('favicon') || u.includes('icon') || u.includes('logo.png')) continue;
                addImage({
                    id: `dom_${Math.abs(u.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0))}`,
                    url: u,
                    downloadUrl: u,
                    width: 1080,
                    height: 1080,
                    type: 'dom_photo'
                });
            }
        }

        return images;
    }

    /**
     * Downloads an image file from direct CDN or fallback proxy URL
     * @param {string|object} imageSource URL string or image item object
     * @param {string} destPath Target file path
     * @returns {Promise<string>} Saved file path
     */
    async downloadImage(imageSource, destPath) {
        const item = typeof imageSource === 'string' ? { url: imageSource, downloadUrl: imageSource } : imageSource;
        
        const candidateUrls = Array.from(new Set([
            item.url,
            item.download_url,
            item.downloadUrl
        ].filter(Boolean)));

        if (candidateUrls.length === 0) {
            throw new Error('No valid download URL provided for image.');
        }

        let lastError = null;
        for (const targetUrl of candidateUrls) {
            try {
                console.log(`[Downloader] Attempting download: ${targetUrl.slice(0, 80)}...`);
                const res = await axios({
                    method: 'GET',
                    url: targetUrl,
                    responseType: 'arraybuffer',
                    timeout: 45000,
                    headers: {
                        'User-Agent': config.USER_AGENT,
                        'Referer': targetUrl.includes('anonyig.com') ? 'https://anonyig.com/en1/iganony/' : 'https://www.instagram.com/'
                    }
                });

                if (res.status === 200 && res.data.length >= config.MIN_IMAGE_SIZE_BYTES) {
                    fs.writeFileSync(destPath, res.data);
                    console.log(`[Downloader] Saved (${Math.round(res.data.length / 1024)} KB) -> ${destPath}`);
                    return destPath;
                }
            } catch (err) {
                lastError = err;
                console.warn(`[Downloader] URL attempt failed (${err.message}). Trying next candidate...`);
            }
        }

        throw new Error(`Failed to download valid image from candidate URLs. Last error: ${lastError ? lastError.message : 'Unknown'}`);
    }

    /**
     * Closes browser instance
     */
    async close() {
        if (this.browser) {
            await this.browser.close().catch(() => {});
            this.browser = null;
        }
    }
}

module.exports = new AnonyIGScraper();
module.exports.AnonyIGScraper = AnonyIGScraper;
