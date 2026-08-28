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
                if (res.request().method() === 'OPTIONS') return;
                const url = res.url();
                try {
                    if (url.includes('/api/v1/instagram/userInfo')) {
                        const json = await res.json();
                        if (json && (json.result || json.user)) {
                            userInfoData = json;
                            console.log(`[Scraper] Captured userInfo for "@${cleanName}".`);
                        }
                    } else if (url.includes('/api/v1/instagram/postsV2') || url.includes('/api/v1/instagram/posts')) {
                        const json = await res.json();
                        if (json && (json.result?.edges?.length || (Array.isArray(json.result) && json.result.length) || json.items?.length)) {
                            postsData = json;
                            const count = json.result?.edges?.length || (Array.isArray(json.result) ? json.result.length : json.items?.length);
                            console.log(`[Scraper] Captured posts feed (${count} posts) for "@${cleanName}".`);
                        }
                    } else if (url.includes('/api/v1/instagram/stories')) {
                        const json = await res.json();
                        if (json && json.result) {
                            storiesData = json;
                            console.log(`[Scraper] Captured active stories for "@${cleanName}".`);
                        }
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

            // Wait for posts/userInfo API response or DOM render
            const startTime = Date.now();
            while (Date.now() - startTime < config.API_WAIT_TIMEOUT_MS) {
                if (postsData && userInfoData) {
                    await new Promise(r => setTimeout(r, 1500));
                    break;
                }

                // Check if search results container or download buttons rendered in DOM
                const hasSearchResult = await page.evaluate(() => {
                    const hasDownloading = document.body.innerText.includes('We are downloading the profile');
                    const hasButtons = document.querySelectorAll('a.download-btn, .button__download').length > 0;
                    const hasPosts = document.querySelectorAll('img[src*="media.anonyig.com"], img[src*="cdninstagram.com"]').length > 1;
                    return !hasDownloading && (hasButtons || hasPosts);
                }).catch(() => false);

                if (postsData && hasSearchResult) {
                    await new Promise(r => setTimeout(r, 1000));
                    break;
                }

                // If private profile or no posts available, but userInfo is captured and downloading message is gone
                const isStillDownloading = await page.evaluate(() => {
                    return document.body.innerText.includes('We are downloading the profile');
                }).catch(() => false);

                if (userInfoData && !isStillDownloading && Date.now() - startTime > 20000) {
                    break;
                }

                await new Promise(r => setTimeout(r, 500));
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

            // Also extract any direct image elements / download buttons from DOM as fallback
            const domElements = await page.evaluate(() => {
                const items = [];
                document.querySelectorAll('img, a.download-btn, a[href*="media.anonyig.com"], a[href*="cdninstagram.com"]').forEach(el => {
                    const src = el.src || el.href;
                    if (src && (src.includes('cdninstagram.com') || src.includes('media.anonyig.com') || src.includes('fbcdn.net'))) {
                        if (!src.includes('logo.png') && !src.includes('search-icon') && !src.includes('favicon') && !src.includes('item-')) {
                            items.push(src);
                        }
                    }
                });
                return items;
            });

            domElements.forEach(u => domImageUrls.add(u));

            // Extract high-resolution images from structured API JSON & DOM
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
            const primaryUrl = item.url || item.downloadUrl || item.download_url;
            if (!primaryUrl || seenUrls.has(primaryUrl)) return;
            seenUrls.add(primaryUrl);
            images.push(item);
        };

        // 1. Process posts and carousels (supports modern XDTMediaDict as well as legacy GraphSidecar)
        if (postsData) {
            let edges = [];
            if (postsData.result && postsData.result.edges) {
                edges = postsData.result.edges;
            } else if (Array.isArray(postsData.result)) {
                edges = postsData.result;
            } else if (postsData.items && Array.isArray(postsData.items)) {
                edges = postsData.items;
            } else if (Array.isArray(postsData)) {
                edges = postsData;
            }

            for (const edge of edges) {
                const node = edge.node || edge;
                if (!node) continue;

                // 1.1 Carousel media (modern Instagram API / XDTMediaDict carousel)
                if (node.carousel_media && Array.isArray(node.carousel_media)) {
                    for (const item of node.carousel_media) {
                        // Skip pure videos
                        if (item.media_type === 2 || (item.video_versions && item.video_versions.length > 0 && !item.image_versions2)) continue;
                        
                        const candidates = (item.image_versions2?.candidates || []).slice();
                        candidates.sort((a, b) => ((b.width || 0) * (b.height || 0)) - ((a.width || 0) * (a.height || 0)));
                        const bestCandidate = candidates[0] || null;
                        const imgUrl = bestCandidate?.url || item.display_url || item.url;
                        const downloadUrl = bestCandidate?.url_downloadable || bestCandidate?.url_wrapped || item.download_url || imgUrl;

                        if (imgUrl) {
                            addImage({
                                id: String(item.id || item.pk || `${node.id || node.pk}_c`),
                                postId: String(node.id || node.pk),
                                code: node.code || node.shortcode,
                                url: imgUrl,
                                downloadUrl: downloadUrl,
                                width: bestCandidate?.width || item.original_width || 1080,
                                height: bestCandidate?.height || item.original_height || 1080,
                                type: 'carousel_slide'
                            });
                        }
                    }
                }
                // 1.2 Legacy Sidecar (GraphSidecar with edge_sidecar_to_children)
                else if (node.edge_sidecar_to_children?.edges) {
                    const children = node.edge_sidecar_to_children.edges || [];
                    for (const cEdge of children) {
                        const cNode = cEdge.node || cEdge;
                        if (!cNode || cNode.is_video) continue;

                        const resources = (cNode.display_resources || []).slice();
                        resources.sort((a, b) => ((b.config_width || b.width || 0) * (b.config_height || b.height || 0)) - ((a.config_width || a.width || 0) * (a.config_height || a.height || 0)));
                        const bestRes = resources[0] || null;
                        const imgUrl = bestRes?.src || cNode.display_url;

                        if (imgUrl) {
                            addImage({
                                id: String(cNode.id || `${node.id}_child`),
                                postId: String(node.id),
                                code: node.shortcode || node.code,
                                url: imgUrl,
                                downloadUrl: bestRes?.url_downloadable || bestRes?.url_wrapped || bestRes?.src || cNode.display_url,
                                width: bestRes?.config_width || (cNode.dimensions ? cNode.dimensions.width : 1080),
                                height: bestRes?.config_height || (cNode.dimensions ? cNode.dimensions.height : 1080),
                                type: 'carousel_slide'
                            });
                        }
                    }
                }
                // 1.3 Single Photo / Post (Modern XDTMediaDict or Legacy)
                else {
                    const isVideo = node.media_type === 2 || node.is_video || (node.video_versions && node.video_versions.length > 0 && !node.image_versions2);
                    if (!isVideo) {
                        const candidates = (node.image_versions2?.candidates || []).slice();
                        candidates.sort((a, b) => ((b.width || 0) * (b.height || 0)) - ((a.width || 0) * (a.height || 0)));
                        const bestCandidate = candidates[0] || null;

                        const resources = (node.display_resources || []).slice();
                        resources.sort((a, b) => ((b.config_width || b.width || 0) * (b.config_height || b.height || 0)) - ((a.config_width || a.width || 0) * (a.config_height || a.height || 0)));
                        const bestRes = resources[0] || null;

                        const imgUrl = bestCandidate?.url || bestRes?.src || node.display_url || node.url;
                        const downloadUrl = bestCandidate?.url_downloadable || bestCandidate?.url_wrapped || bestRes?.url_downloadable || bestRes?.url_wrapped || node.download_url || imgUrl;

                        if (imgUrl) {
                            addImage({
                                id: String(node.id || node.pk || node.code || node.shortcode),
                                postId: String(node.id || node.pk),
                                code: node.code || node.shortcode,
                                url: imgUrl,
                                downloadUrl: downloadUrl,
                                width: bestCandidate?.width || bestRes?.config_width || (node.dimensions ? node.dimensions.width : 1080),
                                height: bestCandidate?.height || bestRes?.config_height || (node.dimensions ? node.dimensions.height : 1080),
                                type: 'post'
                            });
                        }
                    }
                }
            }
        }

        // 2. Process active stories
        if (storiesData && storiesData.result) {
            const storyList = Array.isArray(storiesData.result) ? storiesData.result : [storiesData.result];
            for (const story of storyList) {
                if (story.is_video || story.media_type === 2) continue;
                const candidates = (story.image_versions2?.candidates || []).slice();
                candidates.sort((a, b) => ((b.width || 0) * (b.height || 0)) - ((a.width || 0) * (a.height || 0)));
                const bestCandidate = candidates[0] || null;
                const storyUrl = bestCandidate?.url || story.display_url || story.url;
                const downloadUrl = bestCandidate?.url_downloadable || bestCandidate?.url_wrapped || story.download_url || storyUrl;

                if (storyUrl) {
                    addImage({
                        id: String(story.id || story.pk || `story_${Date.now()}`),
                        url: storyUrl,
                        downloadUrl: downloadUrl,
                        width: bestCandidate?.width || story.dimensions?.width || 1080,
                        height: bestCandidate?.height || story.dimensions?.height || 1920,
                        type: 'story'
                    });
                }
            }
        }

        // 3. Process HD Profile Picture from userInfo
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
                const hdVersions = (user.hd_profile_pic_versions || []).slice();
                hdVersions.sort((a, b) => ((b.width || 0) * (b.height || 0)) - ((a.width || 0) * (a.height || 0)));
                const highestHdVersion = hdVersions[0] || null;

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
        if (images.length <= 1 && domImageUrls.length > 0) {
            for (const u of domImageUrls) {
                if (u.includes('favicon') || u.includes('icon') || u.includes('logo.png') || u.includes('item-')) continue;
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
            item.downloadUrl,
            item.download_url,
            item.url
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

                if (res.status === 200) {
                    if (res.data.length >= config.MIN_IMAGE_SIZE_BYTES) {
                        fs.writeFileSync(destPath, res.data);
                        console.log(`[Downloader] Saved (${Math.round(res.data.length / 1024)} KB) -> ${destPath}`);
                        return destPath;
                    } else {
                        lastError = new Error(`Downloaded image is too small (${Math.round(res.data.length / 1024)} KB, expected >= ${Math.round(config.MIN_IMAGE_SIZE_BYTES / 1024)} KB). Likely a thumbnail.`);
                        console.warn(`[Downloader] ${lastError.message}`);
                    }
                } else {
                    lastError = new Error(`HTTP status ${res.status}`);
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
