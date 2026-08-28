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
    // Solid image with a distinctive color so pixel checks are meaningful.
    const svg = `<svg width="${width}" height="${height}"><rect width="100%" height="100%" fill="#3366aa"/></svg>`;
    await sharp(Buffer.from(svg)).jpeg().toFile(filePath);
}

async function readRawPixel(pngBuffer, x, y, width) {
    const { data, info } = await sharp(pngBuffer)
        .raw()
        .toBuffer({ resolveWithObject: true });
    const idx = (y * info.width + x) * info.channels;
    return { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
}

describe('ImageProcessor outpainting', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = makeTempDir();
    });

    afterEach(() => {
        destroyTempDir(tmpDir);
        delete processor.replicateClient;
    });

    describe('needsOutpaint', () => {
        test('returns false when aspect ratios match closely', () => {
            assert.strictEqual(processor.needsOutpaint(16 / 9, 16 / 9), false);
            assert.strictEqual(processor.needsOutpaint(1.61, 1.6), false); // < 3% off
        });

        test('returns true when aspect ratios differ meaningfully', () => {
            assert.strictEqual(processor.needsOutpaint(4 / 3, 16 / 9), true);
            assert.strictEqual(processor.needsOutpaint(1.0, 16 / 9), true);
        });
    });

    describe('computeOutpaintLayout', () => {
        test('fits a mismatched landscape image inside the screen, centered', () => {
            // 1500x1000 on a 1920x1080 screen: scale = min(1.28, 1.08) = 1.08
            const layout = processor.computeOutpaintLayout(1500, 1000, 1920, 1080);
            assert.strictEqual(layout.width, 1620);
            assert.strictEqual(layout.height, 1080);
            assert.strictEqual(layout.left, 150);
            assert.strictEqual(layout.top, 0);
        });

        test('never exceeds screen bounds', () => {
            const layout = processor.computeOutpaintLayout(3000, 1000, 1920, 1080);
            assert.ok(layout.width <= 1920);
            assert.ok(layout.height <= 1080);
            assert.ok(layout.left >= 0 && layout.top >= 0);
            assert.strictEqual(layout.left + layout.width, 1920);
        });
    });

    describe('buildPaddedAndMask', () => {
        test('pads the image onto a black screen-size canvas and masks only padding', async () => {
            const fg = await sharp({
                create: { width: 40, height: 40, channels: 3, background: '#3366aa' }
            }).png().toBuffer();
            // 100x50 canvas, 40x40 image centered -> left=30, top=5
            const layout = { width: 40, height: 40, left: 30, top: 5 };

            const { image, mask } = await processor.buildPaddedAndMask(fg, layout, 100, 50);

            for (const buf of [image, mask]) {
                const meta = await sharp(buf).metadata();
                assert.strictEqual(meta.width, 100);
                assert.strictEqual(meta.height, 50);
            }

            // Image area of the mask must be black (preserve)
            const center = await readRawPixel(mask, 50, 25, 100);
            assert.deepStrictEqual(center, { r: 0, g: 0, b: 0 });

            // Padded strip must be white (generate)
            const strip = await readRawPixel(mask, 5, 25, 100);
            assert.strictEqual(strip.r, 255);

            // Image content preserved at center of padded canvas
            const imgCenter = await readRawPixel(image, 50, 25, 100);
            assert.ok(imgCenter.b > imgCenter.r, 'center should be blue-ish original');
        });
    });

    describe('processForDesktop portrait branch', () => {
        let inputPath;
        let originalScreen;

        beforeEach(async () => {
            inputPath = path.join(tmpDir, 'portrait.jpg');
            // Clearly portrait: huge aspect mismatch vs 16:9 screen.
            await createTestImage(inputPath, 800, 1200);
            originalScreen = processor.screenDimensions;
            processor.screenDimensions = { width: 1920, height: 1080 };
        });

        afterEach(() => {
            processor.screenDimensions = originalScreen;
        });

        test('outpaints portrait images instead of blurred-fill', async () => {
            processor._runReplicateFill = async () =>
                sharp({ create: { width: 1920, height: 1080, channels: 3, background: '#00ff00' } })
                    .png().toBuffer();

            const out = await processor.processForDesktop(inputPath, 'testuser');

            try {
                const meta = await sharp(out).metadata();
                assert.strictEqual(meta.width, 1920);
                assert.strictEqual(meta.height, 1080);
                // Left edge should be generated green, not blurred original
                const edge = await readRawPixel(await fs.promises.readFile(out), 10, 540, 1920);
                assert.strictEqual(edge.g, 255, 'left edge should come from outpaint result');
            } finally {
                fs.rmSync(out, { force: true });
            }
        });

        test('falls back to blurred side fill when Replicate call fails', async () => {
            processor._runReplicateFill = async () => {
                throw new Error('API down');
            };

            const out = await processor.processForDesktop(inputPath, 'testuser');

            try {
                assert.ok(fs.existsSync(out), 'fallback output should exist');
                const meta = await sharp(out).metadata();
                assert.strictEqual(meta.width, 1920);
                assert.strictEqual(meta.height, 1080);
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
            // 1800x1080 (AR 1.67) vs 1920x1080 screen (AR 1.78): mismatch above
            // the outpaint threshold, but still landscape (> screenAR - 0.2) so
            // it takes the landscape branch. Screen must be >= 1920x1080 because
            // processForDesktop clamps it so.
            await createTestImage(inputPath, 1800, 1080);
            originalScreen = processor.screenDimensions;
            processor.screenDimensions = { width: 1920, height: 1080 };
        });

        afterEach(() => {
            processor.screenDimensions = originalScreen;
        });

        test('falls back to crop when Replicate call fails', async () => {
            processor._runReplicateFill = async () => {
                throw new Error('API down');
            };

            const out = await processor.processForDesktop(inputPath, 'testuser');

            try {
                assert.ok(fs.existsSync(out), 'fallback output should exist');
                const meta = await sharp(out).metadata();
                assert.strictEqual(meta.width, 1920);
                assert.strictEqual(meta.height, 1080);
            } finally {
                fs.rmSync(out, { force: true });
            }
        });

        test('uses outpainted result on success', async () => {
            // Mocked model output: green canvas = "generated" fill
            processor._runReplicateFill = async () =>
                sharp({ create: { width: 1920, height: 1080, channels: 3, background: '#00ff00' } })
                    .png().toBuffer();

            const out = await processor.processForDesktop(inputPath, 'testuser');

            try {
                const meta = await sharp(out).metadata();
                assert.strictEqual(meta.width, 1920);
                assert.strictEqual(meta.height, 1080);
                // Left edge should be generated green, not cropped original blue
                const edge = await readRawPixel(await fs.promises.readFile(out), 10, 540, 1920);
                assert.strictEqual(edge.g, 255, 'left edge should come from outpaint result');
            } finally {
                fs.rmSync(out, { force: true });
            }
        });
    });
});
