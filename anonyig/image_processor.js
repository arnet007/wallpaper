const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class AnonyIGImageProcessor {
    constructor() {
        this.screenDimensions = null;
    }

    /**
     * Detects primary screen resolution using PowerShell WinForms
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
     * Creates an aesthetic Top-Right badge with Instagram Logo and Profile Username
     */
    createInstagramBadgeSvg(username) {
        const cleanName = (username || 'Instagram').replace(/^@/, '');
        const displayText = `@${cleanName}`;
        
        const charWidth = 10.5;
        const textWidth = Math.max(displayText.length * charWidth, 80);
        const badgeWidth = Math.round(textWidth + 68);
        const badgeHeight = 48;

        const svg = `
        <svg width="${badgeWidth}" height="${badgeHeight}" viewBox="0 0 ${badgeWidth} ${badgeHeight}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="pillGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="rgba(15, 23, 42, 0.78)" />
                    <stop offset="100%" stop-color="rgba(30, 41, 59, 0.68)" />
                </linearGradient>
                <radialGradient id="igGrad" cx="30%" cy="107%" r="150%">
                    <stop offset="0%" stop-color="#fdf497" />
                    <stop offset="5%" stop-color="#fdf497" />
                    <stop offset="45%" stop-color="#fd5949" />
                    <stop offset="60%" stop-color="#d6249f" />
                    <stop offset="90%" stop-color="#285AEB" />
                </radialGradient>
                <filter id="dropShadow" x="-10%" y="-10%" width="120%" height="130%">
                    <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="rgba(0,0,0,0.45)" />
                </filter>
            </defs>

            <!-- Pill Background -->
            <rect x="2" y="2" width="${badgeWidth - 4}" height="${badgeHeight - 4}" rx="22"
                  fill="url(#pillGrad)" stroke="rgba(255, 255, 255, 0.28)" stroke-width="1.2" filter="url(#dropShadow)" />

            <!-- Instagram Icon Container (Rounded Squircle) -->
            <g transform="translate(10, 10)">
                <rect width="28" height="28" rx="8" fill="url(#igGrad)" />
                <!-- Instagram Glyph (Outer Rounded Box + Lens + Flash) -->
                <rect x="5.5" y="5.5" width="17" height="17" rx="5" fill="none" stroke="#FFFFFF" stroke-width="1.8" />
                <circle cx="14" cy="14" r="4.2" fill="none" stroke="#FFFFFF" stroke-width="1.8" />
                <circle cx="18.2" cy="9.8" r="1.1" fill="#FFFFFF" />
            </g>

            <!-- Username Text -->
            <text x="48" y="30" fill="#FFFFFF" font-family="Segoe UI, -apple-system, BlinkMacSystemFont, Roboto, sans-serif"
                  font-size="16" font-weight="600" letter-spacing="0.3">
                ${displayText}
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
     * Formats image for desktop:
     * - Detects portrait / non-widescreen images
     * - Adds blurred side fills for portrait photos
     * - Overlays Instagram frosted pill badge in top-right corner
     * @param {string} inputPath 
     * @param {string} username 
     * @returns {Promise<string>}
     */
    async processForDesktop(inputPath, username = '') {
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

        const badge = this.createInstagramBadgeSvg(username);
        const badgeTop = 32;
        const badgeLeft = screenWidth - badge.width - 35; // Top-right corner

        if (isPortraitOrNarrow) {
            console.log(`[ImageProcessor] Detected portrait/narrow image (${imgWidth}x${imgHeight}, AR: ${imgAspectRatio.toFixed(2)}).`);
            console.log(`[ImageProcessor] Generating widescreen canvas with blurred side fills (${screenWidth}x${screenHeight})...`);

            // 1. Blurred background covering whole screen
            const bgBuffer = await sharp(absoluteInput)
                .resize(screenWidth, screenHeight, {
                    fit: 'cover',
                    position: 'center'
                })
                .blur(35)
                .modulate({ brightness: 0.82 })
                .toBuffer();

            // 2. Crisp foreground fit inside screen height
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

            // 3. Composite foreground and badge over blurred background
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

        console.log(`[ImageProcessor] Desktop wallpaper ready: ${outputPath}`);
        return outputPath;
    }
}

module.exports = new AnonyIGImageProcessor();
