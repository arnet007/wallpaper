const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const processor = require('../image_processor');

function makeTempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'wallpaper-imgproc-test-'));
}

function destroyTempDir(dir) {
    try {
        fs.rmSync(dir, { recursive: true, force: true });
    } catch (e) {}
}

async function createTestImage(filePath, width, height) {
    const svg = `<svg width="${width}" height="${height}"><rect width="100%" height="100%" fill="#3366aa"/></svg>`;
    await sharp(Buffer.from(svg)).jpeg().toFile(filePath);
}

describe('ImageProcessor blurring & wallpaper processing', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = makeTempDir();
    });

    afterEach(() => {
        destroyTempDir(tmpDir);
    });

    describe('createFacebookBadgeSvg', () => {
        test('creates SVG badge with Facebook logo and profile text', () => {
            const badge = processor.createFacebookBadgeSvg('testuser');
            assert.ok(badge.buffer);
            assert.ok(badge.width > 0);
            assert.strictEqual(badge.height, 48);

            const svgText = badge.buffer.toString('utf8');
            assert.ok(svgText.includes('testuser'));
            assert.ok(svgText.includes('#1877F2')); // Facebook blue
        });

        test('formats profile_ id prefix nicely', () => {
            const badge = processor.createFacebookBadgeSvg('profile_1000123');
            const svgText = badge.buffer.toString('utf8');
            assert.ok(svgText.includes('ID: 1000123'));
        });
    });

    describe('processForDesktop portrait branch', () => {
        let inputPath;
        let originalScreen;

        beforeEach(async () => {
            inputPath = path.join(tmpDir, 'portrait.jpg');
            await createTestImage(inputPath, 800, 1200);
            originalScreen = processor.screenDimensions;
            processor.screenDimensions = { width: 1920, height: 1080 };
        });

        afterEach(() => {
            processor.screenDimensions = originalScreen;
        });

        test('creates widescreen 1920x1080 wallpaper with Gaussian blurred side-fills', async () => {
            const out = await processor.processForDesktop(inputPath, 'testuser');

            try {
                assert.ok(fs.existsSync(out), 'output wallpaper should exist');
                const meta = await sharp(out).metadata();
                assert.strictEqual(meta.width, 1920);
                assert.strictEqual(meta.height, 1080);
                assert.strictEqual(meta.format, 'jpeg');
            } finally {
                fs.rmSync(out, { force: true });
            }
        });
    });

    describe('processForDesktop landscape branch', () => {
        let inputPath;
        let originalScreen;

        beforeEach(async () => {
            inputPath = path.join(tmpDir, 'landscape.jpg');
            await createTestImage(inputPath, 2560, 1440);
            originalScreen = processor.screenDimensions;
            processor.screenDimensions = { width: 1920, height: 1080 };
        });

        afterEach(() => {
            processor.screenDimensions = originalScreen;
        });

        test('creates widescreen 1920x1080 wallpaper with cover crop and Facebook badge', async () => {
            const out = await processor.processForDesktop(inputPath, 'testuser');

            try {
                assert.ok(fs.existsSync(out), 'output wallpaper should exist');
                const meta = await sharp(out).metadata();
                assert.strictEqual(meta.width, 1920);
                assert.strictEqual(meta.height, 1080);
                assert.strictEqual(meta.format, 'jpeg');
            } finally {
                fs.rmSync(out, { force: true });
            }
        });
    });
});
