const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const config = require('./config');

class ImageProcessorWallhere {
    constructor() {
        this.screenDimensions = null;
    }

    /**
     * Detects primary screen resolution using PowerShell
     */
    getScreenResolution() {
        if (this.screenDimensions) return this.screenDimensions;

        try {
            const cmd = `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds; Write-Output ($b.Width.ToString() + 'x' + $b.Height.ToString())"`;
            const output = execSync(cmd, { encoding: 'utf8' }).trim();
            const parts = output.split('x');
            if (parts.length === 2) {
                const width = parseInt(parts[0], 10);
                const height = parseInt(parts[1], 10);
                if (width > 0 && height > 0) {
                    this.screenDimensions = { width, height };
                    return this.screenDimensions;
                }
            }
        } catch (e) {}

        this.screenDimensions = { width: 1920, height: 1080 };
        return this.screenDimensions;
    }

    /**
     * Creates an optional vector pill badge
     */
    createBadgeSvg(badgeText) {
        const text = badgeText || 'WallHere';
        const charWidth = 10;
        const textWidth = Math.max(text.length * charWidth, 70);
        const badgeWidth = Math.round(textWidth + 60);
        const badgeHeight = 44;

        const svg = `
        <svg width="${badgeWidth}" height="${badgeHeight}" viewBox="0 0 ${badgeWidth} ${badgeHeight}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="whGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="rgba(15, 23, 42, 0.80)" />
                    <stop offset="100%" stop-color="rgba(30, 41, 59, 0.70)" />
                </linearGradient>
                <filter id="dropShadow" x="-10%" y="-10%" width="120%" height="130%">
                    <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="rgba(0,0,0,0.4)" />
                </filter>
            </defs>

            <!-- Pill Background -->
            <rect x="2" y="2" width="${badgeWidth - 4}" height="${badgeHeight - 4}" rx="20"
                  fill="url(#whGrad)" stroke="rgba(255, 255, 255, 0.28)" stroke-width="1.2" filter="url(#dropShadow)" />

            <!-- Icon Circle -->
            <circle cx="22" cy="22" r="12" fill="#3b82f6" />
            <text x="22" y="27" text-anchor="middle" fill="#FFFFFF" font-family="Segoe UI, -apple-system, sans-serif"
                  font-size="12" font-weight="700">W</text>

            <!-- Text -->
            <text x="42" y="27" fill="#FFFFFF" font-family="Segoe UI, -apple-system, sans-serif"
                  font-size="14" font-weight="600" letter-spacing="0.3">
                ${text}
            </text>
        </svg>
        `;

        return {
            buffer: Buffer.from(svg),
            width: badgeWidth,
            height: badgeHeight
        };
    }

    /**
     * Processes image for desktop:
     *   - If portrait/narrow (AR < screenAR - 0.2), creates widescreen blurred background with sharp centered image.
     *   - If landscape/widescreen, resizes to cover screen crisply.
     *   - Optional badge if configured.
     */
    async processForDesktop(inputPath, badgeText = '') {
        const absoluteInput = path.resolve(inputPath);
        if (!fs.existsSync(absoluteInput)) {
            throw new Error(`Image file not found: ${absoluteInput}`);
        }

        const metadata = await sharp(absoluteInput).metadata();
        const imgWidth = metadata.width || 1920;
        const imgHeight = metadata.height || 1080;
        const imgAspectRatio = imgWidth / imgHeight;

        const screen = this.getScreenResolution();
        const screenWidth = Math.max(screen.width, 1920);
        const screenHeight = Math.max(screen.height, 1080);
        const screenAspectRatio = screenWidth / screenHeight;

        const isPortraitOrNarrow = imgAspectRatio < (screenAspectRatio - 0.2);

        const parsed = path.parse(absoluteInput);
        const outputPath = path.join(parsed.dir, `${parsed.name}_desktop.jpg`);

        const compositeLayers = [];

        // Add badge if enabled in config or requested
        if (config.BADGE_ENABLED && badgeText) {
            const badge = this.createBadgeSvg(badgeText);
            const badgeTop = 30;
            const badgeLeft = screenWidth - badge.width - 30;
            compositeLayers.push({
                input: badge.buffer,
                left: Math.max(0, badgeLeft),
                top: badgeTop
            });
        }

        if (isPortraitOrNarrow) {
            console.log(`[ImageProcessor] Detected portrait/narrow image (${imgWidth}x${imgHeight}, AR: ${imgAspectRatio.toFixed(2)}).`);
            console.log(`[ImageProcessor] Generating aesthetic widescreen wallpaper with blurred side fills (${screenWidth}x${screenHeight})...`);

            // 1. Blurred background (covers entire screen)
            const bgBuffer = await sharp(absoluteInput)
                .resize(screenWidth, screenHeight, {
                    fit: 'cover',
                    position: 'center'
                })
                .blur(35)
                .modulate({ brightness: 0.82 })
                .toBuffer();

            // 2. Foreground image fit inside screen without cropping
            const fgBuffer = await sharp(absoluteInput)
                .resize({
                    width: screenWidth,
                    height: screenHeight,
                    fit: 'inside'
                })
                .toBuffer();

            const fgMeta = await sharp(fgBuffer).metadata();
            const fgWidth = fgMeta.width || imgWidth;
            const fgHeight = fgMeta.height || imgHeight;

            const fgLeft = Math.round((screenWidth - fgWidth) / 2);
            const fgTop = Math.round((screenHeight - fgHeight) / 2);

            const layers = [
                {
                    input: fgBuffer,
                    left: Math.max(0, fgLeft),
                    top: Math.max(0, fgTop)
                },
                ...compositeLayers
            ];

            await sharp(bgBuffer)
                .composite(layers)
                .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
                .toFile(outputPath);
        } else {
            console.log(`[ImageProcessor] Processing widescreen image (${imgWidth}x${imgHeight}, AR: ${imgAspectRatio.toFixed(2)}).`);
            
            const baseBuffer = await sharp(absoluteInput)
                .resize(screenWidth, screenHeight, {
                    fit: 'cover',
                    position: 'center'
                })
                .toBuffer();

            if (compositeLayers.length > 0) {
                await sharp(baseBuffer)
                    .composite(compositeLayers)
                    .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
                    .toFile(outputPath);
            } else {
                await sharp(baseBuffer)
                    .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
                    .toFile(outputPath);
            }
        }

        console.log(`[ImageProcessor] Desktop wallpaper ready: ${outputPath}`);
        return outputPath;
    }
}

module.exports = new ImageProcessorWallhere();