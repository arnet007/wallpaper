const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { AnonyIGDatabase } = require('../db');
const { AnonyIGScraper } = require('../scraper');
const imageProcessor = require('../image_processor');

describe('AnonyIG Database Tests', () => {
    const testDbPath = path.join(__dirname, 'test_wallpapers_db.json');
    const testProfilesPath = path.join(__dirname, 'test_profiles.txt');
    let db;

    before(() => {
        if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
        if (fs.existsSync(testProfilesPath)) fs.unlinkSync(testProfilesPath);
        fs.writeFileSync(testProfilesPath, '# Test Profiles\naliaabhatt\nhttps://www.instagram.com/shraddhakapoor/\n@dishapatani\n');
        db = new AnonyIGDatabase(testDbPath, testProfilesPath);
    });

    after(() => {
        if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
        if (fs.existsSync(testProfilesPath)) fs.unlinkSync(testProfilesPath);
    });

    it('should clean and normalize usernames properly', () => {
        assert.strictEqual(db.cleanUsername('aliaabhatt'), 'aliaabhatt');
        assert.strictEqual(db.cleanUsername('@aliaabhatt'), 'aliaabhatt');
        assert.strictEqual(db.cleanUsername('https://www.instagram.com/aliaabhatt/'), 'aliaabhatt');
        assert.strictEqual(db.cleanUsername('https://anonyig.com/en1/iganony/aliaabhatt'), 'aliaabhatt');
        assert.strictEqual(db.cleanUsername('s_ragini.1'), 's_ragini.1');
    });

    it('should load profiles from profiles.txt ignoring comments', () => {
        const profiles = db.loadProfiles();
        assert.strictEqual(profiles.length, 3);
        assert.strictEqual(profiles[0].username, 'aliaabhatt');
        assert.strictEqual(profiles[1].username, 'shraddhakapoor');
        assert.strictEqual(profiles[2].username, 'dishapatani');
    });

    it('should add scraped images to pool and prevent duplicates', () => {
        const sampleImages = [
            { id: '101', url: 'https://cdn.example.com/101.jpg', width: 1080, height: 1350 },
            { id: '102', url: 'https://cdn.example.com/102.jpg', width: 1080, height: 1080 },
        ];

        const stats1 = db.addScrapedImages('aliaabhatt', sampleImages);
        assert.strictEqual(stats1.addedCount, 2);
        assert.strictEqual(stats1.total, 2);

        // Add duplicate
        const stats2 = db.addScrapedImages('aliaabhatt', sampleImages);
        assert.strictEqual(stats2.addedCount, 0);
        assert.strictEqual(stats2.total, 2);
    });

    it('should retrieve next unused wallpaper and cycle properly', () => {
        const item1 = db.getNextUnusedWallpaper('aliaabhatt');
        assert.ok(item1);
        assert.strictEqual(item1.image.id, '101');

        // Mark used
        db.markWallpaperUsed('aliaabhatt', '101', '/dummy/path1.jpg');

        const item2 = db.getNextUnusedWallpaper('aliaabhatt');
        assert.ok(item2);
        assert.strictEqual(item2.image.id, '102');

        // Mark second used
        db.markWallpaperUsed('aliaabhatt', '102', '/dummy/path2.jpg');

        // All used -> should reset cycle
        const item3 = db.getNextUnusedWallpaper('aliaabhatt');
        assert.ok(item3);
        assert.strictEqual(item3.image.id, '101');
    });
});

describe('AnonyIG Image Processor Tests', () => {
    it('should create an SVG badge containing Instagram branding and username', () => {
        const badge = imageProcessor.createInstagramBadgeSvg('s_ragini.1');
        assert.ok(badge.buffer);
        assert.ok(badge.width > 100);
        assert.ok(badge.height === 48);

        const svgStr = badge.buffer.toString('utf8');
        assert.ok(svgStr.includes('@s_ragini.1'));
        assert.ok(svgStr.includes('igGrad'));
    });

    it('should detect screen resolution', () => {
        const res = imageProcessor.getScreenResolution();
        assert.ok(res.width >= 800);
        assert.ok(res.height >= 600);
    });
});

describe('AnonyIG Scraper JSON Extraction Tests', () => {
    const scraper = new AnonyIGScraper();

    it('should parse single posts and carousels into high-resolution image candidates', () => {
        const mockPostsData = {
            result: {
                edges: [
                    {
                        node: {
                            id: 'post_1',
                            shortcode: 'SC1',
                            __typename: 'GraphImage',
                            is_video: false,
                            display_url: 'https://cdn.example.com/post1_low.jpg',
                            display_resources: [
                                { src: 'https://cdn.example.com/post1_640.jpg', config_width: 640, config_height: 640 },
                                { src: 'https://cdn.example.com/post1_1080.jpg', config_width: 1080, config_height: 1350 }
                            ]
                        }
                    },
                    {
                        node: {
                            id: 'post_2',
                            shortcode: 'SC2',
                            __typename: 'GraphSidecar',
                            is_video: false,
                            edge_sidecar_to_children: {
                                edges: [
                                    {
                                        node: {
                                            id: 'child_1',
                                            is_video: false,
                                            display_url: 'https://cdn.example.com/carousel1.jpg',
                                            display_resources: [
                                                { src: 'https://cdn.example.com/carousel1_1080.jpg', config_width: 1080, config_height: 1080 }
                                            ]
                                        }
                                    },
                                    {
                                        node: {
                                            id: 'child_2',
                                            is_video: true // Video should be skipped
                                        }
                                    }
                                ]
                            }
                        }
                    }
                ]
            }
        };

        const extracted = scraper.extractImagesFromResponses({ postsData: mockPostsData });
        assert.strictEqual(extracted.length, 2);
        assert.strictEqual(extracted[0].url, 'https://cdn.example.com/post1_1080.jpg');
        assert.strictEqual(extracted[0].width, 1080);
        assert.strictEqual(extracted[0].height, 1350);

        assert.strictEqual(extracted[1].url, 'https://cdn.example.com/carousel1_1080.jpg');
        assert.strictEqual(extracted[1].type, 'carousel_slide');
    });

    it('should extract 1080p HD profile picture from userInfo for private or postless profiles', () => {
        const mockUserInfoData = {
            result: [
                {
                    user: {
                        id: '7939173262',
                        pk: '7939173262',
                        username: 's_ragini.1',
                        hd_profile_pic_url_info: {
                            url: 'https://scontent.cdninstagram.com/v/hd_1080.jpg',
                            width: 1080,
                            height: 1080,
                            url_downloadable: 'https://media.anonyig.com/get?sig=123'
                        },
                        hd_profile_pic_versions: [
                            { url: 'https://scontent.cdninstagram.com/v/hd_320.jpg', width: 320, height: 320 }
                        ]
                    }
                }
            ]
        };

        const extracted = scraper.extractImagesFromResponses({ userInfoData: mockUserInfoData, postsData: null });
        assert.strictEqual(extracted.length, 1);
        assert.strictEqual(extracted[0].id, 'profile_pic_7939173262');
        assert.strictEqual(extracted[0].url, 'https://scontent.cdninstagram.com/v/hd_1080.jpg');
        assert.strictEqual(extracted[0].downloadUrl, 'https://media.anonyig.com/get?sig=123');
        assert.strictEqual(extracted[0].width, 1080);
        assert.strictEqual(extracted[0].type, 'profile_pic');
    });
});
