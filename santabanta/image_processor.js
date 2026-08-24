const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class SantaBantaImageProcessor {
    constructor() {
        this.screenDimensions = null;
    }

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

    createBadgeSvg(categoryName) {
        const text = categoryName || 'SantaBanta';
        const charWidth = 10.5;
        const textWidth = Math.max(text.length * charWidth, 80);
        const badgeWidth = Math.round(textWidth + 72);
        const badgeHeight = 48;

        const svg = `
        <svg width="${badgeWidth}" height="${badgeHeight}" viewBox="0 0 ${badgeWidth} ${badgeHeight}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="sbGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="rgba(15, 23, 42, 0.75)" />
                    <stop offset="100%" stop-color="rgba(30, 41, 59, 0.65)" />
                </linearGradient>
                <filter id="dropShadow" x="-10%" y="-10%" width="120%" height="130%">
                    <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="rgba(0,0,0,0.4)" />
                </filter>
            </defs>

            <!-- Pill Background -->
            <rect x="2" y="2" width="${badgeWidth - 4}" height="${badgeHeight - 4}" rx="22" 
                  fill="url(#sbGrad)" stroke="rgba(255, 255, 255, 0.28)" stroke-width="1.2" filter="url(#dropShadow)" />

            <!-- SantaBanta Gold / Orange Star / Icon Circle -->
            <circle cx="24" cy="24" r="14" fill="#FF9900" />
            <polygon points="24,14 27,21 34,21 28,25 30,32 24,28 18,32 20,25 14,21 21,21" fill="#FFFFFF" />

            <!-- Category / Celebrity Text -->
            <text x="47" y="30" fill="#FFFFFF" font-family="Segoe UI, -apple-system, BlinkMacSystemFont, Roboto, sans-serif" 
                  font-size="16" font-weight="600" letter-spacing="0.4">
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

    async processForDesktop(inputPath, categoryName = '') {
        const absoluteInput = path.resolve(inputPath);
        if (!fs.existsSync(absoluteInput)) {
            throw new Error(`Image file not found: ${absoluteInput}`);
        }

        const metadata = await sharp(absoluteInput).metadata();
        const imgWidth = metadata.width || 1080;
        const imgHeight = metadata.height || 1080;
        const imgAspectRatio = imgWidth / imgHeight;

        const screen = this.getScreenResolution();
        const screenWidth = Math.max(screen.width, 1920);
        const screenHeight = Math.max(screen.height, 1080);
        const screenAspectRatio = screenWidth / screenHeight;

        const isPortraitOrNarrow = imgAspectRatio < (screenAspectRatio - 0.2);

        const parsed = path.parse(absoluteInput);
        const outputPath = path.join(parsed.dir, `${parsed.name}_desktop${parsed.ext}`);

        const badge = this.createBadgeSvg(categoryName);
        const badgeTop = 32;
        const badgeLeft = screenWidth - badge.width - 35; // Top-right corner

        console.log(`[ImageProcessor] Adding SantaBanta badge "${categoryName}" to Top-Right corner.`);

        if (isPortraitOrNarrow) {
            console.log(`[ImageProcessor] Detected portrait/narrow wallpaper (${imgWidth}x${imgHeight}, AR: ${imgAspectRatio.toFixed(2)}).`);
            console.log(`[ImageProcessor] Generating aesthetic widescreen wallpaper with blurred side fills (${screenWidth}x${screenHeight})...`);

            const bgBuffer = await sharp(absoluteInput)
                .resize(screenWidth, screenHeight, {
                    fit: 'cover',
                    position: 'center'
                })
                .blur(35)
                .modulate({ brightness: 0.82 })
                .toBuffer();

            const fgBuffer = await sharp(absoluteInput)
                .resize({
                    width: screenWidth,
                    height: screenHeight,
                    fit: 'inside'
                })
                .toBuffer();

            const fgMetadata = await sharp(fgBuffer).metadata();
            const fgWidth = fgMetadata.width || imgWidth;
            const fgHeight = fgMetadata.height || imgHeight;

            const fgLeft = Math.round((screenWidth - fgWidth) / 2);
            const fgTop = Math.round((screenHeight - fgHeight) / 2);

            await sharp(bgBuffer)
                .composite([
                    {
                        input: fgBuffer,
                        left: Math.max(0, fgLeft),
                        top: Math.max(0, fgTop)
                    },
                    {
                        input: badge.buffer,
                        left: Math.max(0, badgeLeft),
                        top: badgeTop
                    }
                ])
                .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
                .toFile(outputPath);
        } else {
            const baseBuffer = await sharp(absoluteInput)
                .resize(screenWidth, screenHeight, {
                    fit: 'cover',
                    position: 'center'
                })
                .toBuffer();

            await sharp(baseBuffer)
                .composite([
                    {
                        input: badge.buffer,
                        left: Math.max(0, badgeLeft),
                        top: badgeTop
                    }
                ])
                .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
                .toFile(outputPath);
        }

        console.log(`[ImageProcessor] Desktop wallpaper created: ${outputPath}`);
        return outputPath;
    }
}

module.exports = new SantaBantaImageProcessor();
